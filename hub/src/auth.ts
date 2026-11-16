import { createHash, randomBytes, timingSafeEqual, pbkdf2 as pbkdf2Callback, pbkdf2Sync } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { AuthenticatedActor, HubStoreState, HubUser } from './types.ts'
import type { HubStorage } from './storage.ts'
import type { AuditLog, Shift, StoreSettings } from '../../src/types.ts'
import type { ChangeSet } from '../../src/shared/sync.ts'
import { isValidPin } from '../../src/shared/pin.ts'
import {
  DEFAULT_SHIFT_ACCESS_SETTINGS,
  loginScheduleError,
  normalizeShiftAccessSettings,
} from '../../src/lib/shiftAccess.ts'

const SESSION_MS = 12 * 60 * 60 * 1000
const LOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
const MAX_LOCKOUT_RECORDS = 10_000
const FAILURE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const pbkdf2Async = promisify(pbkdf2Callback)

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const hashDeviceToken = (token: string) => createHash('sha256').update(token).digest('hex')

interface LoginFailure {
  count: number
  lockedUntil: number
  updatedAt?: number
}

export async function verifySecret(secret: string, stored: unknown): Promise<boolean> {
  if (typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false
  try {
    const salt = Buffer.from(parts[2], 'base64')
    const expected = Buffer.from(parts[3], 'base64')
    if (!salt.length || expected.length !== 32) return false
    const actual = await pbkdf2Async(secret, salt, iterations, expected.length, 'sha256')
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function hashSecret(secret: string): string {
  const salt = randomBytes(16)
  const iterations = 120_000
  return `pbkdf2$${iterations}$${salt.toString('base64')}$${pbkdf2Sync(secret, salt, iterations, 32, 'sha256').toString('base64')}`
}

export class HubAuth {
  private sessions = new Map<string, { actor: AuthenticatedActor; expiresAt: number }>()
  private failures: Record<string, LoginFailure> = {}
  private pairFailures = new Map<string, { count: number; lockedUntil: number }>()
  private deviceStoreIds = new Map<string, string>()
  private deviceLastSeenAt = new Map<string, number>()
  private setupInProgress = false
  private setupTokenHash: Buffer | null = null
  private setupFailures = new Map<string, { count: number; lockedUntil: number }>()
  private readonly failureFile: string

  private readonly storage: HubStorage

  constructor(storage: HubStorage) {
    this.storage = storage
    this.failureFile = join(storage.root, 'auth-lockouts.json')
  }

  async initialize(): Promise<void> {
    try {
      const persisted: unknown = JSON.parse(await readFile(this.failureFile, 'utf8'))
      if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) {
        throw new Error('Invalid hub authentication lockout file.')
      }
      this.failures = Object.fromEntries(Object.entries(persisted).flatMap(([key, value]) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return []
        const failure = value as Partial<LoginFailure>
        if (!Number.isSafeInteger(failure.count) || Number(failure.count) < 0 ||
          !Number.isFinite(failure.lockedUntil)) return []
        return [[key, {
          count: Number(failure.count),
          lockedUntil: Number(failure.lockedUntil),
          ...(Number.isFinite(failure.updatedAt) ? { updatedAt: Number(failure.updatedAt) } : {}),
        }]]
      }))
      this.pruneFailures()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await this.reindexDevices()
    if (!(await this.storage.listStoreIds()).length) {
      const setupToken = randomBytes(32).toString('base64url')
      this.setupTokenHash = createHash('sha256').update(setupToken).digest()
      console.info(`First-run setup token: ${setupToken}`)
    }
  }

  beginSetup(setupToken: unknown, ip: string): void {
    const failure = this.setupFailures.get(ip)
    if ((failure?.lockedUntil ?? 0) > Date.now()) {
      throw Object.assign(new Error('Too many setup token attempts. Try again later.'), { status: 429 })
    }
    if (!this.setupTokenHash) {
      throw Object.assign(new Error('First-run setup is unavailable or already complete.'), { status: 409 })
    }
    const supplied = typeof setupToken === 'string'
      ? createHash('sha256').update(setupToken).digest()
      : createHash('sha256').update('').digest()
    if (!timingSafeEqual(supplied, this.setupTokenHash)) {
      const count = (failure?.count ?? 0) + 1
      this.setupFailures.set(ip, {
        count: count >= MAX_FAILURES ? 0 : count,
        lockedUntil: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0,
      })
      throw Object.assign(new Error('A valid first-run setup token is required.'), { status: 401 })
    }
    if (this.setupInProgress) {
      throw Object.assign(new Error('First-run owner setup is already in progress.'), { status: 409 })
    }
    this.setupFailures.delete(ip)
    this.setupInProgress = true
  }

  finishSetup(succeeded: boolean): void {
    if (succeeded) {
      this.setupTokenHash = null
      this.setupFailures.clear()
    }
    this.setupInProgress = false
  }

  async reindexDevices(): Promise<void> {
    this.deviceStoreIds.clear()
    for (const storeId of await this.storage.listStoreIds()) {
      const state = await this.storage.readStore(storeId)
      for (const device of Object.values(state.collections.stationDevices ?? {})) {
        if (typeof device.id === 'string') this.deviceStoreIds.set(device.id, storeId)
      }
    }
  }

  private async persistFailures(): Promise<void> {
    this.pruneFailures()
    await mkdir(this.storage.root, { recursive: true })
    await writeFile(this.failureFile, JSON.stringify(this.failures), { encoding: 'utf8', mode: 0o600 })
  }

  private pruneFailures(): void {
    const now = Date.now()
    const cutoff = now - FAILURE_MAX_AGE_MS
    for (const [key, failure] of Object.entries(this.failures)) {
      if ((failure.count === 0 && failure.lockedUntil <= now) ||
        (failure.updatedAt !== undefined && failure.updatedAt < cutoff)) {
        delete this.failures[key]
      }
    }
    const entries = Object.entries(this.failures)
    if (entries.length <= MAX_LOCKOUT_RECORDS) return
    entries.sort(([leftKey, left], [rightKey, right]) =>
      (left.updatedAt ?? 0) - (right.updatedAt ?? 0) || leftKey.localeCompare(rightKey),
    )
    for (const [key] of entries.slice(0, entries.length - MAX_LOCKOUT_RECORDS)) {
      delete this.failures[key]
    }
  }

  async login(storeCode: string, username: string, secret: string, ip: string): Promise<{ token: string; expiresAt: string; actor: AuthenticatedActor }> {
    const throttleKey = `${storeCode.toLowerCase()}:${username.toLowerCase()}:${ip}`
    const failure = this.failures[throttleKey]
    if ((failure?.lockedUntil ?? 0) > Date.now()) throw Object.assign(new Error('Too many failed sign-in attempts. Try again later.'), { status: 429 })
    const storeId = await this.findStoreId(storeCode)
    const state = storeId ? await this.storage.readStore(storeId) : undefined
    const users = (state?.collections.users ? Object.values(state.collections.users) : []) as unknown as HubUser[]
    const user = users.find((candidate) =>
      candidate.active && candidate.storeId === storeId &&
      [candidate.username, candidate.email].some((value) => typeof value === 'string' && value.toLowerCase() === username.toLowerCase()),
    )
    const pinLogin = !!user && !username.includes('@') &&
      (user.role === 'staff' || user.role === 'manager') && isValidPin(secret)
    const valid = !!user && !!storeId &&
      await verifySecret(secret, pinLogin ? user.pin : user.password)
    if (!valid || !user || !storeId) {
      const next = (failure?.count ?? 0) + 1
      this.failures[throttleKey] = {
        count: next >= MAX_FAILURES ? 0 : next,
        lockedUntil: next >= MAX_FAILURES ? Date.now() + LOCK_MS : 0,
        updatedAt: Date.now(),
      }
      await this.persistFailures()
      throw Object.assign(new Error('Invalid store code, username, or password/PIN.'), { status: 401 })
    }
    if (user.role === 'staff' && state) {
      const store = state.collections.stores?.[storeId] as unknown as
        { settings?: Pick<StoreSettings, 'shiftAccess'> } | undefined
      const settings = normalizeShiftAccessSettings(store?.settings?.shiftAccess)
      const shifts = Object.values(state.collections.shifts ?? {}) as unknown as Shift[]
      const registerSessions = Object.values(state.collections.registerSessions ?? {}) as unknown as
        Array<{ storeId: string; status: string; staffId?: string; openedById?: string }>
      const hasOpenShift = registerSessions.some((session) =>
        session.storeId === storeId && session.status === 'open' &&
        (session.staffId ?? session.openedById) === user.id,
      )
      const scheduleError = loginScheduleError(
        settings,
        shifts,
        storeId,
        user.id,
        new Date(),
        hasOpenShift,
      )
      if (scheduleError) {
        await this.recordShiftAccessDenied(storeId, user, scheduleError)
        throw Object.assign(new Error(scheduleError), { status: 403 })
      }
    }
    delete this.failures[throttleKey]
    await this.persistFailures()
    const actor: AuthenticatedActor = {
      storeId, userId: user.id, role: user.role, permissions: user.permissions ?? {}, stationOnly: user.stationOnly === true,
    }
    const token = randomBytes(32).toString('base64url')
    const expiresAt = Date.now() + SESSION_MS
    this.sessions.set(hashToken(token), { actor, expiresAt })
    return { token, expiresAt: new Date(expiresAt).toISOString(), actor }
  }

  private async recordShiftAccessDenied(storeId: string, user: HubUser, reason: string): Promise<void> {
    const state = await this.storage.readStore(storeId)
    const id = `aud${randomBytes(12).toString('hex')}`
    const entry: AuditLog = {
      id,
      storeId,
      userId: user.id,
      userName: user.name,
      role: 'staff',
      action: 'shift_access_denied',
      entity: 'auth',
      summary: `Blocked sign-in: ${reason}`,
      createdAt: new Date().toISOString(),
    }
    const changeSet: ChangeSet = {
      opId: `auth${randomBytes(12).toString('hex')}`,
      deviceId: 'hub-auth',
      storeId,
      baseSeq: state.seq,
      ops: [{ kind: 'put', collection: 'auditLogs', id, document: { ...entry } }],
    }
    await this.storage.transact(storeId, changeSet)
  }

  async verifyPin(actor: AuthenticatedActor, pin: string, ip: string): Promise<boolean> {
    const throttleKey = `pin:${actor.storeId}:${actor.userId}:${ip}`
    const failure = this.failures[throttleKey]
    if ((failure?.lockedUntil ?? 0) > Date.now()) {
      throw Object.assign(new Error('Too many failed PIN attempts. Try again later.'), { status: 429 })
    }
    const state = await this.storage.readStore(actor.storeId)
    const user = state.collections.users?.[actor.userId] as HubUser | undefined
    const valid = !!user && user.active && user.storeId === actor.storeId &&
      isValidPin(pin) && await verifySecret(pin, user.pin)
    if (!valid) {
      const next = (failure?.count ?? 0) + 1
      this.failures[throttleKey] = {
        count: next >= MAX_FAILURES ? 0 : next,
        lockedUntil: next >= MAX_FAILURES ? Date.now() + LOCK_MS : 0,
        updatedAt: Date.now(),
      }
      await this.persistFailures()
      return false
    }
    delete this.failures[throttleKey]
    await this.persistFailures()
    return true
  }

  async verifyAuthorizationPin(
    actor: AuthenticatedActor,
    pin: string,
    purpose: 'void-order' | 'cancel-table' | 'override-stock',
    ip: string,
  ): Promise<{ id: string; name: string } | null> {
    const throttleKey = `authorization-pin:${actor.storeId}:${actor.userId}:${ip}`
    const failure = this.failures[throttleKey]
    if ((failure?.lockedUntil ?? 0) > Date.now()) {
      throw Object.assign(new Error('Too many failed PIN attempts. Try again later.'), { status: 429 })
    }

    const state = await this.storage.readStore(actor.storeId)
    const users = Object.values(state.collections.users ?? {}) as unknown as HubUser[]
    const store = state.collections.stores?.[actor.storeId] as
      | { settings?: { orderRules?: { stockOverrideRoles?: { admin?: boolean; manager?: boolean; staff?: boolean } } } }
      | undefined
    const rules = store?.settings?.orderRules?.stockOverrideRoles
    const eligible = users.filter((user) => {
      if (!user.active || user.storeId !== actor.storeId || user.stationOnly) return false
      if (purpose === 'void-order') return user.role === 'admin' || user.permissions?.voidOrders === true
      if (purpose === 'cancel-table') return user.role === 'admin' || user.permissions?.approveOverrides === true
      const roleAllowed = user.role === 'admin'
        ? rules?.admin === true
        : user.role === 'manager'
          ? rules?.manager === true
          : rules?.staff === true
      return roleAllowed && (user.role === 'admin' || user.permissions?.overrideStock === true)
    })
    let confirmer: HubUser | undefined
    if (isValidPin(pin)) {
      for (const user of eligible) {
        if (await verifySecret(pin, user.pin)) {
          confirmer = user
          break
        }
      }
    }
    if (!confirmer) {
      const next = (failure?.count ?? 0) + 1
      this.failures[throttleKey] = {
        count: next >= MAX_FAILURES ? 0 : next,
        lockedUntil: next >= MAX_FAILURES ? Date.now() + LOCK_MS : 0,
        updatedAt: Date.now(),
      }
      await this.persistFailures()
      return null
    }

    delete this.failures[throttleKey]
    await this.persistFailures()
    return { id: confirmer.id, name: confirmer.name }
  }

  async setupOwner(
    body: Record<string, unknown>,
    setupToken: unknown,
    ip: string,
  ): Promise<{ token: string; expiresAt: string; actor: AuthenticatedActor }> {
    this.beginSetup(setupToken, ip)
    let succeeded = false
    try {
    const storeName = typeof body.storeName === 'string' ? body.storeName.trim().slice(0, 100) : ''
    const storeCode = typeof body.storeCode === 'string' ? body.storeCode.trim().toLowerCase() : ''
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const pin = typeof body.pin === 'string' ? body.pin : ''
    if (!isValidPin(pin)) throw new Error('PIN must contain 4 to 12 digits.')
    if (!storeName || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(storeCode) || !/^[a-z0-9._-]{3,64}$/.test(username) || password.length < 10) {
      throw new Error('Provide a store name/code, username, and password (10+ characters).')
    }
    if ((await this.storage.listStoreIds()).length) throw new Error('First-run owner setup is already complete.')
    const storeId = randomBytes(12).toString('hex')
    const now = new Date().toISOString()
    const store = {
      id: storeId, name: storeName, slug: storeCode, ownerName: username, ownerEmail: '', phone: '',
      address: '', city: '', icon: 'Store', iconColor: 'amber', plan: 'starter', status: 'trial',
      businessType: 'cafe', setupComplete: false, createdAt: now,
      settings: {
        taxRate: 0, taxInclusive: false, serviceCharge: 0, allowCredit: false, features: { weightItems: false },
        shiftAccess: { ...DEFAULT_SHIFT_ACCESS_SETTINGS },
        availability: {
          enabled: true, autoEightySixAtZero: true, autoReturnOnRestock: true,
          requireReason: true, reasons: ['Out of stock', 'Machine down', 'Not prepared today', 'Quality issue'],
          defaultReturnMode: 'manual', resetManualAtDayStart: false, resetManualAtFirstShift: false,
          displayStyle: 'big_red_x', showListButton: true,
          notifyStaffAboutChanges: true, showCountOnStationScreens: true,
        },
      },
    }
    const owner: HubUser = {
      id: randomBytes(12).toString('hex'), storeId, username, email: username.includes('@') ? username : `${username}@local.invalid`,
      name: username, role: 'admin', active: true, createdAt: now, salaryType: 'none', salaryAmount: 0,
      password: hashSecret(password), pin: hashSecret(pin), permissions: {},
    }
    await this.storage.replaceStore(storeId, {
      storeId, seq: 1, appliedOpIds: [], collections: {
        stores: { [storeId]: store },
        users: { [owner.id]: owner },
      },
    })
    succeeded = true
    const token = randomBytes(32).toString('base64url')
    const expiresAt = Date.now() + SESSION_MS
    const actor: AuthenticatedActor = { storeId, userId: owner.id, role: 'admin', permissions: {}, stationOnly: false }
    this.sessions.set(hashToken(token), { actor, expiresAt })
    return { token, expiresAt: new Date(expiresAt).toISOString(), actor }
    } finally {
      this.finishSetup(succeeded)
    }
  }

  authenticate(token: string | undefined): AuthenticatedActor | null {
    if (!token) return null
    const key = hashToken(token)
    const session = this.sessions.get(key)
    if (!session) return null
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(key)
      return null
    }
    return session.actor
  }

  async refreshActor(actor: AuthenticatedActor): Promise<AuthenticatedActor | null> {
    if (actor.deviceToken) return null
    const state = await this.storage.readStore(actor.storeId)
    return actorFromState(state, actor.userId)
  }

  revoke(token: string): void {
    this.sessions.delete(hashToken(token))
  }

  async pair(storeCode: string, enteredCode: string, ip: string): Promise<{ token: string; storeId: string; deviceId: string; stationIds: string[] }> {
    const throttleKey = `${storeCode.toLowerCase()}:${ip}`
    const previousFailure = this.pairFailures.get(throttleKey)
    if ((previousFailure?.lockedUntil ?? 0) > Date.now()) throw Object.assign(new Error('Too many pairing attempts. Try again later.'), { status: 429 })
    const storeId = await this.findStoreId(storeCode)
    if (!storeId || !/^\d{6}$/.test(enteredCode)) return this.failPairing(throttleKey)
    const state = await this.storage.readStore(storeId)
    const devices = Object.values(state.collections.stationDevices ?? {}) as Array<Record<string, unknown>>
    const device = devices.find((candidate) =>
      candidate.active === true && !candidate.pairedAt && candidate.pairingCode === enteredCode &&
      typeof candidate.pairingCodeExpiresAt === 'string' && Date.parse(candidate.pairingCodeExpiresAt) > Date.now() &&
      candidate.storeId === storeId && Array.isArray(candidate.stationIds),
    )
    if (!device || typeof device.id !== 'string') return this.failPairing(throttleKey)
    const stations = Object.values(state.collections.stations ?? {}) as Array<Record<string, unknown>>
    const stationIds = (device.stationIds as unknown[]).filter((id): id is string =>
      typeof id === 'string' && stations.some((station) => station.id === id && station.active === true && station.screen === true && station.storeId === storeId),
    )
    if (!stationIds.length) return this.failPairing(throttleKey)
    const token = randomBytes(32).toString('base64url')
    const updated = {
      id: device.id,
      ...device,
      pairedAt: new Date().toISOString(),
      pairingCode: undefined,
      pairingCodeExpiresAt: undefined,
      deviceTokenHash: hashDeviceToken(token),
    }
    const updatedState: HubStoreState = {
      ...state,
      seq: state.seq + 1,
      collections: { ...state.collections, stationDevices: { ...state.collections.stationDevices, [device.id]: updated } },
    }
    await this.storage.replaceStore(storeId, updatedState)
    this.deviceStoreIds.set(device.id, storeId)
    this.pairFailures.delete(throttleKey)
    return { token, storeId, deviceId: device.id, stationIds }
  }

  async authenticateDevice(deviceId: string, token: string): Promise<AuthenticatedActor | null> {
    const storeId = this.deviceStoreIds.get(deviceId)
    if (!storeId) return null
    const state = await this.storage.readStore(storeId)
    const device = state.collections.stationDevices?.[deviceId] as Record<string, unknown> | undefined
    if (!device || device.active !== true || typeof device.deviceTokenHash !== 'string' ||
      !Array.isArray(device.stationIds)) return null
    let upgradeHash = false
    const storedHash = device.deviceTokenHash
    if (/^[a-f\d]{64}$/i.test(storedHash)) {
      const expected = Buffer.from(storedHash, 'hex')
      const actual = Buffer.from(hashDeviceToken(token), 'hex')
      if (!timingSafeEqual(actual, expected)) return null
    } else if (storedHash.startsWith('pbkdf2$')) {
      if (!await verifySecret(token, storedHash)) return null
      upgradeHash = true
    } else {
      return null
    }
    const stations = Object.values(state.collections.stations ?? {}) as Array<Record<string, unknown>>
    const stationIds = (device.stationIds as unknown[]).filter((id): id is string =>
      typeof id === 'string' && stations.some((station) => station.id === id && station.active === true && station.screen === true && station.storeId === storeId),
    )
    if (!stationIds.length) return null
    const now = Date.now()
    const storedLastSeen = typeof device.lastSeenAt === 'string' ? Date.parse(device.lastSeenAt) : 0
    const lastSeen = this.deviceLastSeenAt.get(deviceId) ?? (Number.isFinite(storedLastSeen) ? storedLastSeen : 0)
    if (upgradeHash || now - lastSeen > 60_000) {
      const updatedDevice = {
        ...device,
        id: deviceId,
        ...(upgradeHash ? { deviceTokenHash: hashDeviceToken(token) } : {}),
        lastSeenAt: new Date(now).toISOString(),
      }
      const changeSet: ChangeSet = {
        opId: `device${randomBytes(12).toString('hex')}`,
        deviceId: 'hub-auth',
        storeId,
        baseSeq: state.seq,
        ops: [{
          kind: 'put',
          collection: 'stationDevices',
          id: deviceId,
          document: updatedDevice,
        }],
      }
      this.deviceLastSeenAt.set(deviceId, now)
      try {
        await this.storage.transact(storeId, changeSet)
      } catch (error) {
        this.deviceLastSeenAt.delete(deviceId)
        throw error
      }
    }
    return { storeId, userId: deviceId, role: 'staff', permissions: { viewStation: true }, stationOnly: true, deviceId, stationIds, deviceToken: true }
  }

  private async findStoreId(storeCode: string): Promise<string | null> {
    const code = storeCode.trim().toLowerCase()
    for (const id of await this.storage.listStoreIds()) {
      const state = await this.storage.readStore(id)
      const store = Object.values(state.collections.stores ?? {}).find((row) => row.slug === code && row.status !== 'suspended')
      if (store) return id
    }
    return null
  }

  private failPairing(key: string): never {
    const previous = this.pairFailures.get(key)
    const count = (previous?.count ?? 0) + 1
    this.pairFailures.set(key, { count: count >= 5 ? 0 : count, lockedUntil: count >= 5 ? Date.now() + LOCK_MS : 0 })
    throw new Error('Invalid store code or pairing code.')
  }
}

export function can(actor: AuthenticatedActor, capability: string): boolean {
  if (actor.stationOnly) return capability === 'viewStation' && actor.permissions.viewStation === true
  if (actor.role === 'admin') return true
  return actor.permissions[capability] === true
}

export function requireCapability(actor: AuthenticatedActor, capability: string): void {
  if (!can(actor, capability)) throw Object.assign(new Error(`Permission denied: ${capability} is required.`), { status: 403 })
}

export function actorFromState(state: HubStoreState, userId: string): AuthenticatedActor | null {
  const user = state.collections.users?.[userId] as unknown as HubUser | undefined
  if (!user || !user.active || user.storeId !== state.storeId) return null
  return { storeId: state.storeId, userId, role: user.role, permissions: user.permissions ?? {}, stationOnly: user.stationOnly === true }
}

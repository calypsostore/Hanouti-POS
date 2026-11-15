import { createHash, randomBytes, timingSafeEqual, pbkdf2Sync } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AuthenticatedActor, HubStoreState, HubUser } from './types.ts'
import type { HubStorage } from './storage.ts'

const SESSION_MS = 12 * 60 * 60 * 1000
const LOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 5

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function verifySecret(secret: string, stored: unknown): boolean {
  if (typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false
  try {
    const salt = Buffer.from(parts[2], 'base64')
    const expected = Buffer.from(parts[3], 'base64')
    if (!salt.length || expected.length !== 32) return false
    const actual = pbkdf2Sync(secret, salt, iterations, expected.length, 'sha256')
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
  private failures: Record<string, { count: number; lockedUntil: number }> = {}
  private pairFailures = new Map<string, { count: number; lockedUntil: number }>()
  private setupInProgress = false
  private readonly failureFile: string

  private readonly storage: HubStorage

  constructor(storage: HubStorage) {
    this.storage = storage
    this.failureFile = join(storage.root, 'auth-lockouts.json')
  }

  async initialize(): Promise<void> {
    try {
      this.failures = JSON.parse(await readFile(this.failureFile, 'utf8')) as typeof this.failures
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  private async persistFailures(): Promise<void> {
    await mkdir(this.storage.root, { recursive: true })
    await writeFile(this.failureFile, JSON.stringify(this.failures), { encoding: 'utf8', mode: 0o600 })
  }

  async login(storeCode: string, username: string, secret: string, ip: string): Promise<{ token: string; expiresAt: string; actor: AuthenticatedActor }> {
    const throttleKey = `${storeCode.toLowerCase()}:${username.toLowerCase()}:${ip}`
    const failure = this.failures[throttleKey]
    if (failure?.lockedUntil > Date.now()) throw Object.assign(new Error('Too many failed sign-in attempts. Try again later.'), { status: 429 })
    const storeId = await this.findStoreId(storeCode)
    const state = storeId ? await this.storage.readStore(storeId) : undefined
    const users = (state?.collections.users ? Object.values(state.collections.users) : []) as unknown as HubUser[]
    const user = users.find((candidate) =>
      candidate.active && candidate.storeId === storeId &&
      [candidate.username, candidate.email].some((value) => typeof value === 'string' && value.toLowerCase() === username.toLowerCase()),
    )
    const valid = !!user && !!storeId && (verifySecret(secret, user.password) || verifySecret(secret, user.pin))
    if (!valid || !user || !storeId) {
      const next = (failure?.count ?? 0) + 1
      this.failures[throttleKey] = { count: next >= MAX_FAILURES ? 0 : next, lockedUntil: next >= MAX_FAILURES ? Date.now() + LOCK_MS : 0 }
      await this.persistFailures()
      throw Object.assign(new Error('Invalid store code, username, or password/PIN.'), { status: 401 })
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

  async verifyPin(actor: AuthenticatedActor, pin: string, ip: string): Promise<boolean> {
    const throttleKey = `pin:${actor.storeId}:${actor.userId}:${ip}`
    const failure = this.failures[throttleKey]
    if (failure?.lockedUntil > Date.now()) {
      throw Object.assign(new Error('Too many failed PIN attempts. Try again later.'), { status: 429 })
    }
    const state = await this.storage.readStore(actor.storeId)
    const user = state.collections.users?.[actor.userId] as HubUser | undefined
    const valid = !!user && user.active && user.storeId === actor.storeId &&
      /^\d{4,12}$/.test(pin) && verifySecret(pin, user.pin)
    if (!valid) {
      const next = (failure?.count ?? 0) + 1
      this.failures[throttleKey] = {
        count: next >= MAX_FAILURES ? 0 : next,
        lockedUntil: next >= MAX_FAILURES ? Date.now() + LOCK_MS : 0,
      }
      await this.persistFailures()
      return false
    }
    delete this.failures[throttleKey]
    await this.persistFailures()
    return true
  }

  async setupOwner(body: Record<string, unknown>): Promise<{ token: string; expiresAt: string; actor: AuthenticatedActor }> {
    if (this.setupInProgress) throw Object.assign(new Error('First-run owner setup is already in progress.'), { status: 409 })
    this.setupInProgress = true
    try {
    const storeName = typeof body.storeName === 'string' ? body.storeName.trim().slice(0, 100) : ''
    const storeCode = typeof body.storeCode === 'string' ? body.storeCode.trim().toLowerCase() : ''
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const pin = typeof body.pin === 'string' ? body.pin : ''
    if (!storeName || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(storeCode) || !/^[a-z0-9._-]{3,64}$/.test(username) || password.length < 10 || pin.length < 4 || pin.length > 12) {
      throw new Error('Provide a store name/code, username, password (10+ characters), and PIN (4-12 characters).')
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
        availability: {
          enabled: true, autoEightySixAtZero: true, autoReturnOnRestock: true,
          requireReason: true, reasons: ['Out of stock', 'Machine down', 'Not prepared today', 'Quality issue'],
          defaultReturnMode: 'manual', resetManualAtDayStart: false, resetManualAtFirstShift: false,
          displayStyle: 'big_red_x', showListButton: true,
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
    const token = randomBytes(32).toString('base64url')
    const expiresAt = Date.now() + SESSION_MS
    const actor: AuthenticatedActor = { storeId, userId: owner.id, role: 'admin', permissions: {}, stationOnly: false }
    this.sessions.set(hashToken(token), { actor, expiresAt })
    return { token, expiresAt: new Date(expiresAt).toISOString(), actor }
    } finally {
      this.setupInProgress = false
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
    if (previousFailure && previousFailure.lockedUntil > Date.now()) throw Object.assign(new Error('Too many pairing attempts. Try again later.'), { status: 429 })
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
      deviceTokenHash: hashSecret(token),
    }
    const updatedState: HubStoreState = {
      ...state,
      seq: state.seq + 1,
      collections: { ...state.collections, stationDevices: { ...state.collections.stationDevices, [device.id]: updated } },
    }
    await this.storage.replaceStore(storeId, updatedState)
    this.pairFailures.delete(throttleKey)
    return { token, storeId, deviceId: device.id, stationIds }
  }

  async authenticateDevice(deviceId: string, token: string): Promise<AuthenticatedActor | null> {
    for (const storeId of await this.storage.listStoreIds()) {
      const state = await this.storage.readStore(storeId)
      const device = state.collections.stationDevices?.[deviceId] as Record<string, unknown> | undefined
      if (!device || device.active !== true || typeof device.deviceTokenHash !== 'string' ||
        !verifySecret(token, device.deviceTokenHash) || !Array.isArray(device.stationIds)) continue
      const stations = Object.values(state.collections.stations ?? {}) as Array<Record<string, unknown>>
      const stationIds = (device.stationIds as unknown[]).filter((id): id is string =>
        typeof id === 'string' && stations.some((station) => station.id === id && station.active === true && station.screen === true && station.storeId === storeId),
      )
      if (!stationIds.length) return null
      const lastSeen = typeof device.lastSeenAt === 'string' ? Date.parse(device.lastSeenAt) : 0
      if (Date.now() - lastSeen > 60_000) {
        await this.storage.replaceStore(storeId, {
          ...state,
          seq: state.seq + 1,
          collections: {
            ...state.collections,
            stationDevices: {
              ...state.collections.stationDevices,
              [deviceId]: { ...device, id: deviceId, lastSeenAt: new Date().toISOString() },
            },
          },
        })
      }
      return { storeId, userId: deviceId, role: 'staff', permissions: { viewStation: true }, stationOnly: true, deviceId, stationIds, deviceToken: true }
    }
    return null
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

import { mergeHubSnapshot, type ChangeSet, type HubSnapshot } from '../../shared/sync'
import type { Database, PrintJob } from '../../types'
import { readIndexedValue, writeIndexedValue } from '../../lib/storage'
import { verifySecret } from '../../lib/hash'
import type { Result } from '../types'
import type { AuthorizationPinPurpose, AuthorizationPinResult } from '../../lib/authorizationPin'

export type ProviderMode = 'local' | 'hub'
export type HubConnectionState = 'connected' | 'offline' | 'internet-offline'

export interface ProviderStatus {
  mode: ProviderMode
  connection: HubConnectionState
  pendingCount: number
  pendingPrintCount: number
  printerStatuses: Record<string, 'online' | 'offline' | 'error'>
  printerOfflineSince: Record<string, string>
  lastBackupAt?: string | null
  backupHealthError?: string
  failedPrintCount: number
  lastError?: string
  conflicts: string[]
}

export interface DataProvider {
  readonly mode: ProviderMode
  status(): ProviderStatus
  subscribe(listener: () => void): () => void
  start(): Promise<void>
  hasSession(): boolean
  currentSequence(): number
  deviceIdentifier(): string
  queueChangeSet(changeSet: ChangeSet): Promise<void>
  queuePrint(job: PrintJob): Promise<Result>
  canFallbackPrint(jobId: string): boolean
  beginLocalPrintFallback(jobId: string): boolean
  finishLocalPrintFallback(jobId: string, printed: boolean): Promise<boolean>
  login(storeCode: string, username: string, secret: string): Promise<
    { ok: true; userId: string } | { ok: false; error: string; offline?: boolean }
  >
  verifyPin(pin: string, storedHash?: string): Promise<boolean>
  verifyAuthorizationPin(
    pin: string,
    storeId: string,
    purpose: AuthorizationPinPurpose,
  ): Promise<AuthorizationPinResult>
  pullSnapshot(): Promise<{ database: Database; seq: number } | null>
  logout(): void
  useSnapshot(listener: (database: Database, seq: number) => void): () => void
  setCache(database: Database): void
  acknowledgeConflicts(): void
}

const OUTBOX_KEY = '7anouti.hub.outbox.v1'
const DEVICE_KEY = '7anouti.hub.device.v1'
const TOKEN_KEY = '7anouti.hub.session.v1'
const STORE_CODE_KEY = '7anouti.hub.store-code.v1'
const SEQ_KEY = '7anouti.hub.sequence.v1'
const CONFLICTS_KEY = '7anouti.hub.conflicts.v1'
type OutboxEntry =
  | { kind: 'change'; key: string; createdAt: number; attempts: number; retryAt: number; lastError?: string; payload: ChangeSet }
  | { kind: 'print'; key: string; createdAt: number; attempts: number; retryAt: number; lastError?: string; payload: PrintJob }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

class HubRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const randomId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export class LocalProvider implements DataProvider {
  readonly mode = 'local' as const
  private listeners = new Set<() => void>()
  private connection: HubConnectionState = 'offline'

  status(): ProviderStatus {
    return {
      mode: this.mode,
      connection: this.connection,
      pendingCount: 0,
      pendingPrintCount: 0,
      printerStatuses: {},
      printerOfflineSince: {},
      backupHealthError: undefined,
      failedPrintCount: 0,
      conflicts: [],
    }
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  async start(): Promise<void> {}
  hasSession(): boolean { return false }
  currentSequence(): number { return 0 }
  deviceIdentifier(): string { return 'local-device' }
  async queueChangeSet(): Promise<void> {}
  async queuePrint(): Promise<Result> {
    return { ok: false, error: 'The shop hub is not connected.' }
  }
  canFallbackPrint(): boolean { return false }
  beginLocalPrintFallback(): boolean { return false }
  async finishLocalPrintFallback(): Promise<boolean> { return false }
  async login(): Promise<{ ok: false; error: string }> {
    return { ok: false, error: 'Hub login is unavailable in local mode.' }
  }
  async verifyPin(pin: string, storedHash?: string): Promise<boolean> {
    return typeof storedHash === 'string' && verifySecret(pin, storedHash)
  }
  async verifyAuthorizationPin(): Promise<AuthorizationPinResult> {
    return { ok: false, error: 'Authorization PIN verification is unavailable.' }
  }
  async pullSnapshot(): Promise<null> {
    return null
  }
  logout(): void {}
  useSnapshot(): () => void {
    return () => {}
  }
  setCache(): void {}
  acknowledgeConflicts(): void {}
}

export class HubProvider implements DataProvider {
  readonly mode = 'hub' as const
  private listeners = new Set<() => void>()
  private snapshotListeners = new Set<(database: Database, seq: number) => void>()
  private token: string | null = null
  private deviceId = ''
  private outbox: OutboxEntry[] = []
  private connection: HubConnectionState = 'offline'
  private printerStatuses: ProviderStatus['printerStatuses'] = {}
  private printerOfflineSince: ProviderStatus['printerOfflineSince'] = {}
  private lastBackupAt: string | null | undefined
  private lastBackupHealthCheckAt = 0
  private backupHealthError: string | undefined
  private failedPrintCount = 0
  private lastError: string | undefined
  private conflicts: string[] = []
  private sequence = 0
  private lastAppliedSnapshotSeq = 0
  private pollTimer: number | undefined
  private retryTimer: number | undefined
  private socketRetryTimer: number | undefined
  private socketRetryDelay = 1000
  private socket: WebSocket | null = null
  private started = false
  private flushing = false
  private fallbackReservations = new Set<string>()
  private snapshotRequest: Promise<{ database: Database; seq: number } | null> | null = null
  private cache: Database | null = null
  private onError: (message: string) => void

  constructor(onError: (message: string) => void, cache: Database) {
    this.onError = onError
    this.cache = cache
  }

  status(): ProviderStatus {
    return {
      mode: this.mode,
      connection: this.connection,
      pendingCount: this.outbox.length,
      pendingPrintCount: this.outbox.filter((entry) => entry.kind === 'print').length,
      printerStatuses: this.printerStatuses,
      printerOfflineSince: this.printerOfflineSince,
      lastBackupAt: this.lastBackupAt,
      backupHealthError: this.backupHealthError,
      failedPrintCount: this.failedPrintCount,
      lastError: this.lastError,
      conflicts: this.conflicts,
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  useSnapshot(listener: (database: Database, seq: number) => void): () => void {
    this.snapshotListeners.add(listener)
    return () => this.snapshotListeners.delete(listener)
  }

  setCache(database: Database): void {
    this.cache = database
  }

  async start(): Promise<void> {
    this.started = true
    this.token = this.readLocal(TOKEN_KEY)
    this.deviceId = this.readLocal(DEVICE_KEY) ?? randomId()
    this.writeLocal(DEVICE_KEY, this.deviceId)
    try {
      const rawOutbox = await readIndexedValue(OUTBOX_KEY)
      if (rawOutbox) {
        const parsed: unknown = JSON.parse(rawOutbox)
        if (Array.isArray(parsed)) {
          this.outbox = parsed.filter((entry): entry is OutboxEntry =>
            !!entry && typeof entry === 'object' &&
            ['change', 'print'].includes(String((entry as OutboxEntry).kind)) &&
            typeof (entry as OutboxEntry).key === 'string',
          )
        }

      }
      const rawSequence = this.readLocal(SEQ_KEY)
      this.sequence = rawSequence && /^\d+$/.test(rawSequence) ? Number(rawSequence) : 0
      const rawConflicts = await readIndexedValue(CONFLICTS_KEY)
      if (rawConflicts) {
        const parsed: unknown = JSON.parse(rawConflicts)
        if (Array.isArray(parsed)) this.conflicts = parsed.filter((item): item is string => typeof item === 'string')
      }
    } catch (error) {
      this.onError(`Could not load the offline sync queue: ${this.errorMessage(error)}`)
    }
    this.connection = await this.probeHub() ? 'connected' : 'offline'
    window.addEventListener('online', this.handleConnectivity)
    window.addEventListener('offline', this.handleConnectivity)
    this.pollTimer = window.setInterval(() => { void this.poll() }, 2500)
    this.retryTimer = window.setInterval(() => { void this.flushOutbox() }, 1000)
    window.addEventListener('beforeunload', this.stop, { once: true })
    this.emit()
    if (this.token) {
      this.connectWebSocket()
      const snapshot = await this.pullSnapshot()
      if (snapshot) this.notifySnapshot(snapshot.database, snapshot.seq)
    }
  }

  hasSession(): boolean {
    return this.token !== null
  }
  currentSequence(): number {
    return this.sequence
  }
  deviceIdentifier(): string {
    return this.deviceId
  }

  private stop = () => {
    this.started = false
    if (this.pollTimer !== undefined) window.clearInterval(this.pollTimer)
    if (this.retryTimer !== undefined) window.clearInterval(this.retryTimer)
    if (this.socketRetryTimer !== undefined) window.clearTimeout(this.socketRetryTimer)
    window.removeEventListener('online', this.handleConnectivity)
    window.removeEventListener('offline', this.handleConnectivity)
    const socket = this.socket
    this.socket = null
    socket?.close()
  }

  async queueChangeSet(changeSet: ChangeSet): Promise<void> {
    if (!changeSet.ops.length) return
    this.outbox.push({
      kind: 'change',
      key: changeSet.opId,
      createdAt: Date.now(),
      attempts: 0,
      retryAt: 0,
      lastError: undefined,
      payload: changeSet,
    })
    await this.persistOutbox()
    this.emit()
    void this.flushOutbox()
  }

  async queuePrint(job: PrintJob): Promise<Result> {
    const key = job.id
    if (!this.outbox.some((entry) => entry.kind === 'print' && entry.key === key)) {
      this.outbox.push({ kind: 'print', key, createdAt: Date.now(), attempts: 0, retryAt: 0, lastError: undefined, payload: job })
      await this.persistOutbox()
      this.emit()
    }
    if (this.connection !== 'offline') await this.flushOutbox()
    const pending = this.outbox.find((entry) => entry.kind === 'print' && entry.key === key)
    if (pending) {
      return {
        ok: false,
        error: pending.attempts === 0
          ? 'The hub is offline. This print is queued on this device; print here instead or reconnect to the hub.'
          : `The hub has not confirmed this print. It remains queued to avoid a duplicate.${pending.lastError ? ` ${pending.lastError}` : ''}`,
      }
    }
    return { ok: true }
  }

  canFallbackPrint(jobId: string): boolean {
    const queued = this.outbox.find((entry) => entry.kind === 'print' && entry.key === jobId)
    return !this.flushing && !this.fallbackReservations.has(jobId) && queued?.attempts === 0
  }

  beginLocalPrintFallback(jobId: string): boolean {
    if (!this.canFallbackPrint(jobId)) return false
    this.fallbackReservations.add(jobId)
    return true
  }

  async finishLocalPrintFallback(jobId: string, printed: boolean): Promise<boolean> {
    if (!this.fallbackReservations.delete(jobId)) return false
    if (printed) {
      this.outbox = this.outbox.filter((entry) => entry.kind !== 'print' || entry.key !== jobId)
      await this.persistOutbox()
    }
    this.emit()
    return true
  }

  acknowledgeConflicts(): void {
    this.conflicts = []
    void writeIndexedValue(CONFLICTS_KEY, JSON.stringify(this.conflicts)).then(
      () => this.emit(),
      (error: unknown) => this.onError(`Could not save conflict acknowledgements: ${this.errorMessage(error)}`),
    )
  }

  async login(
    storeCode: string,
    username: string,
    secret: string,
  ): Promise<{ ok: true; userId: string } | { ok: false; error: string; offline?: boolean }> {
    const code = storeCode.trim().toLowerCase()
    if (!code) return { ok: false, error: 'Enter your store code to sign in to the hub.' }
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeCode: code, username: username.trim(), secret }),
      })
      const body = await this.readResponse(response)
      if (!response.ok) return { ok: false, error: typeof body.error === 'string' ? body.error : 'Hub sign-in failed.' }
      if (typeof body.token !== 'string' || typeof body.actor !== 'object' || body.actor === null ||
        typeof (body.actor as Record<string, unknown>).userId !== 'string') {
        return { ok: false, error: 'The hub returned an invalid sign-in response.' }
      }
      this.token = body.token
      this.writeLocal(TOKEN_KEY, body.token)
      this.writeLocal(STORE_CODE_KEY, code)
      this.connection = 'connected'
      this.lastBackupAt = undefined
      this.lastBackupHealthCheckAt = 0
      this.backupHealthError = undefined
      this.emit()
      this.connectWebSocket()
      await this.flushOutbox()
      const snapshot = await this.pullSnapshot()
      if (!snapshot) return { ok: false, error: 'Signed in, but the hub snapshot could not be loaded.' }
      this.notifySnapshot(snapshot.database, snapshot.seq)
      return { ok: true, userId: (body.actor as Record<string, unknown>).userId as string }
    } catch (error) {
      this.setConnection('offline')
      return { ok: false, error: this.errorMessage(error), offline: true }
    }
  }

  async verifyPin(pin: string): Promise<boolean> {
    const result = await this.request('/api/auth/verify-pin', { pin })
    return result.verified === true
  }

  async verifyAuthorizationPin(
    pin: string,
    storeId: string,
    purpose: AuthorizationPinPurpose,
  ): Promise<AuthorizationPinResult> {
    const result = await this.request('/api/auth/verify-authorization-pin', { pin, storeId, purpose })
    if (result.verified !== true || !isRecord(result.confirmer) ||
        typeof result.confirmer.id !== 'string' || typeof result.confirmer.name !== 'string') {
      return { ok: false, error: 'That PIN does not belong to an active authorized manager.' }
    }
    return { ok: true, confirmer: { id: result.confirmer.id, name: result.confirmer.name } }
  }

  async pullSnapshot(): Promise<{ database: Database; seq: number } | null> {
    if (!this.token) return null
    if (this.snapshotRequest) return this.snapshotRequest
    this.snapshotRequest = this.request('/api/sync/snapshot').then(async (body) => {
      if (!body || !Number.isSafeInteger(body.seq) || !body.collections || typeof body.collections !== 'object') {
        throw new Error('The hub returned an invalid database snapshot.')
      }
      const database = this.snapshotToDatabase(body as unknown as HubSnapshot)
      this.sequence = Math.max(this.sequence, Number(body.seq))
      this.writeLocal(SEQ_KEY, String(this.sequence))
      this.cache = database
      return { database, seq: this.sequence }
    }).catch(() => {
      this.setConnection('offline')
      return null
    }).finally(() => { this.snapshotRequest = null })
    return this.snapshotRequest
  }

  logout(): void {
    const token = this.token
    this.token = null
    if (this.socketRetryTimer !== undefined) window.clearTimeout(this.socketRetryTimer)
    this.socketRetryTimer = undefined
    const socket = this.socket
    this.socket = null
    socket?.close()
    this.removeLocal(TOKEN_KEY)
    this.removeLocal(STORE_CODE_KEY)
    this.lastBackupAt = undefined
    this.lastBackupHealthCheckAt = 0
    this.backupHealthError = undefined
    if (token) {
      void fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch((error: unknown) => this.onError(`Could not sign out from the hub: ${this.errorMessage(error)}`))
    }
    this.emit()
  }

  private handleConnectivity = () => {
    void this.poll()
    if (navigator.onLine) this.connectWebSocket()
  }

  private async poll(): Promise<void> {
    const reachable = await this.probeHub()
    this.setConnection(reachable
      ? navigator.onLine ? 'connected' : 'internet-offline'
      : 'offline')
    if (!reachable || !this.token) return
    this.connectWebSocket()
    const previousSnapshotSeq = this.lastAppliedSnapshotSeq
    await this.flushOutbox()
    try {
      const status = await this.request('/api/printers/status')
      const map = status.printers
      if (map && typeof map === 'object') {
        this.printerStatuses = map as ProviderStatus['printerStatuses']
      }
      const offlineSince = status.offlineSince
      this.printerOfflineSince = offlineSince && typeof offlineSince === 'object'
        ? offlineSince as ProviderStatus['printerOfflineSince']
        : {}
      const jobs = await this.request('/api/print/jobs')
      if (Array.isArray(jobs.jobs)) this.failedPrintCount = jobs.jobs.filter((job) =>
        !!job && typeof job === 'object' && (job as Record<string, unknown>).status === 'failed',
      ).length
      if (Date.now() - this.lastBackupHealthCheckAt >= 5 * 60_000) {
        this.lastBackupHealthCheckAt = Date.now()
        this.backupHealthError = undefined
        try {
          const backupHealth = await this.request('/api/backup/health')
          this.lastBackupAt = typeof backupHealth.lastBackupAt === 'string'
            ? backupHealth.lastBackupAt
            : null
        } catch (error) {
          this.backupHealthError = this.errorMessage(error)
        }
      }
      const snapshot = await this.pullSnapshot()
      if (snapshot && snapshot.seq > previousSnapshotSeq) {
        if (!this.outbox.length) this.notifySnapshot(snapshot.database, snapshot.seq)
      }
      this.emit()
    } catch {
      this.setConnection('offline')
    }
  }

  private async flushOutbox(): Promise<void> {
    if (this.flushing || !this.token || !this.outbox.length) return
    this.flushing = true
    try {
      while (this.outbox.length && this.token) {
        const entry = this.outbox[0]
        if (!entry || entry.retryAt > Date.now()) break
        if (entry.kind === 'print' && this.fallbackReservations.has(entry.key)) break
        try {
          if (entry.kind === 'change') {
            const result = await this.request('/api/sync', entry.payload)
            if (Number.isSafeInteger(result.seq)) {
              this.sequence = Math.max(this.sequence, Number(result.seq))
              this.writeLocal(SEQ_KEY, String(this.sequence))
            }
            if (Array.isArray(result.conflicts)) {
              const found = result.conflicts.flatMap((item) => {
                if (!item || typeof item !== 'object') return []
                const conflict = item as Record<string, unknown>
                return typeof conflict.label === 'string'
                  ? [`${typeof conflict.collection === 'string' ? conflict.collection : 'menu'}: ${conflict.label}`]
                  : []
              })
              this.conflicts = [...new Set([...this.conflicts, ...found])]
              if (found.length) await writeIndexedValue(CONFLICTS_KEY, JSON.stringify(this.conflicts))
            }
          } else {
            await this.request('/api/print', {
              storeId: entry.payload.storeId,
              printerId: entry.payload.printerId,
              type: entry.payload.type,
              stationId: entry.payload.stationId,
              payload: entry.payload.payload,
              copies: entry.payload.copies,
              openDrawer: entry.payload.openDrawer,
              opId: entry.key,
            })
          }
          this.outbox.shift()
          await this.persistOutbox()
          this.lastError = undefined
          this.setConnection('connected')
        } catch (error) {
          entry.attempts += 1
          entry.lastError = this.errorMessage(error)
          this.lastError = entry.lastError
          const permanent = error instanceof HubRequestError && error.status >= 400 && error.status < 500
          entry.retryAt = permanent
            ? Number.MAX_SAFE_INTEGER
            : Date.now() + Math.min(300_000, 1000 * (2 ** Math.min(entry.attempts - 1, 8)))
          if (permanent) this.setConnection('connected')
          await this.persistOutbox()
          if (!permanent && this.connection !== 'offline') this.setConnection('offline')
          break
        }
      }
    } finally {
      this.flushing = false
      this.emit()
    }
  }

  private async probeHub(): Promise<boolean> {
    try {
      const response = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(1500) })
      return response.ok
    } catch {
      return false
    }
  }

  private async request(path: string, body?: unknown): Promise<Record<string, unknown>> {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    const result = await this.readResponse(response)
    if (!response.ok) throw new HubRequestError(
      typeof result.error === 'string' ? result.error : `Hub request failed (${response.status}).`,
      response.status,
    )
    return result
  }

  private async readResponse(response: Response): Promise<Record<string, unknown>> {
    let result: unknown
    try {
      result = await response.json()
    } catch {
      throw new Error('The hub returned an invalid response.')
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('The hub returned an invalid response.')
    }
    return result as Record<string, unknown>
  }

  private snapshotToDatabase(snapshot: HubSnapshot): Database {
    const database = this.cache
    if (!database) throw new Error('The offline database cache is not ready.')
    return mergeHubSnapshot(database, snapshot)
  }

  private connectWebSocket(): void {
    const token = this.token
    if (!this.started || !token || this.socket || typeof WebSocket === 'undefined') return
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${scheme}//${window.location.host}/ws`)
    this.socket = socket
    socket.addEventListener('open', () => {
      if (this.token !== token) {
        socket.close()
        return
      }
      socket.send(JSON.stringify({ type: 'auth', token }))
    })
    socket.addEventListener('message', (event) => {
      try {
        const message: unknown = JSON.parse(String(event.data))
        if (!message || typeof message !== 'object') throw new Error('Invalid live update from the hub.')
        const update = message as Record<string, unknown>
        if (update.type === 'connected') {
          this.socketRetryDelay = 1000
          this.lastError = undefined
          return
        }
        if (update.type === 'sync' || update.type === 'station-status') {
          void this.refreshLiveSnapshot()
          return
        }
        if (update.type === 'error') {
          this.lastError = typeof update.error === 'string' ? update.error : 'Hub live connection failed.'
          this.emit()
          socket.close()
        }
      } catch (error) {
        this.lastError = this.errorMessage(error)
        this.emit()
        socket.close()
      }
    })
    socket.addEventListener('close', () => {
      if (this.socket === socket) this.socket = null
      if (this.started && this.token === token) this.scheduleWebSocketRetry()
    })
    socket.addEventListener('error', () => {
      this.lastError = 'Hub live connection failed; retrying.'
      this.emit()
      socket.close()
    })
  }

  private scheduleWebSocketRetry(): void {
    if (this.socketRetryTimer !== undefined || !this.started || !this.token) return
    const delay = this.socketRetryDelay
    this.socketRetryDelay = Math.min(15_000, this.socketRetryDelay * 2)
    this.socketRetryTimer = window.setTimeout(() => {
      this.socketRetryTimer = undefined
      this.connectWebSocket()
    }, delay)
  }

  private async refreshLiveSnapshot(): Promise<void> {
    const previousSnapshotSeq = this.lastAppliedSnapshotSeq
    if (this.outbox.length) await this.flushOutbox()
    const snapshot = await this.pullSnapshot()
    if (snapshot && snapshot.seq > previousSnapshotSeq && !this.outbox.length) {
      this.notifySnapshot(snapshot.database, snapshot.seq)
    }
  }

  private async persistOutbox(): Promise<void> {
    try {
      await writeIndexedValue(OUTBOX_KEY, JSON.stringify(this.outbox))
    } catch (error) {
      this.onError(`Could not save pending hub changes: ${this.errorMessage(error)}`)
      throw error
    }
  }

  private notifySnapshot(database: Database, seq: number): void {
    this.lastAppliedSnapshotSeq = Math.max(this.lastAppliedSnapshotSeq, seq)
    for (const listener of this.snapshotListeners) listener(database, seq)
  }

  private setConnection(connection: HubConnectionState): void {
    if (this.connection === connection) return
    this.connection = connection
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  private readLocal(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  }

  private writeLocal(key: string, value: string): void {
    try { localStorage.setItem(key, value) } catch (error) {
      this.onError(`Could not save hub session information: ${this.errorMessage(error)}`)
    }
  }

  private removeLocal(key: string): void {
    try { localStorage.removeItem(key) } catch (error) {
      this.onError(`Could not clear hub session information: ${this.errorMessage(error)}`)
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'The hub could not be reached.'
  }
}

export async function detectDataProvider(
  onError: (message: string) => void,
  cache: Database,
): Promise<DataProvider> {
  try {
    const response = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(1500) })
    if (response.ok) {
      const provider = new HubProvider(onError, cache)
      await provider.start()
      return provider
    }
  } catch {
    // The local provider is the intentional standalone fallback.
  }
  const provider = new LocalProvider()
  await provider.start()
  return provider
}

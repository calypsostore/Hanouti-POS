import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyChangeSet } from '../../src/shared/sync.ts'
import type { ChangeSet, SyncDocument } from '../../src/shared/sync.ts'
import type { HubStoreState, PersistedChange } from './types.ts'
import { validId } from './validation.ts'

const EMPTY = (storeId: string): HubStoreState => ({ storeId, seq: 0, collections: {}, appliedOpIds: [] })
const COMPACT_AFTER_CHANGES = 100
const COMPACT_AT_BYTES = 1_048_576

interface CachedStore {
  state: HubStoreState
  snapshotSeq: number
  changes: PersistedChange[]
}

interface ChangesSinceResult {
  changes: PersistedChange[]
  fullResyncRequired: boolean
}

export class HubStorage {
  readonly root: string
  private readonly queues = new Map<string, Promise<void>>()
  private readonly cache = new Map<string, CachedStore>()

  constructor(root = process.env.HUB_DATA_DIR ?? fileURLToPath(new URL('../data/', import.meta.url))) {
    this.root = resolve(root)
  }

  async initialize(): Promise<void> {
    await mkdir(join(this.root, 'stores'), { recursive: true })
    await mkdir(join(this.root, 'backups'), { recursive: true })
  }

  private storePath(storeId: string): string {
    if (!validId(storeId)) throw new Error('Invalid store ID.')
    return join(this.root, 'stores', `${storeId}.jsonl`)
  }

  async listStoreIds(): Promise<string[]> {
    const files = await readdir(join(this.root, 'stores'))
    return files.filter((name) => name.endsWith('.jsonl')).map((name) => name.slice(0, -6)).filter(validId)
  }

  async readStore(storeId: string): Promise<HubStoreState> {
    const cached = await this.loadStore(storeId)
    return structuredClone(cached.state)
  }

  async changesSince(storeId: string, sequence: number): Promise<ChangesSinceResult> {
    const cached = await this.loadStore(storeId)
    if (sequence < cached.snapshotSeq) return { changes: [], fullResyncRequired: true }
    return {
      changes: cached.changes.filter((change) => change.seq > sequence),
      fullResyncRequired: false,
    }
  }

  private async loadStore(storeId: string): Promise<CachedStore> {
    const cached = this.cache.get(storeId)
    if (cached) return cached
    try {
      const contents = await readFile(this.storePath(storeId), 'utf8')
      const lines = contents.split(/\r?\n/)
      const records: Array<{ index: number; value: Record<string, unknown> }> = []
      let tornLastLine = false
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]
        if (!line) continue
        try {
          const parsed: unknown = JSON.parse(line)
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Invalid persisted hub record.')
          }
          records.push({ index, value: parsed as Record<string, unknown> })
        } catch (error) {
          if (index === lines.length - 1 && !/[\r\n]$/.test(contents)) {
            tornLastLine = true
            continue
          }
          throw new Error(`Invalid persisted hub record for store ${storeId}.`, { cause: error })
        }
      }
      let state = EMPTY(storeId)
      let snapshotSeq = 0
      let snapshotIndex = -1
      for (const { index, value } of records) {
        const candidate = value.state
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
        const snapshot = candidate as HubStoreState
        if (snapshot.storeId !== storeId || !Number.isSafeInteger(snapshot.seq) ||
          !snapshot.collections || typeof snapshot.collections !== 'object') continue
        state = snapshot
        snapshotSeq = snapshot.seq
        snapshotIndex = index
      }

      const changes: PersistedChange[] = []
      for (const { index, value } of records) {
        if (index <= snapshotIndex || !Number.isSafeInteger(value.seq) ||
          !value.changeSet || typeof value.changeSet !== 'object') continue
        const changeSet = value.changeSet as PersistedChange['changeSet']
        if (changeSet.storeId !== storeId || !Array.isArray(changeSet.ops)) continue
        const next = applyChangeSet(state, changeSet) as HubStoreState
        if (next.seq !== value.seq) throw new Error(`Invalid persisted hub sequence for store ${storeId}.`)
        next.storeId = storeId
        state = next
        changes.push({ seq: next.seq, changeSet })
      }
      if (tornLastLine) {
        await this.writeSnapshot(storeId, state)
        snapshotSeq = state.seq
        changes.length = 0
      }
      const loaded = { state, snapshotSeq, changes }
      this.cache.set(storeId, loaded)
      return loaded
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        const empty = { state: EMPTY(storeId), snapshotSeq: 0, changes: [] }
        this.cache.set(storeId, empty)
        return empty
      }
      throw error
    }
  }

  async transact(storeId: string, changeSet: ChangeSet): Promise<HubStoreState> {
    const previous = this.queues.get(storeId) ?? Promise.resolve()
    let release: () => void = () => {}
    const current = new Promise<void>((resolveQueue) => { release = resolveQueue })
    this.queues.set(storeId, previous.then(() => current))
    await previous
    try {
      const state = await this.readStore(storeId)
      const next = applyChangeSet(state, changeSet) as HubStoreState
      if (next === state) return state
      next.storeId = storeId
      const record: PersistedChange = { seq: next.seq, changeSet }
      const file = this.storePath(storeId)
      await mkdir(dirname(file), { recursive: true })
      const handle = await open(file, 'a')
      try {
        await handle.appendFile(`${JSON.stringify(record)}\n`, 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
      const cached = await this.loadStore(storeId)
      cached.state = structuredClone(next)
      cached.changes.push(record)
      if (cached.changes.length >= COMPACT_AFTER_CHANGES || (await stat(file)).size >= COMPACT_AT_BYTES) {
        await this.writeSnapshot(storeId, next)
        cached.snapshotSeq = next.seq
        cached.changes = []
      }
      return next
    } finally {
      release()
    }
  }

  async replaceStore(storeId: string, state: HubStoreState): Promise<void> {
    const previous = this.queues.get(storeId) ?? Promise.resolve()
    let release: () => void = () => {}
    const current = new Promise<void>((resolveQueue) => { release = resolveQueue })
    this.queues.set(storeId, previous.then(() => current))
    await previous
    try {
      await this.writeSnapshot(storeId, state)
      this.cache.set(storeId, { state: structuredClone(state), snapshotSeq: state.seq, changes: [] })
    } finally {
      release()
    }
  }

  private async writeSnapshot(storeId: string, state: HubStoreState): Promise<void> {
    const file = this.storePath(storeId)
    await mkdir(dirname(file), { recursive: true })
    const temp = `${file}.${process.pid}.tmp`
    const handle = await open(temp, 'w', 0o600)
    try {
      await handle.writeFile(`${JSON.stringify({ type: 'snapshot', seq: state.seq, state })}\n`, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temp, file)
  }

  async saveSnapshot(name: string, storeIds: string[]): Promise<string> {
    if (!/^\d{4}-\d\d-\d\d(?:-\d{6})?$/.test(name)) throw new Error('Invalid backup name.')
    const stores: HubStoreState[] = []
    for (const id of storeIds) stores.push(await this.readStore(id))
    const target = join(this.root, 'backups', `${name}.json`)
    const temp = `${target}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), stores }), { encoding: 'utf8', mode: 0o600 })
    await rename(temp, target)
    await this.pruneBackups()
    return target
  }

  async restoreSnapshot(fileName: string, expectedStoreId?: string): Promise<string[]> {
    if (!/^\d{4}-\d\d-\d\d(?:-\d{6})?\.json$/.test(fileName)) throw new Error('Invalid backup filename.')
    const fullPath = join(this.root, 'backups', fileName)
    const backup: unknown = JSON.parse(await readFile(fullPath, 'utf8'))
    if (!backup || typeof backup !== 'object' || !Array.isArray((backup as { stores?: unknown }).stores)) {
      throw new Error('Backup file is invalid.')
    }
    const stores = (backup as { stores: unknown[] }).stores
    if (stores.length > 200) throw new Error('Backup contains too many stores.')
    const storeIds = new Set<string>()
    for (const candidate of stores) {
      if (!candidate || typeof candidate !== 'object') throw new Error('Backup contains invalid store data.')
      const state = candidate as HubStoreState
      if (!validId(state.storeId) || storeIds.has(state.storeId) || !Number.isSafeInteger(state.seq) || !state.collections || typeof state.collections !== 'object') {
        throw new Error('Backup contains invalid or duplicate store data.')
      }
      storeIds.add(state.storeId)
    }
    if (expectedStoreId && (stores.length !== 1 || (stores[0] as HubStoreState).storeId !== expectedStoreId)) {
      throw new Error('This backup does not belong exclusively to the authenticated store.')
    }
    const restored: string[] = []
    for (const candidate of stores) {
      const state = candidate as HubStoreState
      await this.replaceStore(state.storeId, state)
      restored.push(state.storeId)
    }
    return restored
  }

  async backupNow(storeIds?: string[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    return this.saveSnapshot(`${new Date().toISOString().slice(0, 10)}-${timestamp.slice(8, 14)}`, storeIds ?? await this.listStoreIds())
  }

  async pruneBackups(): Promise<void> {
    const path = join(this.root, 'backups')
    const files = (await readdir(path)).filter((name) => /^\d{4}-\d\d-\d\d(?:-\d{6})?\.json$/.test(name)).sort().reverse()
    for (const name of files.slice(14)) await rm(join(path, name))
  }

  async readBackups(): Promise<string[]> {
    return (await readdir(join(this.root, 'backups'))).filter((name) => name.endsWith('.json')).sort().reverse()
  }

  async lastBackupAt(storeId?: string): Promise<string | null> {
    let newest: { createdAt: string; timestamp: number } | null = null
    for (const filename of await this.readBackups()) {
      const backup: unknown = JSON.parse(await readFile(join(this.root, 'backups', filename), 'utf8'))
      if (!backup || typeof backup !== 'object' ||
        typeof (backup as { createdAt?: unknown }).createdAt !== 'string' ||
        !Number.isFinite(Date.parse((backup as { createdAt: string }).createdAt)) ||
        !Array.isArray((backup as { stores?: unknown }).stores)) {
        throw new Error(`Hub backup ${filename} has invalid metadata.`)
      }
      const stores = (backup as { stores: Array<{ storeId?: unknown }> }).stores
      const createdAt = (backup as { createdAt: string }).createdAt
      const timestamp = Date.parse(createdAt)
      if ((!storeId || stores.some((store) => store?.storeId === storeId)) &&
        (!newest || timestamp > newest.timestamp)) {
        newest = { createdAt, timestamp }
      }
    }
    return newest?.createdAt ?? null
  }

  async importAppBackup(backup: unknown): Promise<string[]> {
    if (!backup || typeof backup !== 'object' || !Array.isArray((backup as { stores?: unknown }).stores)) {
      throw new Error('Expected a 7anouti JSON backup containing a stores array.')
    }
    const collections = (backup as Record<string, unknown>)
    const stores = collections.stores as Array<Record<string, unknown>>
    if (!stores.length || stores.length > 200) throw new Error('Backup must contain between 1 and 200 stores.')
    const imported: string[] = []
    for (const store of stores) {
      if (!validId(store.id)) throw new Error('Backup contains a store with an invalid ID.')
      const storeId = store.id
      const byCollection: Record<string, Record<string, SyncDocument>> = {}
      for (const [collectionName, value] of Object.entries(collections)) {
        if (!Array.isArray(value)) continue
        const scoped = value.filter((row): row is Record<string, unknown> =>
          !!row && typeof row === 'object' && (collectionName === 'stores' ? row.id === storeId : row.storeId === storeId),
        )
        if (!scoped.length) continue
        byCollection[collectionName] = Object.fromEntries(scoped.filter((row): row is SyncDocument =>
          validId(row.id),
        ).map((row) => [row.id, row]))
      }
      const state: HubStoreState = { storeId, seq: 1, collections: byCollection, appliedOpIds: [] }
      await this.replaceStore(storeId, state)
      imported.push(storeId)
    }
    return imported
  }
}

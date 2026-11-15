import { mkdir, open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyChangeSet } from '../../src/shared/sync.ts'
import type { ChangeSet, SyncDocument } from '../../src/shared/sync.ts'
import type { HubStoreState, PersistedChange } from './types.ts'
import { validId } from './validation.ts'

const EMPTY = (storeId: string): HubStoreState => ({ storeId, seq: 0, collections: {}, appliedOpIds: [] })

export class HubStorage {
  readonly root: string
  private readonly queues = new Map<string, Promise<void>>()

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
    try {
      const contents = await readFile(this.storePath(storeId), 'utf8')
      const lines = contents.split(/\r?\n/).filter(Boolean)
      if (!lines.length) return EMPTY(storeId)
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        try {
          const parsed = JSON.parse(lines[index]) as PersistedChange | { state: HubStoreState }
          if (parsed.state?.storeId === storeId && Number.isSafeInteger(parsed.state.seq)) return parsed.state
        } catch {
          if (index === lines.length - 1) continue
        }
      }
      throw new Error(`Invalid persisted hub state for store ${storeId}.`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY(storeId)
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
      const record: PersistedChange = { seq: next.seq, changeSet, state: next }
      const file = this.storePath(storeId)
      await mkdir(dirname(file), { recursive: true })
      const handle = await open(file, 'a')
      try {
        await handle.appendFile(`${JSON.stringify(record)}\n`, 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
      return next
    } finally {
      release()
    }
  }

  async replaceStore(storeId: string, state: HubStoreState): Promise<void> {
    const file = this.storePath(storeId)
    await mkdir(dirname(file), { recursive: true })
    const temp = `${file}.${process.pid}.tmp`
    await writeFile(temp, `${JSON.stringify({ seq: state.seq, state })}\n`, { encoding: 'utf8', mode: 0o600 })
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

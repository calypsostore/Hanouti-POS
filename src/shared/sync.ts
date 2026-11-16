import type { Database } from '../types.js'

export type SyncDocument = Record<string, unknown> & { id: string }

export type SyncOperation =
  | { kind: 'put'; collection: string; id: string; document: SyncDocument }
  | { kind: 'delete'; collection: string; id: string }

export interface ChangeSet {
  opId: string
  deviceId: string
  storeId: string
  baseSeq: number
  ops: SyncOperation[]
}

export interface SyncState {
  seq: number
  collections: Record<string, Record<string, SyncDocument>>
  appliedOpIds: string[]
}

const DATABASE_COLLECTIONS: Array<keyof Database> = [
  'stores', 'users', 'stations', 'stationDevices', 'printers', 'printRoutes', 'printJobs',
  'categories', 'sections', 'tables', 'inventoryItems', 'stockMovements', 'suppliers',
  'purchases', 'purchasePayments', 'products', 'customers', 'orders', 'openOrders',
  'ledger', 'expenses',   'attendance', 'advances', 'payrolls', 'shifts',
  'registerSessions', 'registerDayReports', 'auditLogs',
]

export type HubSnapshot = {
  storeId: string
  seq: number
  collections: Record<string, Array<Record<string, unknown>>>
}

export function mergeHubSnapshot(database: Database, snapshot: HubSnapshot): Database {
  const merged = { ...database } as Database
  for (const collection of DATABASE_COLLECTIONS) {
    const remote = snapshot.collections[String(collection)]
    if (!remote) {
      Object.assign(merged, { [collection]: [] })
      continue
    }
    const localRows = database[collection] as unknown as Array<Record<string, unknown>>
    const localById = new Map(localRows.map((row) => [row.id, row]))
    const rows = remote.map((row) => {
      const previous = localById.get(String(row.id))
      if (collection === 'users') {
        return {
          ...previous,
          ...row,
          password: typeof previous?.password === 'string' ? previous.password : '',
          pin: typeof previous?.pin === 'string' ? previous.pin : '',
        }
      }
      return row
    })
    Object.assign(merged, { [collection]: rows })
  }
  return merged
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (!isRecord(value)) return JSON.stringify(value)
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableStringify(value[key])}`,
  ).join(',')}}`
}

export function diffCollections(
  previous: Record<string, readonly SyncDocument[]>,
  next: Record<string, readonly SyncDocument[]>,
  metadata: Omit<ChangeSet, 'ops'>,
): ChangeSet {
  const ops: SyncOperation[] = []
  for (const collection of [...new Set([...Object.keys(previous), ...Object.keys(next)])].sort()) {
    const before = new Map((previous[collection] ?? []).map((document) => [document.id, document]))
    const after = new Map((next[collection] ?? []).map((document) => [document.id, document]))
    for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      const oldDocument = before.get(id)
      const newDocument = after.get(id)
      if (!newDocument) {
        ops.push({ kind: 'delete', collection, id })
      } else if (!oldDocument || stableStringify(oldDocument) !== stableStringify(newDocument)) {
        ops.push({ kind: 'put', collection, id, document: newDocument })
      }
    }
  }
  return { ...metadata, ops }
}

function mergeById(oldValue: unknown, newValue: SyncDocument): SyncDocument {
  if (!isRecord(oldValue)) return structuredClone(newValue)
  const merged: SyncDocument = { ...oldValue, ...newValue, id: newValue.id }
  for (const key of ['items', 'payments']) {
    const incoming = newValue[key]
    const current = oldValue[key]
    if (!Array.isArray(incoming) || !Array.isArray(current)) continue
    const mergedItems = new Map<string, unknown>()
    for (const item of current) {
      if (isRecord(item) && typeof item.id === 'string') mergedItems.set(item.id, item)
    }
    for (const item of incoming) {
      if (isRecord(item) && typeof item.id === 'string') mergedItems.set(item.id, item)
    }
    merged[key] = [...mergedItems.values()]
  }
  return merged
}

function mergeRows(
  current: unknown,
  incoming: unknown,
  keys: string[],
  timeKeys: string[],
): unknown[] {
  const rows = new Map<string, { value: unknown; time: number }>()
  for (const candidate of [...(Array.isArray(current) ? current : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    if (!isRecord(candidate)) continue
    const key = keys.map((name) => candidate[name]).find((value) => typeof value === 'string')
    if (typeof key !== 'string') continue
    const timeValue = timeKeys.map((name) => candidate[name]).find((value) => typeof value === 'string')
    const time = typeof timeValue === 'string' ? Date.parse(timeValue) : 0
    const previous = rows.get(key)
    if (!previous || time >= previous.time) rows.set(key, { value: candidate, time })
  }
  return [...rows.values()].map((row) => row.value)
}

export function mergeOpenOrderDocument(oldValue: unknown, newValue: SyncDocument): SyncDocument {
  if (!isRecord(oldValue)) return structuredClone(newValue)
  return {
    ...oldValue,
    ...newValue,
    items: mergeRows(oldValue.items, newValue.items, ['lineId', 'id'], ['updatedAt', 'sentAt', 'addedAt']),
    tableHistory: mergeRows(oldValue.tableHistory, newValue.tableHistory, ['id'], ['at']),
  }
}

export function applyChangeSet(state: SyncState, changeSet: ChangeSet): SyncState {
  if (state.appliedOpIds.includes(changeSet.opId)) return state
  const collections = structuredClone(state.collections)
  for (const op of changeSet.ops) {
    const collection = collections[op.collection] ?? (collections[op.collection] = {})
    if (op.kind === 'delete') {
      delete collection[op.id]
    } else {
      collection[op.id] = op.collection === 'openOrders'
        ? mergeOpenOrderDocument(collection[op.id], op.document)
        : op.collection === 'orderItems' || op.collection === 'payments'
          ? mergeById(collection[op.id], op.document)
          : structuredClone(op.document)
    }
  }
  return {
    seq: state.seq + 1,
    collections,
    appliedOpIds: [...state.appliedOpIds, changeSet.opId].slice(-10_000),
  }
}

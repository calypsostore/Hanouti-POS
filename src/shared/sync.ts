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

export function applyChangeSet(state: SyncState, changeSet: ChangeSet): SyncState {
  if (state.appliedOpIds.includes(changeSet.opId)) return state
  const collections = structuredClone(state.collections)
  for (const op of changeSet.ops) {
    const collection = collections[op.collection] ?? (collections[op.collection] = {})
    if (op.kind === 'delete') {
      delete collection[op.id]
    } else {
      collection[op.id] = op.collection === 'orderItems' || op.collection === 'payments'
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

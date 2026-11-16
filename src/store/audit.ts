import type { AuditAction, AuditEntity, AuditJsonValue, AuditLog, Database, Role } from '../types'
import { uid } from '../lib/utils.ts'

export type AuditActor = { id: string; name: string; role: Role | 'unknown' }

type AddLogInput = {
  storeId: string
  action: AuditAction
  entity: AuditEntity
  entityId?: string
  summary: string
  before?: Record<string, AuditJsonValue>
  after?: Record<string, AuditJsonValue>
}

const compactValue = (value: AuditJsonValue, depth = 0): AuditJsonValue => {
  if (typeof value === 'string') return value.slice(0, 240)
  if (depth >= 3) return '[details omitted]'
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => compactValue(item, depth + 1))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).slice(0, 20).map(([key, item]) => [key.slice(0, 80), compactValue(item, depth + 1)]),
    )
  }
  return value
}

const compactChanges = (value: Record<string, AuditJsonValue> | undefined) =>
  value
    ? Object.fromEntries(
        Object.entries(value).slice(0, 20).map(([key, item]) => [key.slice(0, 80), compactValue(item)]),
      )
    : undefined

export function changedAuditFields(
  before: Record<string, AuditJsonValue>,
  after: Record<string, AuditJsonValue>,
) {
  const keys = Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
  return {
    before: Object.fromEntries(keys.map((key) => [key, before[key]])),
    after: Object.fromEntries(keys.map((key) => [key, after[key]])),
    fields: keys,
  }
}

export function addLog(prevDb: Database, actor: AuditActor, input: AddLogInput): Database {
  const storeLogs = prevDb.auditLogs.filter((log) => log.storeId === input.storeId)
  const overflow = Math.max(0, storeLogs.length + 1 - 3000)
  const droppedIds = new Set(storeLogs.slice(0, overflow).map((log) => log.id))
  const entry: AuditLog = {
    id: uid('aud'),
    storeId: input.storeId,
    userId: actor.id,
    userName: actor.name,
    role: actor.role,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    summary: input.summary.slice(0, 500),
    before: compactChanges(input.before),
    after: compactChanges(input.after),
    createdAt: new Date().toISOString(),
  }
  return {
    ...prevDb,
    auditLogs: [...prevDb.auditLogs.filter((log) => !droppedIds.has(log.id)), entry],
  }
}

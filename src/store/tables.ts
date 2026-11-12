import { useCallback } from 'react'
import type { AuditJsonValue, DiningTable } from '../types'
import { uid } from '../lib/utils'
import { addLog } from './audit'
import type { AppContextValue, DiningTableInput } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

const tableSnapshot = (table: DiningTable): Record<string, AuditJsonValue> => ({
  name: table.name,
  seats: table.seats,
  zone: table.zone ?? '',
  active: table.active,
  sort: table.sort,
})

const validateTable = (input: DiningTableInput): { ok: true; name: string } | { ok: false; error: string } => {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 60) return { ok: false, error: 'Enter a table name up to 60 characters.' }
  if (!Number.isSafeInteger(input.seats) || input.seats < 1 || input.seats > 50) {
    return { ok: false, error: 'Seats must be a whole number from 1 to 50.' }
  }
  if (input.zone !== undefined && (typeof input.zone !== 'string' || input.zone.trim().length > 60)) {
    return { ok: false, error: 'Zone names must be 60 characters or fewer.' }
  }
  return { ok: true, name }
}

export function useTablesSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireCapability } = dependencies

  const addTable = useCallback<AppContextValue['addTable']>((storeId, data) => {
    const actorResult = requireCapability(storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    const validated = validateTable(data)
    if (!validated.ok) return validated
    if (dbRef.current.tables.some((table) =>
      table.storeId === storeId && table.name.toLowerCase() === validated.name.toLowerCase(),
    )) return { ok: false, error: 'A table with that name already exists in this store.' }
    const table: DiningTable = {
      id: uid('tbl'),
      storeId,
      name: validated.name,
      seats: data.seats,
      zone: data.zone?.trim() || undefined,
      active: true,
      sort: dbRef.current.tables
        .filter((item) => item.storeId === storeId)
        .reduce((max, item) => Math.max(max, item.sort), -1) + 1,
    }
    commitDb((prev) => addLog({
      ...prev,
      tables: [...prev.tables, table],
    }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'table',
      entityId: table.id,
      summary: `Added table ${table.name}`,
      after: tableSnapshot(table),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const updateTable = useCallback<AppContextValue['updateTable']>((id, patch) => {
    const current = dbRef.current
    const table = current.tables.find((candidate) => candidate.id === id)
    if (!table) return { ok: false, error: 'Table not found.' }
    const actorResult = requireCapability(table.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    const validated = validateTable({
      name: patch.name ?? table.name,
      seats: patch.seats ?? table.seats,
      zone: patch.zone === undefined ? table.zone : patch.zone,
    })
    if (!validated.ok) return validated
    if (patch.active !== undefined && typeof patch.active !== 'boolean') {
      return { ok: false, error: 'Choose a valid active status.' }
    }
    if (patch.active === false && current.openOrders.some((order) =>
      order.storeId === table.storeId && order.tableId === table.id,
    )) return { ok: false, error: 'Move or close the open order before deactivating this table.' }
    if (current.tables.some((candidate) =>
      candidate.id !== table.id && candidate.storeId === table.storeId &&
      candidate.name.toLowerCase() === validated.name.toLowerCase(),
    )) return { ok: false, error: 'A table with that name already exists in this store.' }

    const ordered = current.tables
      .filter((candidate) => candidate.storeId === table.storeId)
      .sort((a, b) => a.sort - b.sort)
    const targetSort = patch.sort
    if (targetSort !== undefined) {
      if (!Number.isSafeInteger(targetSort) || targetSort < 0 || targetSort >= ordered.length) {
        return { ok: false, error: 'Choose a valid table position.' }
      }
      ordered.splice(ordered.findIndex((candidate) => candidate.id === table.id), 1)
      ordered.splice(targetSort, 0, table)
    }
    const sortById = new Map(ordered.map((candidate, index) => [candidate.id, index]))
    const updated: DiningTable = {
      ...table,
      name: validated.name,
      seats: patch.seats ?? table.seats,
      zone: patch.zone === undefined ? table.zone : patch.zone.trim() || undefined,
      active: patch.active ?? table.active,
      sort: sortById.get(table.id) ?? table.sort,
    }
    const changedTables = targetSort === undefined
      ? current.tables.map((candidate) => candidate.id === id ? updated : candidate)
      : current.tables.map((candidate) =>
          candidate.storeId === table.storeId
            ? { ...candidate, sort: sortById.get(candidate.id) ?? candidate.sort, ...(candidate.id === id ? updated : {}) }
            : candidate,
        )
    commitDb((prev) => addLog({
      ...prev,
      tables: changedTables,
    }, actorResult.actor, {
      storeId: table.storeId,
      action: patch.active === false && table.active ? 'deactivated' : 'edited',
      entity: 'table',
      entityId: table.id,
      summary: `${patch.active === false && table.active ? 'Deactivated' : 'Updated'} table ${updated.name}`,
      before: tableSnapshot(table),
      after: tableSnapshot(updated),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const deleteTable = useCallback<AppContextValue['deleteTable']>((id) => {
    const current = dbRef.current
    const table = current.tables.find((candidate) => candidate.id === id)
    if (!table) return { ok: false, error: 'Table not found.' }
    const actorResult = requireCapability(table.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    if (current.openOrders.some((order) => order.storeId === table.storeId && order.tableId === table.id)) {
      return { ok: false, error: 'Move or close the open order before removing this table.' }
    }
    const hasOrders = current.orders.some((order) => order.storeId === table.storeId && order.tableId === table.id)
    const updated = { ...table, active: false }
    commitDb((prev) => addLog({
      ...prev,
      tables: hasOrders
        ? prev.tables.map((candidate) => candidate.id === table.id ? updated : candidate)
        : prev.tables.filter((candidate) => candidate.id !== table.id),
    }, actorResult.actor, {
      storeId: table.storeId,
      action: hasOrders ? 'deactivated' : 'deleted',
      entity: 'table',
      entityId: table.id,
      summary: hasOrders ? `Deactivated table ${table.name} because it has order history` : `Removed table ${table.name}`,
      before: tableSnapshot(table),
      after: hasOrders ? tableSnapshot(updated) : undefined,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  return { addTable, updateTable, deleteTable }
}

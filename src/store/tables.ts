import { useCallback } from 'react'
import { ICON_NAMES } from '../types'
import type { AuditJsonValue, DiningTable, IconColor, TableSection } from '../types'
import { uid } from '../lib/utils'
import { addLog } from './audit'
import type { AppContextValue, DiningTableInput, TableSectionInput } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

const tableSnapshot = (table: DiningTable): Record<string, AuditJsonValue> => ({
  name: table.name,
  seats: table.seats,
  sectionId: table.sectionId ?? '',
  active: table.active,
  sort: table.sort,
})

const sectionSnapshot = (section: TableSection): Record<string, AuditJsonValue> => ({
  name: section.name,
  color: section.color,
  icon: section.icon,
  active: section.active,
  sort: section.sort,
})

const validateTable = (input: DiningTableInput): { ok: true; name: string } | { ok: false; error: string } => {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 60) return { ok: false, error: 'Enter a table name up to 60 characters.' }
  if (!Number.isSafeInteger(input.seats) || input.seats < 1 || input.seats > 50) {
    return { ok: false, error: 'Seats must be a whole number from 1 to 50.' }
  }
  return { ok: true, name }
}

const validateSection = (input: TableSectionInput): { ok: true; name: string } | { ok: false; error: string } => {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 60) return { ok: false, error: 'Enter a section name up to 60 characters.' }
  if (!(['green', 'blue', 'amber', 'rose', 'violet', 'teal', 'slate', 'orange'] as IconColor[]).includes(input.color)) {
    return { ok: false, error: 'Choose a valid section color.' }
  }
  if (!ICON_NAMES.includes(input.icon)) {
    return { ok: false, error: 'Choose a valid section icon.' }
  }
  return { ok: true, name }
}

export function useTablesSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireCapability } = dependencies

  const addTable = useCallback<AppContextValue['addTable']>((storeId, data) => {
    const actorResult = requireCapability(storeId, 'manageTables')
    if (!actorResult.ok) return actorResult
    const validated = validateTable(data)
    if (!validated.ok) return validated
    if (data.sectionId && !dbRef.current.sections.some((section) =>
      section.id === data.sectionId && section.storeId === storeId && section.active,
    )) return { ok: false, error: 'Choose an active section from this store.' }
    if (dbRef.current.tables.some((table) =>
      table.storeId === storeId && table.name.toLowerCase() === validated.name.toLowerCase(),
    )) return { ok: false, error: 'A table with that name already exists in this store.' }
    const table: DiningTable = {
      id: uid('tbl'),
      storeId,
      name: validated.name,
      seats: data.seats,
      sectionId: data.sectionId,
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
    const actorResult = requireCapability(table.storeId, 'manageTables')
    if (!actorResult.ok) return actorResult
    const validated = validateTable({
      name: patch.name ?? table.name,
      seats: patch.seats ?? table.seats,
    })
    if (!validated.ok) return validated
    const sectionId = patch.sectionId === undefined ? table.sectionId : patch.sectionId || undefined
    if (sectionId && !current.sections.some((section) =>
      section.id === sectionId && section.storeId === table.storeId && section.active,
    )) return { ok: false, error: 'Choose an active section from this store.' }
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
      sectionId,
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
    const actorResult = requireCapability(table.storeId, 'manageTables')
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

  const addSection = useCallback<AppContextValue['addSection']>((storeId, data) => {
    const actorResult = requireCapability(storeId, 'manageSections')
    if (!actorResult.ok) return actorResult
    const validated = validateSection(data)
    if (!validated.ok) return validated
    if (dbRef.current.sections.some((section) =>
      section.storeId === storeId && section.name.toLowerCase() === validated.name.toLowerCase(),
    )) return { ok: false, error: 'A section with that name already exists in this store.' }
    const section: TableSection = {
      id: uid('section'),
      storeId,
      name: validated.name,
      color: data.color,
      icon: data.icon,
      active: true,
      sort: dbRef.current.sections
        .filter((item) => item.storeId === storeId)
        .reduce((max, item) => Math.max(max, item.sort), -1) + 1,
    }
    commitDb((prev) => addLog({ ...prev, sections: [...prev.sections, section] }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'section',
      entityId: section.id,
      summary: `Added section ${section.name}`,
      after: sectionSnapshot(section),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const updateSection = useCallback<AppContextValue['updateSection']>((id, patch) => {
    const current = dbRef.current
    const section = current.sections.find((candidate) => candidate.id === id)
    if (!section) return { ok: false, error: 'Section not found.' }
    const actorResult = requireCapability(section.storeId, 'manageSections')
    if (!actorResult.ok) return actorResult
    const validated = validateSection({
      name: patch.name ?? section.name,
      color: patch.color ?? section.color,
      icon: patch.icon ?? section.icon,
    })
    if (!validated.ok) return validated
    if (patch.active !== undefined && typeof patch.active !== 'boolean') {
      return { ok: false, error: 'Choose a valid active status.' }
    }
    if (patch.active === false && current.tables.some((table) =>
      table.storeId === section.storeId && table.sectionId === section.id && table.active,
    )) return { ok: false, error: 'Move or deactivate the active tables before deactivating this section.' }
    if (current.sections.some((candidate) =>
      candidate.id !== section.id && candidate.storeId === section.storeId &&
      candidate.name.toLowerCase() === validated.name.toLowerCase(),
    )) return { ok: false, error: 'A section with that name already exists in this store.' }
    const ordered = current.sections.filter((candidate) => candidate.storeId === section.storeId)
      .sort((a, b) => a.sort - b.sort)
    if (patch.sort !== undefined) {
      if (!Number.isSafeInteger(patch.sort) || patch.sort < 0 || patch.sort >= ordered.length) {
        return { ok: false, error: 'Choose a valid section position.' }
      }
      ordered.splice(ordered.findIndex((candidate) => candidate.id === section.id), 1)
      ordered.splice(patch.sort, 0, section)
    }
    const sortById = new Map(ordered.map((candidate, index) => [candidate.id, index]))
    const updated: TableSection = {
      ...section,
      name: validated.name,
      color: patch.color ?? section.color,
      icon: patch.icon ?? section.icon,
      active: patch.active ?? section.active,
      sort: sortById.get(section.id) ?? section.sort,
    }
    const changedSections = current.sections.map((candidate) => candidate.storeId === section.storeId
      ? { ...candidate, sort: sortById.get(candidate.id) ?? candidate.sort, ...(candidate.id === section.id ? updated : {}) }
      : candidate)
    commitDb((prev) => addLog({ ...prev, sections: changedSections }, actorResult.actor, {
      storeId: section.storeId,
      action: patch.active === false && section.active ? 'deactivated' : 'edited',
      entity: 'section',
      entityId: section.id,
      summary: `Updated section ${updated.name}`,
      before: sectionSnapshot(section),
      after: sectionSnapshot(updated),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const deleteSection = useCallback<AppContextValue['deleteSection']>((id) => {
    const current = dbRef.current
    const section = current.sections.find((candidate) => candidate.id === id)
    if (!section) return { ok: false, error: 'Section not found.' }
    const actorResult = requireCapability(section.storeId, 'manageSections')
    if (!actorResult.ok) return actorResult
    if (current.tables.some((table) => table.storeId === section.storeId && table.sectionId === section.id)) {
      return { ok: false, error: 'Move or remove the tables in this section before deleting it.' }
    }
    commitDb((prev) => addLog({
      ...prev,
      sections: prev.sections.filter((candidate) => candidate.id !== section.id),
    }, actorResult.actor, {
      storeId: section.storeId,
      action: 'deleted',
      entity: 'section',
      entityId: section.id,
      summary: `Deleted section ${section.name}`,
      before: sectionSnapshot(section),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  return { addTable, updateTable, deleteTable, addSection, updateSection, deleteSection }
}

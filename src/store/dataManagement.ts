import { useCallback } from 'react'
import type { Database, User } from '../types'
import { buildSeed } from '../data/seed'
import { clearLocalDatabaseCopies, DB_KEY, normalizeDatabaseBackup } from './database'
import { addLog } from './audit'
import { writeIndexedValue } from '../lib/storage'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

function isStoreAdmin(user: User): user is User & { role: 'admin'; storeId: string } {
  return user.role === 'admin' && typeof user.storeId === 'string'
}

export function useDataManagementSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireActor, requireAdmin } = dependencies

  const exportDatabaseBackup = useCallback<AppContextValue['exportDatabaseBackup']>(() => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    if (!isStoreAdmin(actor)) {
      return { ok: false, error: 'Only a store owner can export a database backup.' }
    }
    const storeId = actor.storeId
    const latestActor = requireAdmin(storeId)
    if (!latestActor.ok) return latestActor
    const database = addLog(dbRef.current, latestActor.actor, {
      storeId,
      action: 'backup_exported',
      entity: 'settings',
      summary: 'Exported a full database backup',
    })
    commitDb(() => database)
    return { ok: true, database }
  }, [commitDb, dbRef, requireActor, requireAdmin])

  const importDatabaseBackup = useCallback<AppContextValue['importDatabaseBackup']>(async (value) => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    if (!isStoreAdmin(actor)) {
      return { ok: false, error: 'Only a store owner can import a database backup.' }
    }
    const storeId = actor.storeId
    const latestActor = requireAdmin(storeId)
    if (!latestActor.ok) return latestActor
    let normalized: Database | null
    try {
      normalized = normalizeDatabaseBackup(value, buildSeed())
    } catch (error) {
      console.error('7anouti: could not validate the imported database backup.', error)
      return { ok: false, error: 'The selected file is not a valid, complete 7anouti database backup.' }
    }
    if (!normalized) {
      return { ok: false, error: 'The selected file is not a valid, complete 7anouti database backup.' }
    }
    const importedOwner = normalized.users.find((user) =>
      user.id === latestActor.actor.id && user.storeId === storeId && user.role === 'admin' && user.active,
    )
    if (!importedOwner || !normalized.stores.some((store) => store.id === storeId)) {
      return { ok: false, error: 'The backup must contain this active store owner and their store.' }
    }
    const database: Database = addLog(normalized, latestActor.actor, {
      storeId,
      action: 'backup_imported',
      entity: 'settings',
      summary: `Imported backup: ${normalized.stores.length} stores, ${normalized.products.length} products, ${normalized.orders.length} orders`,
      after: {
        stores: normalized.stores.length,
        products: normalized.products.length,
        orders: normalized.orders.length,
        staff: normalized.users.filter((user) => user.role === 'staff' || user.role === 'manager').length,
      },
    })
    let serialized: string
    try {
      serialized = JSON.stringify(database)
    } catch (error) {
      console.error('7anouti: could not serialize the imported database backup.', error)
      return { ok: false, error: 'The backup could not be prepared for storage.' }
    }
    try {
      await writeIndexedValue(DB_KEY, serialized)
    } catch (error) {
      console.error('7anouti: could not save the imported database backup.', error)
      return { ok: false, error: 'The backup could not be saved in this browser. Your current data is unchanged.' }
    }
    commitDb(() => database)
    clearLocalDatabaseCopies()
    return { ok: true }
  }, [commitDb, requireActor, requireAdmin])

  return { exportDatabaseBackup, importDatabaseBackup }
}

import type { Database, Store } from '../types.ts'

export function replaceStore(db: Database, updatedStore: Store): Database {
  if (!db.stores.some((store) => store.id === updatedStore.id)) {
    throw new Error('Store not found.')
  }
  return {
    ...db,
    stores: db.stores.map((store) => store.id === updatedStore.id ? updatedStore : store),
  }
}

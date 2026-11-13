import type { Database, Store } from '../types'

export interface StoreDiagnostics {
  storeId: string
  tablesCount: number
  staffCount: number
  features: Store['settings']['features']
  mode: Store['settings']['posMode']
  databaseKey: string
}

export function getStoreDiagnostics(
  database: Database,
  store: Store,
  databaseKey: string,
): StoreDiagnostics {
  return {
    storeId: store.id,
    tablesCount: database.tables.filter((table) => table.storeId === store.id).length,
    staffCount: database.users.filter((user) => user.storeId === store.id && user.role === 'staff').length,
    features: { ...store.settings.features },
    mode: store.settings.posMode,
    databaseKey,
  }
}

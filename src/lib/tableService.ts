import type { DiningTable, GuestRequirement, OpenOrder, StoreSettings } from '../types.js'

export function dineInTableError(
  settings: Pick<StoreSettings, 'features' | 'tableMode'>,
  tables: Array<Pick<DiningTable, 'id' | 'storeId' | 'active'>>,
  openOrders: Array<Pick<OpenOrder, 'id' | 'storeId' | 'tableId' | 'tableName'>>,
  input: {
    storeId: string
    tableId?: string
    tableName?: string
    excludeOpenOrderId?: string
  },
): string | undefined {
  if (!settings.features.tables) return 'Table service is disabled for this store.'

  const manualMode = settings.tableMode === 'manual'
  const tableName = input.tableName?.trim() ?? ''
  if (manualMode) {
    if (input.tableId || !tableName || tableName.length > 60) {
      return 'Enter a table name up to 60 characters.'
    }
  } else if (!input.tableId || !tables.some((table) =>
    table.id === input.tableId && table.storeId === input.storeId && table.active,
  )) {
    return 'Choose an active table from this store.'
  }

  const occupied = openOrders.some((order) =>
    order.storeId === input.storeId && order.id !== input.excludeOpenOrderId &&
    (manualMode
      ? order.tableName.trim().toLowerCase() === tableName.toLowerCase()
      : order.tableId === input.tableId),
  )
  return occupied ? 'This table already has an open order.' : undefined
}

export function guestCountError(
  guests: number | undefined,
  requirement: GuestRequirement,
): string | undefined {
  if (requirement === 'off') return undefined
  if (guests === undefined) {
    return requirement === 'required' ? 'Enter the number of guests.' : undefined
  }
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 50) {
    return 'Guests must be a whole number from 1 to 50.'
  }
  return undefined
}

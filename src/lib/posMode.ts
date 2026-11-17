import type { PosMode, Store, StoreSettings } from '../types.ts'

type PosModeStore = Pick<Store, 'settings'> | StoreSettings

export interface PosModeFeatures {
  payments: boolean
  cashDrawer: boolean
  changeCalc: boolean
  receiptPrinting: boolean
  refunds: boolean
  cashReconciliation: boolean
  purchases: boolean
  inventory: boolean
  recipesYield: boolean
  staffAllowances: boolean
  payroll: boolean
  tablesFloor: boolean
  kitchenStations: boolean
  customerCredit: boolean
}

function settingsFor(source: PosModeStore): StoreSettings {
  return 'settings' in source ? source.settings : source
}

export function isQuick(store: PosModeStore | PosMode): boolean {
  const posMode = typeof store === 'string' ? store : settingsFor(store).posMode
  return posMode === 'quick'
}

export function isCashier(store: PosModeStore | PosMode): boolean {
  return !isQuick(store)
}

export function modeFeatures(source: PosModeStore): PosModeFeatures {
  const settings = settingsFor(source)
  const cashier = isCashier(settings)
  return {
    payments: cashier,
    cashDrawer: cashier,
    changeCalc: cashier,
    receiptPrinting: cashier,
    refunds: cashier,
    cashReconciliation: true,
    purchases: cashier,
    inventory: cashier,
    recipesYield: cashier,
    staffAllowances: cashier,
    payroll: cashier,
    tablesFloor: cashier && settings.features.tables,
    kitchenStations: cashier || settings.features.kitchenScreen,
    customerCredit: cashier || settings.allowCredit,
  }
}

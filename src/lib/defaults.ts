import type { Capability, PayrollSettings, PrinterSettings, Role, StoreSettings, User } from '../types'
import { MANAGER_DEFAULT_PERMISSIONS } from './permissions.ts'
import { round } from './pricing-utils.ts'
import { isValidUsername, normalizeUsername } from './staff.ts'

export const DEFAULT_PRINTER: PrinterSettings = {
  enabled: true,
  width: 80,
  mode: 'manual',
  connection: 'webserial',
  baudRate: 9600,
  kitchenTicket: false,
}

export const DEFAULT_PRINT_POLICIES = {
  receiptPrintPolicy: 'ask' as const,
  stationTicketPrintPolicy: 'automatic' as const,
  reportPrintPolicy: 'manual' as const,
}

export const preparationTicketsEnabled = (settings: Pick<StoreSettings, 'features' | 'printer'>): boolean =>
  Boolean(settings.features.kitchenScreen || settings.printer.kitchenTicket)

export const DEFAULT_PAYROLL_SETTINGS = {
  workingDaysPerMonth: 26,
  fullDayHours: 6,
  halfDayHours: 3,
  autoCloseHours: 14,
}

export const DEFAULT_AUTOMATION_SETTINGS = {
  drawerKickOnCash: true,
  autoLockMinutes: 5,
  autoLogoutMinutes: 720,
  shiftReminders: true,
  shiftReminderHours: 8,
  maxShiftHours: 12,
  cashDifferenceTolerance: 0,
  warnAboutOpenTablesAtShiftClose: true,
  lowStockAlerts: true,
  hideOutOfStock: false,
  retryPrintJobs: true,
  fallbackPrintJobs: true,
  printerRetryLimit: 5,
  autoReconnectPrinters: true,
  printerOfflineAlerts: true,
  printerOfflineAlertMinutes: 5,
  backupHealthAlerts: true,
}

export const DEFAULT_AVAILABILITY_SETTINGS: StoreSettings['availability'] = {
  enabled: true,
  autoEightySixAtZero: true,
  autoReturnOnRestock: true,
  requireReason: true,
  reasons: ['Out of stock', 'Machine down', 'Not prepared today', 'Quality issue'],
  defaultReturnMode: 'on_restock',
  resetManualAtDayStart: false,
  resetManualAtFirstShift: false,
  displayStyle: 'big_red_x',
  showListButton: true,
  notifyStaffAboutChanges: true,
  showCountOnStationScreens: true,
}

export const DEFAULT_ORDER_RULES: StoreSettings['orderRules'] = {
  stockOverflowMode: 'warn',
  deductIngredientsOnSale: false,
  openOrderPricePolicy: 'keep',
  orderNumberFormat: 'plain',
  orderNumberPrefix: '',
  showLowStockHints: true,
  revalidationBanner: true,
  stockOverrideRoles: { admin: true, manager: true, staff: false },
}

export const DEFAULT_COFFEE_TRACKING: StoreSettings['coffeeTracking'] = {
  enabled: false,
  servingsPerKgMin: 50,
  servingsPerKgMax: 70,
}

export const DEFAULT_INVENTORY_YIELD_TRACKING: StoreSettings['inventoryYieldTracking'] = {
  enabled: false,
  trackers: [],
}

export const DEFAULT_STAFF_CONSUMPTION: StoreSettings['staffConsumption'] = {
  enabled: false,
  pricing: 'discount',
  discountPercent: 0,
  allowances: [],
}

export const normalizeInventoryYieldTracking = (
  value?: Partial<StoreSettings['inventoryYieldTracking']>,
): StoreSettings['inventoryYieldTracking'] => {
  const seenItems = new Set<string>()
  const trackers = Array.isArray(value?.trackers)
    ? value.trackers.flatMap((entry) => {
        if (!entry || typeof entry.inventoryItemId !== 'string' ||
          !Number.isFinite(entry.referenceQuantity) || entry.referenceQuantity < 0.001 ||
          entry.referenceQuantity > 1_000_000_000 ||
          !Number.isSafeInteger(entry.servingsMin) || entry.servingsMin < 1 || entry.servingsMin > 100_000 ||
          !Number.isSafeInteger(entry.servingsMax) || entry.servingsMax < entry.servingsMin || entry.servingsMax > 100_000 ||
          !Array.isArray(entry.productIds) || !Array.isArray(entry.categoryIds)) return []
        const inventoryItemId = entry.inventoryItemId.trim().slice(0, 128)
        if (!inventoryItemId || seenItems.has(inventoryItemId)) return []
        seenItems.add(inventoryItemId)
        const uniqueIds = (ids: string[]) => [...new Set(ids
          .filter((id) => typeof id === 'string' && id.trim())
          .map((id) => id.trim().slice(0, 128)))].slice(0, 200)
        return [{
          inventoryItemId,
          referenceQuantity: Math.round(entry.referenceQuantity * 1_000_000) / 1_000_000,
          servingsMin: entry.servingsMin,
          servingsMax: entry.servingsMax,
          productIds: uniqueIds(entry.productIds),
          categoryIds: uniqueIds(entry.categoryIds),
        }]
      })
    : []
  return {
    enabled: value?.enabled === true,
    trackers,
  }
}

export const migrateLegacyCoffeeTracking = (
  coffee: StoreSettings['coffeeTracking'],
  products: unknown,
  storeId: string,
): StoreSettings['inventoryYieldTracking'] => {
  if (!coffee.enabled || !coffee.inventoryItemId || !Array.isArray(products)) {
    return normalizeInventoryYieldTracking()
  }
  const inventoryItemId = coffee.inventoryItemId
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
  const recipeUsesItem = (recipe: unknown) =>
    Array.isArray(recipe) && recipe.some((line) =>
      isRecord(line) && line.inventoryItemId === inventoryItemId,
    )
  const productIds = products.flatMap((product) => {
    if (!isRecord(product) || product.storeId !== storeId || typeof product.id !== 'string') return []
    const usesOnProduct = recipeUsesItem(product.recipe)
    const usesOnVariant = Array.isArray(product.variants) && product.variants.some((variant) =>
      isRecord(variant) && recipeUsesItem(variant.recipe),
    )
    const usesOnModifier = Array.isArray(product.modifiers) && product.modifiers.some((group) =>
      isRecord(group) && Array.isArray(group.options) && group.options.some((option) =>
        isRecord(option) && recipeUsesItem(option.recipe),
      ),
    )
    return usesOnProduct || usesOnVariant || usesOnModifier ? [product.id] : []
  })
  if (!productIds.length) return normalizeInventoryYieldTracking()
  return normalizeInventoryYieldTracking({
    enabled: true,
    trackers: [{
      inventoryItemId,
      referenceQuantity: 1000,
      servingsMin: coffee.servingsPerKgMin,
      servingsMax: coffee.servingsPerKgMax,
      productIds,
      categoryIds: [],
    }],
  })
}

export const normalizeCoffeeTracking = (value?: Partial<StoreSettings['coffeeTracking']>): StoreSettings['coffeeTracking'] => {
  const min = typeof value?.servingsPerKgMin === 'number' && Number.isFinite(value.servingsPerKgMin)
    ? Math.max(1, Math.min(1000, Math.round(value.servingsPerKgMin)))
    : DEFAULT_COFFEE_TRACKING.servingsPerKgMin
  const max = typeof value?.servingsPerKgMax === 'number' && Number.isFinite(value.servingsPerKgMax)
    ? Math.max(min, Math.min(1000, Math.round(value.servingsPerKgMax)))
    : Math.max(min, DEFAULT_COFFEE_TRACKING.servingsPerKgMax)
  return {
    enabled: value?.enabled === true,
    inventoryItemId: typeof value?.inventoryItemId === 'string' ? value.inventoryItemId.slice(0, 128) : undefined,
    servingsPerKgMin: min,
    servingsPerKgMax: max,
  }
}

export const normalizeStaffConsumption = (value?: Partial<StoreSettings['staffConsumption']>): StoreSettings['staffConsumption'] => {
  const pricing = value?.pricing === 'full_price' || value?.pricing === 'free' ? value.pricing : 'discount'
  const seen = new Set<string>()
  const allowances = Array.isArray(value?.allowances)
    ? value.allowances.flatMap((entry) => {
        if (!entry || typeof entry.productId !== 'string' || !entry.productId.trim() ||
          !Number.isSafeInteger(entry.maxPerShift) || entry.maxPerShift < 1 || entry.maxPerShift > 100) return []
        const productId = entry.productId.trim().slice(0, 128)
        if (seen.has(productId)) return []
        seen.add(productId)
        return [{ productId, maxPerShift: entry.maxPerShift }]
      }).slice(0, 200)
    : []
  const discountPercent = typeof value?.discountPercent === 'number' && Number.isFinite(value.discountPercent)
    ? Math.max(0, Math.min(100, value.discountPercent))
    : DEFAULT_STAFF_CONSUMPTION.discountPercent
  return {
    enabled: value?.enabled === true,
    pricing,
    discountPercent,
    allowances,
  }
}

const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? value as T : fallback

/** Normalize persisted/remote order rules. Used by the app database and documented for the hub. */
export const normalizeOrderRules = (value?: Partial<StoreSettings['orderRules']>): StoreSettings['orderRules'] => {
  const roles = value?.stockOverrideRoles
  const prefix = typeof value?.orderNumberPrefix === 'string'
    ? value.orderNumberPrefix.trim().slice(0, 8)
    : DEFAULT_ORDER_RULES.orderNumberPrefix
  return {
    stockOverflowMode: oneOf(value?.stockOverflowMode, ['block', 'warn', 'allow'], DEFAULT_ORDER_RULES.stockOverflowMode),
    deductIngredientsOnSale: value?.deductIngredientsOnSale === true,
    openOrderPricePolicy: oneOf(value?.openOrderPricePolicy, ['keep', 'current', 'ask'], DEFAULT_ORDER_RULES.openOrderPricePolicy),
    orderNumberFormat: oneOf(value?.orderNumberFormat, ['plain', 'daily', 'prefix'], DEFAULT_ORDER_RULES.orderNumberFormat),
    orderNumberPrefix: prefix,
    showLowStockHints: value?.showLowStockHints !== false,
    revalidationBanner: value?.revalidationBanner !== false,
    stockOverrideRoles: {
      admin: roles?.admin !== false,
      manager: roles?.manager !== false,
      staff: roles?.staff === true,
    },
  }
}
export const normalizePayrollSettings = (value?: Partial<PayrollSettings>): PayrollSettings => {
  const workingDaysPerMonth = value?.workingDaysPerMonth
  const fullDayHours = value?.fullDayHours
  const halfDayHours = value?.halfDayHours
  const autoCloseHours = value?.autoCloseHours
  const validNumber = (n: unknown, min: number, max: number): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max
  const normalizedFullDay = validNumber(fullDayHours, 0.25, 24)
    ? fullDayHours
    : DEFAULT_PAYROLL_SETTINGS.fullDayHours
  const normalizedHalfDay = validNumber(halfDayHours, 0.25, normalizedFullDay)
    ? halfDayHours
    : Math.min(DEFAULT_PAYROLL_SETTINGS.halfDayHours, normalizedFullDay)
  return {
    workingDaysPerMonth: validNumber(workingDaysPerMonth, 1, 31)
      ? workingDaysPerMonth
      : DEFAULT_PAYROLL_SETTINGS.workingDaysPerMonth,
    fullDayHours: normalizedFullDay,
    halfDayHours: normalizedHalfDay,
    autoCloseHours: validNumber(autoCloseHours, 0.25, 168)
      ? autoCloseHours
      : DEFAULT_PAYROLL_SETTINGS.autoCloseHours,
  }
}

export const defaultPermissions = (role: Role): User['permissions'] => ({
  discount: role !== 'staff',
  credit: true,
  settle: role !== 'staff',
  reports: role !== 'staff',
  register: role !== 'staff',
  supervisor: role !== 'staff',
  openShift: role !== 'super',
  closeShift: role !== 'super',
  takeOverTables: role !== 'super',
  viewOrders: role === 'staff' || role === 'manager',
  viewExpenses: false,
  addExpenses: false,
  editExpenses: false,
  useStaffAllowances: false,
  viewStation: role === 'manager',
  overrideStock: role === 'admin' || role === 'manager',
  manageCustomers: role === 'admin',
  viewTabs: role === 'admin',
  settleTabs: role === 'admin',
  addToTabs: role === 'admin',
  ...(role === 'manager' ? MANAGER_DEFAULT_PERMISSIONS : {}),
})

/** Fill in fields that were added after a database version was released. */
export const normalizeUser = (u: User): User => {
  const base = defaultPermissions(u.role)
  const p = u.permissions ?? base
  const capability = (name: Capability) => u.stationOnly
    ? name === 'viewStation'
    : name === 'recordPurchases'
    ? p[name] === true
    : name === 'openShift' || name === 'closeShift' || name === 'takeOverTables'
      ? typeof p[name] === 'boolean' ? p[name] : base[name]
    : name === 'viewOrders'
      ? typeof p[name] === 'boolean' ? p[name] : base[name]
      : name === 'useStaffAllowances'
        ? u.role === 'manager'
          ? typeof p[name] === 'boolean' ? p[name] : MANAGER_DEFAULT_PERMISSIONS[name]
          : p[name] === true
      : name === 'viewStation' && u.role === 'staff'
        ? p[name] === true
        : u.role === 'manager'
          ? typeof p[name] === 'boolean' ? p[name] : MANAGER_DEFAULT_PERMISSIONS[name]
          : false
  const enteredUsername = typeof u.username === 'string' ? normalizeUsername(u.username) : ''
  const emailName = u.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '-') ?? ''
  const fallbackName = `user-${u.id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 19)}`
  const username = isValidUsername(enteredUsername)
    ? enteredUsername
    : isValidUsername(emailName.slice(0, 24))
      ? emailName.slice(0, 24)
      : fallbackName
  return {
    ...u,
    email: u.role === 'staff' || u.role === 'manager' ? '' : u.email ?? '',
    username,
    salaryType: u.salaryType === 'daily' || u.salaryType === 'monthly' ? u.salaryType : 'none',
    salaryAmount: typeof u.salaryAmount === 'number' && Number.isFinite(u.salaryAmount)
      ? round(Math.max(0, u.salaryAmount))
      : 0,
    photo: typeof u.photo === 'string' && u.photo.startsWith('data:image/') && u.photo.length <= 307200
      ? u.photo
      : undefined,
    goStraightToStation: u.goStraightToStation === true,
    stationOnly: u.stationOnly === true,
    attendanceEnabled: u.stationOnly ? u.attendanceEnabled === true : u.attendanceEnabled !== false,
    permissions: {
      discount: !u.stationOnly && (typeof p.discount === 'boolean' ? p.discount : base.discount),
      credit: !u.stationOnly && (typeof p.credit === 'boolean' ? p.credit : base.credit),
      settle: !u.stationOnly && (typeof p.settle === 'boolean' ? p.settle : base.settle),
      reports: !u.stationOnly && (typeof p.reports === 'boolean' ? p.reports : base.reports),
      register: !u.stationOnly && (typeof p.register === 'boolean' ? p.register : base.register),
      supervisor: !u.stationOnly && (typeof p.supervisor === 'boolean' ? p.supervisor : base.supervisor),
      manageInventory: capability('manageInventory'),
      recordPurchases: capability('recordPurchases'),
      viewCosts: capability('viewCosts'),
      manageStaffAllowances: capability('manageStaffAllowances'),
      useStaffAllowances: capability('useStaffAllowances'),
      approveOverrides: capability('approveOverrides'),
      viewOrders: capability('viewOrders'),
      viewReports: capability('viewReports'),
      viewExpenses: capability('viewExpenses'),
      addExpenses: capability('addExpenses'),
      editExpenses: capability('editExpenses'),
      manageProducts: capability('manageProducts'),
      voidOrders: capability('voidOrders'),
      manageStaff: capability('manageStaff'),
      manageSettings: capability('manageSettings'),
      managePayroll: capability('managePayroll'),
      manageTables: capability('manageTables'),
      manageSections: capability('manageSections'),
      viewStation: capability('viewStation'),
      openShift: capability('openShift'),
      closeShift: capability('closeShift'),
      takeOverTables: capability('takeOverTables'),
      forceCloseShift: capability('forceCloseShift'),
      manageCashDifferences: capability('manageCashDifferences'),
      viewStaffAnalytics: capability('viewStaffAnalytics'),
      manage86: capability('manage86'),
      overrideStock: !u.stationOnly && (typeof p.overrideStock === 'boolean'
        ? p.overrideStock
        : u.role === 'admin' || u.role === 'manager'),
      manageCustomers: !u.stationOnly && (u.role === 'admin' || (typeof p.manageCustomers === 'boolean'
        ? p.manageCustomers
        : u.role === 'manager' && MANAGER_DEFAULT_PERMISSIONS.manageCustomers)),
      viewTabs: !u.stationOnly && (u.role === 'admin' || (typeof p.viewTabs === 'boolean'
        ? p.viewTabs
        : u.role === 'manager' && MANAGER_DEFAULT_PERMISSIONS.viewTabs)),
      settleTabs: !u.stationOnly && (u.role === 'admin' || (typeof p.settleTabs === 'boolean'
        ? p.settleTabs
        : u.role === 'manager' && MANAGER_DEFAULT_PERMISSIONS.settleTabs)),
      addToTabs: !u.stationOnly && (u.role === 'admin' || (typeof p.addToTabs === 'boolean'
        ? p.addToTabs
        : u.role === 'manager' && MANAGER_DEFAULT_PERMISSIONS.addToTabs)),
    },
    tabCreditLimit: typeof u.tabCreditLimit === 'number' && Number.isFinite(u.tabCreditLimit)
      ? round(Math.max(0, u.tabCreditLimit))
      : 0,
  }
}

export const normalizePrinter = (p?: Partial<PrinterSettings>): PrinterSettings => ({
  ...DEFAULT_PRINTER,
  ...p,
  width: p?.width === 58 ? 58 : 80,
  mode: p?.mode === 'auto' ? 'auto' : 'manual',
  connection: p?.connection === 'browser' ? 'browser' : 'webserial',
})

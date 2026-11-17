import type { Capability, User } from '../types.ts'

export const MANAGER_DEFAULT_PERMISSIONS: Pick<User['permissions'], Capability> = {
  manageInventory: true,
  recordPurchases: true,
  viewCosts: true,
  manageStaffAllowances: true,
  useStaffAllowances: true,
  approveOverrides: true,
  viewOrders: true,
  viewReports: true,
  viewExpenses: false,
  addExpenses: false,
  editExpenses: false,
  manageProducts: true,
  voidOrders: true,
  manageStaff: true,
  manageSettings: false,
  managePayroll: false,
  manageTables: true,
  manageSections: true,
  viewStation: true,
  openShift: true,
  closeShift: true,
  takeOverTables: true,
  forceCloseShift: true,
  manageCashDifferences: true,
  viewStaffAnalytics: true,
  manage86: true,
  overrideStock: true,
  manageCustomers: false,
  viewTabs: false,
  settleTabs: false,
  addToTabs: false,
}

export function canOverrideStock(user: User, rules: { stockOverrideRoles: { admin: boolean; manager: boolean; staff: boolean } }): boolean {
  if (user.stationOnly) return false
  const roleAllowed = user.role === 'admin'
    ? rules.stockOverrideRoles.admin
    : user.role === 'manager'
      ? rules.stockOverrideRoles.manager
      : rules.stockOverrideRoles.staff
  if (!roleAllowed) return false
  return user.role === 'admin' || user.permissions.overrideStock === true
}

export function can(user: User, capability: Capability): boolean {
  if (user.stationOnly) {
    return capability === 'viewStation' && user.permissions.viewStation === true
  }
  if (user.role === 'admin') return true
  if (capability === 'openShift' || capability === 'closeShift') {
    return user.permissions[capability] === true
  }
  if (capability === 'viewOrders' || capability === 'viewExpenses' ||
      capability === 'addExpenses' || capability === 'editExpenses') {
    return user.permissions[capability] === true
  }
  if (capability === 'takeOverTables' || capability === 'forceCloseShift' ||
      capability === 'manage86' ||
      capability === 'manageCashDifferences' || capability === 'viewStaffAnalytics' ||
      capability === 'manageCustomers' || capability === 'viewTabs' ||
      capability === 'settleTabs' || capability === 'addToTabs') {
    return user.permissions[capability] === true
  }
  if (capability === 'recordPurchases' && user.role === 'staff') {
    return user.permissions.recordPurchases === true
  }
  if (capability === 'useStaffAllowances' && user.role === 'staff') {
    return user.permissions.useStaffAllowances === true
  }
  if (capability === 'viewStation') return user.permissions.viewStation === true
  if (user.role !== 'manager') return false
  return user.permissions[capability] === true
}

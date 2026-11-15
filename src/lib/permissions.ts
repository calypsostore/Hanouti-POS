import type { Capability, User } from '../types'

export const MANAGER_DEFAULT_PERMISSIONS: Pick<User['permissions'], Capability> = {
  manageInventory: true,
  recordPurchases: true,
  viewCosts: true,
  manageStaffAllowances: true,
  approveOverrides: true,
  viewReports: true,
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
}

export function can(user: User, capability: Capability): boolean {
  if (user.role === 'admin') return true
  if (capability === 'openShift' || capability === 'closeShift') {
    return user.permissions[capability] === true
  }
  if (capability === 'recordPurchases' && user.role === 'staff') {
    return user.permissions.recordPurchases === true
  }
  if (capability === 'viewStation') return user.permissions.viewStation === true
  if (user.role !== 'manager') return false
  return user.permissions[capability] === true
}

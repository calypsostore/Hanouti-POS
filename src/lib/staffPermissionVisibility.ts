import type { User } from '../types.ts'

type StaffPermission = keyof User['permissions']

const QUICK_HIDDEN_PERMISSIONS: StaffPermission[] = [
  'discount',
  'manageInventory',
  'recordPurchases',
  'viewCosts',
  'manageTables',
  'manageSections',
  'takeOverTables',
]

export function isQuickStaffPermissionVisible(
  permission: StaffPermission,
  stationsEnabled: boolean,
): boolean {
  if (QUICK_HIDDEN_PERMISSIONS.includes(permission)) return false
  return permission !== 'viewStation' || stationsEnabled
}

import type { Store, User } from '../types.ts'
import { can } from './permissions.ts'
import { canViewCustomerTabs } from './customerTabs.ts'
import { modeFeatures } from './posMode.ts'

export function quickSidebarPaths(store: Store, user: User): string[] {
  const features = modeFeatures(store)
  const paths = ['/pos']
  if (can(user, 'viewOrders')) paths.push('/admin/orders')
  if (can(user, 'viewReports')) paths.push('/admin')
  if (features.kitchenStations && can(user, 'viewStation')) paths.push('/kitchen')
  if (canViewCustomerTabs(store, user)) paths.push('/admin/customers')
  if (can(user, 'manageStaff')) paths.push('/admin/staff')
  else if (user.role === 'staff' && user.permissions.supervisor) paths.push('/admin/staff')
  if (can(user, 'viewReports')) paths.push('/admin/reports', '/admin/logs')
  if (can(user, 'viewExpenses')) paths.push('/admin/expenses')
  if (can(user, 'openShift') || can(user, 'closeShift')) paths.push('/admin/register')
  if (can(user, 'manageSettings')) paths.push('/admin/settings')
  if (can(user, 'manageProducts')) paths.push('/admin/products')
  return paths
}

export function cashierSidebarPaths(store: Store, user: User): string[] {
  const paths: string[] = []
  if (store.settings.features.tables) paths.push('/pos/floor')
  if (store.settings.features.kitchenScreen && can(user, 'viewStation')) paths.push('/kitchen')
  if (can(user, 'recordPurchases')) paths.push('/admin/purchases')
  if (can(user, 'manageInventory')) paths.push('/admin/inventory')
  if (user.role === 'staff' || canViewCustomerTabs(store, user)) paths.push('/admin/customers')
  return paths
}

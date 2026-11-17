import type { Store, User } from '../types.ts'
import { can } from './permissions.ts'
import { canViewCustomerTabs } from './customerTabs.ts'
import { modeFeatures } from './posMode.ts'

export function quickSidebarPaths(store: Store, user: User): string[] {
  const features = modeFeatures(store)
  const paths = ['/pos', '/admin/orders']
  if (user.role !== 'staff') paths.unshift('/admin')
  if (features.kitchenStations && can(user, 'viewStation')) paths.push('/kitchen')
  if (canViewCustomerTabs(store, user)) paths.push('/admin/customers')
  if (user.role === 'staff') {
    if (user.permissions.supervisor || can(user, 'manageStaff')) paths.push('/admin/staff')
    if (can(user, 'viewReports')) paths.push('/admin/reports', '/admin/logs')
    paths.push('/admin/expenses')
    if (can(user, 'openShift') || can(user, 'closeShift')) paths.push('/admin/register')
    if (can(user, 'manageSettings')) paths.push('/admin/settings')
    return paths
  }
  paths.push('/admin/products')
  if (user.role === 'manager') {
    paths.push(
      '/admin/staff',
      '/admin/reports',
      '/admin/expenses',
      '/admin/register',
      '/admin/logs',
      '/admin/settings',
    )
    return paths
  }
  if (can(user, 'manageStaff')) paths.push('/admin/staff')
  if (can(user, 'viewReports')) paths.push('/admin/reports', '/admin/logs')
  paths.push('/admin/expenses')
  if (can(user, 'openShift') || can(user, 'closeShift')) paths.push('/admin/register')
  if (can(user, 'manageSettings')) paths.push('/admin/settings')
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

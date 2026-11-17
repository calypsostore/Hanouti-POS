import type { Store, User } from '../types.ts'
import { can } from './permissions.ts'
import { isQuick, modeFeatures } from './posMode.ts'

export function canViewCustomerTabs(store: Store, user: User): boolean {
  return modeFeatures(store).customerCredit &&
    (!isQuick(store) || can(user, 'viewTabs') || can(user, 'manageCustomers'))
}

export function canManageCustomerProfiles(store: Store, user: User): boolean {
  return isQuick(store) ? can(user, 'manageCustomers') : user.role === 'admin'
}

export function canSettleCustomerTabs(store: Store, user: User): boolean {
  return isQuick(store) ? can(user, 'settleTabs') : user.role === 'admin' || user.permissions.settle
}

export function canAddOrdersToTabs(store: Store, user: User): boolean {
  return isQuick(store) ? can(user, 'addToTabs') : user.role === 'admin' || user.permissions.credit
}

export function quickTabLimitError(
  actor: { role: string; tabCreditLimit?: number },
  balance: number,
  amount: number,
): string | undefined {
  if (actor.role === 'admin') return undefined
  const limit = actor.tabCreditLimit ?? 0
  if (balance + amount <= limit + 0.0001) return undefined
  return `This order exceeds your tab limit of ${limit.toFixed(3)} DT.`
}

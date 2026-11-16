import { can, canOverrideStock } from './permissions.ts'
import { verifySecret } from './hash.ts'
import type { OrderRulesSettings, User } from '../types.ts'

export type AuthorizationPinPurpose = 'void-order' | 'cancel-table' | 'override-stock'
export type PinConfirmer = Pick<User, 'id' | 'name'>
export type AuthorizationPinResult =
  | { ok: true; confirmer: PinConfirmer }
  | { ok: false; error: string }

export async function findPinConfirmer(
  users: User[],
  storeId: string,
  pin: string,
  purpose: AuthorizationPinPurpose,
  orderRules: OrderRulesSettings,
): Promise<PinConfirmer | undefined> {
  if (!/^\d{4,12}$/.test(pin)) return undefined

  for (const user of users) {
    if (!user.active || user.storeId !== storeId || user.stationOnly) continue
    const authorized = purpose === 'override-stock'
      ? canOverrideStock(user, orderRules)
      : user.role === 'admin' ||
        can(user, purpose === 'void-order' ? 'voidOrders' : 'approveOverrides')
    if (authorized && await verifySecret(pin, user.pin)) {
      return { id: user.id, name: user.name }
    }
  }
  return undefined
}

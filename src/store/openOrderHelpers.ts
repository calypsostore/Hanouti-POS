import type { AuditJsonValue, Database, OpenOrder, OrderItem, User } from '../types'
import { computeTotals } from '../lib/pricing'
import { resolveOpenOrderItems } from '../lib/openOrderItems'
import { round } from '../lib/pricing-utils'
import { uid } from '../lib/utils'
import type { OpenOrderActionResult } from './types'

export const openOrderSnapshot = (order: OpenOrder): Record<string, AuditJsonValue> => ({
  tableName: order.tableName,
  itemCount: order.items.length,
  total: order.total,
  discount: order.discount,
})

export const buildUpdatedOpenOrder = (
  order: OpenOrder,
  requestedItems: OrderItem[],
  discount: number | undefined,
  note: string | undefined,
  actor: User,
  current: Database,
): OpenOrderActionResult => {
  const store = current.stores.find((item) => item.id === order.storeId)
  if (!store) return { ok: false, error: 'Store not found.' }
  const resolved = resolveOpenOrderItems(current.products, store, requestedItems)
  if (!resolved.ok) return resolved
  const items = [
    ...order.items,
    ...resolved.items.map((item) => ({ ...item, lineId: uid('line') })),
  ]
  const nextDiscount = discount === undefined ? order.discount : round(discount)
  if (!Number.isFinite(nextDiscount) || nextDiscount < 0) {
    return { ok: false, error: 'Discount must be zero or a positive amount.' }
  }
  if (discount !== undefined && nextDiscount !== order.discount && nextDiscount > 0 &&
    actor.role !== 'admin' && !actor.permissions.discount) {
    return { ok: false, error: 'You do not have permission to apply discounts.' }
  }
  const undiscounted = computeTotals(items, store.settings)
  if (nextDiscount > undiscounted.total) {
    return { ok: false, error: 'Discount cannot exceed the order total.' }
  }
  if (note !== undefined && (typeof note !== 'string' || note.trim().length > 500)) {
    return { ok: false, error: 'Order notes must be 500 characters or fewer.' }
  }
  const totals = computeTotals(items, store.settings, nextDiscount)
  return {
    ok: true,
    order: {
      ...order,
      items,
      ...totals,
      discount: nextDiscount,
      note: note === undefined ? order.note : note.trim() || undefined,
      updatedAt: new Date().toISOString(),
    },
  }
}

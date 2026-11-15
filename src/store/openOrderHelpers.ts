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
  items: order.items.map((item) => ({ name: item.name, qty: item.qty })),
  tableHistory: (order.tableHistory ?? []).map((event) => ({
    type: event.type,
    actorId: event.actorId,
    actorName: event.actorName,
    at: event.at,
    details: event.details ?? '',
  })),
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
  const addedAt = new Date().toISOString()
  const seenLineIds = new Set(order.items.map((item) => item.lineId).filter((id): id is string => !!id))
  const resolvedAdditions = resolved.items.flatMap((item, index) => {
    const requested = requestedItems[index]
    const lineId = requested.lineId || uid('line')
    if (seenLineIds.has(lineId)) return []
    seenLineIds.add(lineId)
    const product = current.products.find((candidate) =>
      candidate.id === item.productId && candidate.storeId === order.storeId,
    )
    const category = product
      ? current.categories.find((candidate) =>
          candidate.id === product.categoryId && candidate.storeId === order.storeId,
        )
      : undefined
    return [{
      ...item,
      lineId,
      stationId: product?.stationId === null ? undefined : product?.stationId ?? category?.stationId,
      status: 'draft' as const,
      addedAt,
      updatedAt: addedAt,
      addedById: actor.id,
      addedByName: actor.name,
    }]
  })
  const items = [...order.items, ...resolvedAdditions]
  const tableHistory = resolvedAdditions.length
    ? [
        ...(order.tableHistory ?? []),
        {
          id: uid('evt'),
          type: 'items_added' as const,
          actorId: actor.id,
          actorName: actor.name,
          at: addedAt,
          details: `${resolvedAdditions.length} item line${resolvedAdditions.length === 1 ? '' : 's'}`,
        },
      ]
    : order.tableHistory
  const nextDiscount = discount === undefined ? order.discount : round(discount)
  if (!Number.isFinite(nextDiscount) || nextDiscount < 0) {
    return { ok: false, error: 'Discount must be zero or a positive amount.' }
  }
  if (discount !== undefined && nextDiscount !== order.discount && nextDiscount > 0 &&
    actor.role !== 'admin' && !actor.permissions.discount) {
    return { ok: false, error: 'You do not have permission to apply discounts.' }
  }
  const billableItems = items.filter((item) => item.status !== 'void')
  const undiscounted = computeTotals(billableItems, store.settings)
  if (nextDiscount > undiscounted.total) {
    return { ok: false, error: 'Discount cannot exceed the order total.' }
  }
  if (note !== undefined && (typeof note !== 'string' || note.trim().length > 500)) {
    return { ok: false, error: 'Order notes must be 500 characters or fewer.' }
  }
  const totals = computeTotals(billableItems, store.settings, nextDiscount)
  return {
    ok: true,
    order: {
      ...order,
      items,
      tableHistory,
      ...totals,
      discount: nextDiscount,
      note: note === undefined ? order.note : note.trim() || undefined,
      updatedAt: addedAt,
    },
  }
}

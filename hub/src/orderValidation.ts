import { computeTotals } from '../../src/lib/pricing.ts'
import { resolveOpenOrderItems } from '../../src/lib/openOrderItems.ts'
import { round } from '../../src/lib/pricing-utils.ts'
import type { OrderItem, Product, Store } from '../../src/types.ts'
import { requireCapability } from './auth.ts'
import type { AuthenticatedActor, HubStoreState } from './types.ts'

export function validateOrderDocument(
  input: Record<string, unknown>,
  collection: 'orders' | 'openOrders',
  state: HubStoreState,
  actor: AuthenticatedActor,
): Record<string, unknown> {
  const store = state.collections.stores?.[actor.storeId] as unknown as Store | undefined
  const user = state.collections.users?.[actor.userId]
  if (!store?.settings || !user) throw new Error('Store settings or authenticated user are unavailable.')
  if (!Number.isFinite(store.settings.taxRate) || store.settings.taxRate < 0 ||
    !Number.isFinite(store.settings.serviceCharge) || store.settings.serviceCharge < 0 ||
    typeof store.settings.taxInclusive !== 'boolean') {
    throw new Error('Store tax and service-charge settings are invalid.')
  }
  if (!Array.isArray(input.items) || input.items.length > 300) throw new Error('Order must contain no more than 300 items.')
  const products = Object.values(state.collections.products ?? {}) as unknown as Product[]
  const requestedItems = input.items as OrderItem[]
  const resolved = resolveOpenOrderItems(products, store, requestedItems)
  if (!resolved.ok) throw new Error(resolved.error)
  const previous = state.collections[collection]?.[String(input.id)]
  const previousItems = previous && Array.isArray(previous.items) ? previous.items as Array<Record<string, unknown>> : []
  const seenLineIds = new Set<string>()
  const items = resolved.items.map((item, index) => {
    const source = requestedItems[index] as unknown as Record<string, unknown>
    const old = previousItems.find((candidate) =>
      (typeof source.lineId === 'string' && candidate.lineId === source.lineId) ||
      (!source.lineId && candidate.productId === item.productId && previousItems.indexOf(candidate) === index),
    )
    const lineId = typeof source.lineId === 'string'
      ? source.lineId
      : typeof old?.lineId === 'string'
        ? old.lineId
        : typeof source.id === 'string'
          ? source.id
          : undefined
    if (collection === 'openOrders' && !lineId) throw new Error('Open-order items require a stable line ID.')
    if (lineId) {
      if (lineId.length > 128 || seenLineIds.has(lineId)) throw new Error('Order contains an invalid or duplicate line ID.')
      seenLineIds.add(lineId)
    }
    let status: unknown = source.status ?? old?.status
    if (status !== undefined && !['draft', 'sent', 'preparing', 'ready', 'served', 'void'].includes(String(status))) {
      throw new Error('Order contains an invalid item status.')
    }
    if (old && status !== old.status && status !== 'void') {
      throw new Error('Use the station status endpoint to change a sent item lifecycle.')
    }
    if (!old && status !== undefined && status !== 'draft' && status !== 'sent') {
      throw new Error('New order items must start as draft or sent.')
    }
    const voidReason = status === 'void' ? source.voidReason : undefined
    if (status === 'void') {
      requireCapability(actor, 'voidOrders')
      if (typeof voidReason !== 'string' || !voidReason.trim() || voidReason.length > 240) {
        throw new Error('A reason is required to void an order item.')
      }
    }
    const product = products.find((candidate) => candidate.id === item.productId && candidate.storeId === actor.storeId)
    const categories = Object.values(state.collections.categories ?? {}) as Array<{
      id: string
      storeId: string
      stationId?: string | null
    }>
    const category = product
      ? categories.find((candidate) =>
          candidate.id === product.categoryId && candidate.storeId === actor.storeId,
        )
      : undefined
    const stationId = product?.stationId === null ? undefined : product?.stationId ?? category?.stationId
    if (typeof stationId === 'string' && !state.collections.stations?.[stationId]) {
      throw new Error('Product routing references an unavailable station.')
    }
    return {
      ...item,
      id: lineId,
      lineId,
      stationId,
      status,
      sentAt: status === 'sent' ? (old?.sentAt ?? new Date().toISOString()) : old?.sentAt,
      addedAt: old?.addedAt ?? new Date().toISOString(),
      addedById: old?.addedById ?? actor.userId,
      addedByName: old?.addedByName ?? String(user.name),
      voidReason,
    }
  })

  const requestedDiscount = input.discount === undefined ? 0 : input.discount
  if (typeof requestedDiscount !== 'number' || !Number.isFinite(requestedDiscount) || requestedDiscount < 0) {
    throw new Error('Order discount must be a non-negative amount.')
  }
  const discount = round(requestedDiscount)
  if (discount > 0) requireCapability(actor, 'discount')
  if (collection === 'orders') {
    if (!['cash', 'card', 'credit', 'unpaid'].includes(String(input.paymentMethod))) {
      throw new Error('Order payment method is invalid.')
    }
    if (input.paymentMethod === 'credit') {
      if (!store.settings.allowCredit || typeof input.customerId !== 'string') {
        throw new Error('Credit sales require credit to be enabled and a customer selected.')
      }
      requireCapability(actor, 'credit')
    }
  }
  const payableItems = items.filter((item) => item.status !== 'void')
  const totals = computeTotals(payableItems, store.settings, discount)
  if (discount > round(totals.subtotal + totals.service)) throw new Error('Order discount exceeds the order amount.')
  const number = input.number
  if (!Number.isSafeInteger(number) || Number(number) < 1) throw new Error('Order number must be a positive integer.')
  const duplicateNumber = Object.values(state.collections[collection] ?? {}).some((candidate) =>
    candidate.id !== input.id && candidate.number === number,
  )
  if (duplicateNumber) throw new Error('Order number is already in use in this store.')
  for (const [field, collectionName] of [
    ['tableId', 'tables'], ['sectionId', 'sections'], ['customerId', 'customers'], ['shiftId', 'shifts'],
  ] as const) {
    const reference = input[field]
    if (reference !== undefined && (typeof reference !== 'string' || state.collections[collectionName]?.[reference]?.storeId !== actor.storeId)) {
      throw new Error(`Order ${field} must reference an entity in this store.`)
    }
  }
  if (collection === 'orders' && input.status === 'void') requireCapability(actor, 'voidOrders')
  return {
    ...input,
    items,
    discount: round(discount),
    ...totals,
    taxRate: store.settings.taxRate,
    staffId: typeof previous?.staffId === 'string' ? previous.staffId : actor.userId,
    staffName: typeof previous?.staffName === 'string' ? previous.staffName : String(user.name),
    createdAt: typeof previous?.createdAt === 'string' ? previous.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

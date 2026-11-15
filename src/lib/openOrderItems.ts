import type { InventoryItem, OrderItem, Product, Store } from '../types.ts'
import { resolveOrderLines, type OrderRulesContext } from '../shared/orderRules.ts'

export type OpenOrderItemsResult =
  | { ok: true; items: OrderItem[] }
  | { ok: false; error: string }

/** Kept as the open-order-facing wrapper; the single implementation lives in orderRules. */
export const resolveOpenOrderItems = (
  products: Product[],
  store: Store,
  requestedItems: OrderItem[],
  inventoryItems: InventoryItem[] = [],
  options: Omit<OrderRulesContext, 'store' | 'products' | 'inventoryItems'> = {},
): OpenOrderItemsResult => {
  if (!Array.isArray(requestedItems)) return { ok: false, error: 'The order items are invalid.' }
  const resolved = resolveOrderLines(requestedItems, { store, products, inventoryItems, ...options })
  if (!resolved.ok) return { ok: false, error: resolved.error }
  return { ok: true, items: resolved.items }
}

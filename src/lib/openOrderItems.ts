import type { OrderItem, OrderModifier, Product, Store } from '../types'
import { round } from './pricing-utils'

export type OpenOrderItemsResult =
  | { ok: true; items: OrderItem[] }
  | { ok: false; error: string }

export const resolveOpenOrderItems = (
  products: Product[],
  store: Store,
  requestedItems: OrderItem[],
): OpenOrderItemsResult => {
  if (!Array.isArray(requestedItems)) return { ok: false, error: 'The order items are invalid.' }
  const resolved: OrderItem[] = []

  for (const item of requestedItems) {
    if (!item || typeof item.productId !== 'string' || !Number.isFinite(item.qty) || item.qty <= 0) {
      return { ok: false, error: 'Each item quantity must be a positive amount.' }
    }
    const product = products.find((candidate) =>
      candidate.id === item.productId && candidate.storeId === store.id && candidate.active,
    )
    if (!product) return { ok: false, error: 'An item in the cart is unavailable in this store.' }

    const qty = round(item.qty)
    if (qty <= 0) return { ok: false, error: 'Weight must be greater than zero.' }
    if (product.soldByWeight) {
      if (!store.settings.features.weightItems) {
        return { ok: false, error: 'Weight-based sales are disabled for this store.' }
      }
      if (qty !== item.qty) return { ok: false, error: 'Weight must be entered to three decimal places.' }
    } else if (!Number.isSafeInteger(item.qty)) {
      return { ok: false, error: 'Each item quantity must be a positive whole number.' }
    }

    const variant = item.variantId
      ? product.variants?.find((candidate) => candidate.id === item.variantId)
      : undefined
    if (item.variantId && !variant) return { ok: false, error: `Choose a valid variant for ${product.name}.` }
    if (product.variants?.length && !variant) return { ok: false, error: `Choose a variant for ${product.name}.` }

    const selected: OrderModifier[] = []
    const seenGroups = new Set<string>()
    const seenOptions = new Set<string>()
    const requestedModifiers = Array.isArray(item.modifiers) ? item.modifiers : []
    for (const requested of requestedModifiers) {
      if (!requested || typeof requested.groupId !== 'string' || typeof requested.optionId !== 'string') {
        return { ok: false, error: `Choose valid options for ${product.name}.` }
      }
      const group = product.modifiers?.find((candidate) => candidate.id === requested.groupId)
      const option = group?.options.find((candidate) => candidate.id === requested.optionId)
      const optionKey = `${requested.groupId}:${requested.optionId}`
      if (!group || !option || seenOptions.has(optionKey) ||
        (group.selection === 'single' && seenGroups.has(group.id))) {
        return { ok: false, error: `Choose valid options for ${product.name}.` }
      }
      seenGroups.add(group.id)
      seenOptions.add(optionKey)
      selected.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDelta: option.priceDelta,
      })
    }
    for (const group of product.modifiers ?? []) {
      const selectedCount = selected.filter((modifier) => modifier.groupId === group.id).length
      if (group.required && !selectedCount) {
        return { ok: false, error: `Select an option for ${group.name} on ${product.name}.` }
      }
      if (group.selection === 'single' && selectedCount > 1) {
        return { ok: false, error: `Choose only one option for ${group.name}.` }
      }
    }

    const price = round((variant?.price ?? product.price) +
      selected.reduce((sum, option) => sum + option.priceDelta, 0))
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: `The configured price for ${product.name} is invalid.` }
    }
    resolved.push({
      productId: product.id,
      name: product.name,
      price,
      qty,
      variantId: variant?.id,
      variantName: variant?.name,
      modifiers: selected,
      note: typeof item.note === 'string' ? item.note.trim().slice(0, 240) : '',
      saleUnit: product.soldByWeight ? product.saleUnit ?? 'piece' : undefined,
      soldByWeight: product.soldByWeight === true,
    })
  }

  return { ok: true, items: resolved }
}

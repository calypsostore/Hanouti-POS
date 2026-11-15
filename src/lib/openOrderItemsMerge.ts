import type { OrderItem } from '../types'

export const mergeOpenOrderItems = (
  primaryItems: OrderItem[],
  secondaryItems: OrderItem[],
  primaryUpdatedAt: string,
  secondaryUpdatedAt: string,
): OrderItem[] => {
  const itemMap = new Map<string, OrderItem>()
  for (const item of secondaryItems) {
    const id = item.lineId ?? `${item.productId}:${item.variantId ?? ''}`
    itemMap.set(id, item)
  }
  for (const item of primaryItems) {
    const id = item.lineId ?? `${item.productId}:${item.variantId ?? ''}`
    const previous = itemMap.get(id)
    const itemTime = Date.parse(item.updatedAt ?? item.addedAt ?? primaryUpdatedAt)
    const previousTime = previous
      ? Date.parse(previous.updatedAt ?? previous.addedAt ?? secondaryUpdatedAt)
      : Number.NEGATIVE_INFINITY
    if (!previous || itemTime >= previousTime) itemMap.set(id, item)
  }
  return [...itemMap.values()]
}

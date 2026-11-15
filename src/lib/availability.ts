import type { AvailabilitySettings, InventoryItem, Product, ProductVariant } from '../types.ts'

export type AvailabilityResult = {
  unavailable: boolean
  reason: string
  source: 'manual' | 'stock' | 'inventory' | null
  since?: string
  byId?: string
}

const FALLBACK_SETTINGS: AvailabilitySettings = {
  enabled: true,
  autoEightySixAtZero: true,
  autoReturnOnRestock: true,
  requireReason: true,
  reasons: [],
  defaultReturnMode: 'manual',
  resetManualAtDayStart: false,
  resetManualAtFirstShift: false,
  displayStyle: 'big_red_x',
  showListButton: true,
}

export function isUnavailable(
  product: Product,
  variant: ProductVariant | undefined,
  settings?: AvailabilitySettings,
  inventoryItem?: InventoryItem,
  now: Date = new Date(),
): AvailabilityResult {
  const config = settings ?? FALLBACK_SETTINGS
  if (config.enabled === false) return { unavailable: false, reason: '', source: null }

  const flag = variant?.eightySix?.active ? variant.eightySix : product.eightySix
  const stockTracked = variant ? variant.trackStock : product.trackStock
  const stock = variant ? variant.stock : product.stock
  const inventoryTracked = Boolean(product.inventoryItemId)
  const hasStock = (!stockTracked || stock > 0) && (!inventoryTracked || (inventoryItem?.onHand ?? 0) > 0)
  const timedReturn = flag?.returnMode === 'at_time' && flag.backAt &&
    Number.isFinite(Date.parse(flag.backAt)) && Date.parse(flag.backAt) <= now.getTime()
  const restockReturn = flag?.returnMode === 'on_restock' && config.autoReturnOnRestock !== false && hasStock

  if (flag?.active && !timedReturn && !restockReturn) {
    return {
      unavailable: true,
      reason: flag.reason || 'Unavailable',
      source: 'manual',
      since: flag.at,
      byId: flag.byId,
    }
  }
  if (config.autoEightySixAtZero !== false && stockTracked && stock <= 0) {
    return { unavailable: true, reason: 'Out of stock', source: 'stock' }
  }
  if (inventoryTracked && (inventoryItem?.onHand ?? 0) <= 0) {
    return { unavailable: true, reason: 'Out of stock', source: 'inventory' }
  }
  return { unavailable: false, reason: '', source: null }
}

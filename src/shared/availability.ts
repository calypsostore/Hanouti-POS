import type { AvailabilitySettings, InventoryItem, Product, ProductVariant } from '../types.ts'

export type AvailabilityResult = {
  unavailable: boolean
  reason: string
  source: 'manual' | 'stock' | 'inventory' | null
  since?: string
  byId?: string
}

export type AvailabilityFlagChange = {
  productId: string
  productName: string
  variantId?: string
  variantName?: string
  reason: string
  returnMode: 'manual' | 'on_restock' | 'at_time'
}

const FALLBACK_SETTINGS: AvailabilitySettings = {
  enabled: true,
  autoEightySixAtZero: true,
  autoReturnOnRestock: true,
  requireReason: true,
  reasons: [],
  defaultReturnMode: 'on_restock',
  resetManualAtDayStart: false,
  resetManualAtFirstShift: false,
  displayStyle: 'big_red_x',
  showListButton: true,
  notifyStaffAboutChanges: true,
  showCountOnStationScreens: true,
}

const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function isUnavailable(
  product: Product,
  variant: ProductVariant | undefined,
  settings?: AvailabilitySettings,
  inventory?: InventoryItem | InventoryItem[],
  now: Date = new Date(),
  deductIngredients = false,
): AvailabilityResult {
  const config = settings ?? FALLBACK_SETTINGS
  if (config.enabled === false) return { unavailable: false, reason: '', source: null }

  const flag = variant?.eightySix?.active ? variant.eightySix : product.eightySix
  const stockTracked = variant ? variant.trackStock : product.trackStock
  const stock = variant ? variant.stock : product.stock
  const items = inventory ? (Array.isArray(inventory) ? inventory : [inventory]) : []
  const linked = items.find((item) => item.id === product.inventoryItemId)
  const recipe = [...(product.recipe ?? []), ...(variant?.recipe ?? [])]
  const recipeShort = deductIngredients && recipe.some((line) =>
    (items.find((item) => item.id === line.inventoryItemId)?.onHand ?? 0) < line.qtyPerUnit,
  )
  const inventoryTracked = Boolean(product.inventoryItemId) && recipe.length === 0
  const hasStock = (!stockTracked || stock > 0) &&
    (!inventoryTracked || (linked?.onHand ?? 0) > 0) && !recipeShort
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
  if (inventoryTracked && (linked?.onHand ?? 0) < 1) {
    return { unavailable: true, reason: 'Out of stock', source: 'inventory' }
  }
  if (recipeShort) {
    return { unavailable: true, reason: 'Ingredient out of stock', source: 'inventory' }
  }
  return { unavailable: false, reason: '', source: null }
}

export function clearManualFlags(
  products: Product[],
  localDay?: string,
): { products: Product[]; changes: AvailabilityFlagChange[] } {
  const changes: AvailabilityFlagChange[] = []
  const clear = (
    flag: Product['eightySix'],
    product: Product,
    variant?: ProductVariant,
  ): Product['eightySix'] => {
    if (!flag?.active || flag.returnMode !== 'manual' ||
      (localDay !== undefined && localDateKey(new Date(flag.at)) === localDay)) return flag
    changes.push({
      productId: product.id,
      productName: product.name,
      variantId: variant?.id,
      variantName: variant?.name,
      reason: flag.reason || 'Unavailable',
      returnMode: 'manual',
    })
    return { ...flag, active: false }
  }
  return {
    products: products.map((product) => ({
      ...product,
      eightySix: clear(product.eightySix, product),
      variants: product.variants?.map((variant) => ({
        ...variant,
        eightySix: clear(variant.eightySix, product, variant),
      })),
    })),
    changes,
  }
}

export function clearReturnedFlags(
  products: Product[],
  inventoryItems: InventoryItem[],
  settings: AvailabilitySettings,
  now: Date = new Date(),
): { products: Product[]; changes: AvailabilityFlagChange[] } {
  const changes: AvailabilityFlagChange[] = []
  const clear = (
    flag: Product['eightySix'],
    product: Product,
    variant?: ProductVariant,
  ): Product['eightySix'] => {
    if (!flag?.active) return flag
    const inventory = inventoryItems.find((item) =>
      item.id === product.inventoryItemId && item.storeId === product.storeId,
    )
    const trackStock = variant ? variant.trackStock : product.trackStock
    const stock = variant ? variant.stock : product.stock
    const recipe = [...(product.recipe ?? []), ...(variant?.recipe ?? [])]
    const recipeOk = recipe.every((line) =>
      (inventoryItems.find((item) => item.id === line.inventoryItemId)?.onHand ?? 0) >= line.qtyPerUnit,
    )
    const hasStock = (!trackStock || stock > 0) &&
      (!product.inventoryItemId || (inventory?.onHand ?? 0) > 0) && recipeOk
    const timedReturn = flag.returnMode === 'at_time' && Boolean(flag.backAt) &&
      Number.isFinite(Date.parse(flag.backAt ?? '')) && Date.parse(flag.backAt ?? '') <= now.getTime()
    const restockReturn = flag.returnMode === 'on_restock' &&
      settings.autoReturnOnRestock !== false && hasStock
    if (!timedReturn && !restockReturn) return flag
    changes.push({
      productId: product.id,
      productName: product.name,
      variantId: variant?.id,
      variantName: variant?.name,
      reason: flag.reason || 'Unavailable',
      returnMode: flag.returnMode,
    })
    return { ...flag, active: false }
  }
  return {
    products: products.map((product) => ({
      ...product,
      eightySix: clear(product.eightySix, product),
      variants: product.variants?.map((variant) => ({
        ...variant,
        eightySix: clear(variant.eightySix, product, variant),
      })),
    })),
    changes,
  }
}

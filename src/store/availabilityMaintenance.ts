import type { Database, Product } from '../types'
import { clearManualFlags, clearReturnedFlags, isUnavailable } from '../shared/availability'
import { addLog, type AuditActor } from './audit'

const SYSTEM_ACTOR = { id: 'system', name: '7anouti', role: 'unknown' as const }

const productLabel = (productName: string, variantName?: string) =>
  `${productName}${variantName ? ` (${variantName})` : ''}`

function logFlagChanges(
  database: Database,
  actor: AuditActor,
  storeId: string,
  changes: ReturnType<typeof clearManualFlags>['changes'],
  summary: string,
): Database {
  return changes.reduce((next, change) => addLog(next, actor, {
    storeId,
    action: 'deactivated',
    entity: 'product',
    entityId: change.productId,
    summary: `${summary} ${productLabel(change.productName, change.variantName)}${change.reason ? `: ${change.reason}` : ''}`,
    before: { active: true, returnMode: change.returnMode },
    after: { active: false },
  }), database)
}

export function clearManualAvailability(
  database: Database,
  storeId: string,
  actor: AuditActor = SYSTEM_ACTOR,
  localDay?: string,
): Database {
  const products = database.products.filter((product) => product.storeId === storeId)
  const result = clearManualFlags(products, localDay)
  if (!result.changes.length) return database
  const updatedProducts = new Map<string, Product>(
    result.products.map((product): [string, Product] => [product.id, product]),
  )
  const updated = {
    ...database,
    products: database.products.map((product) => updatedProducts.get(product.id) ?? product),
  }
  return logFlagChanges(updated, actor, storeId, result.changes, 'Reset manual 86 for')
}

export function availabilityMaintenanceNeeded(database: Database, now: Date, localDay: string): boolean {
  for (const store of database.stores) {
    const products = database.products.filter((product) => product.storeId === store.id)
    if (store.settings.availability.resetManualAtDayStart &&
      clearManualFlags(products, localDay).changes.length > 0) return true
    if (clearReturnedFlags(
      products,
      database.inventoryItems,
      store.settings.availability,
      now,
    ).changes.length > 0) return true
  }
  return false
}

type AvailabilityRecord = {
  product: Product
  variant?: NonNullable<Product['variants']>[number]
}

const rowsFor = (products: Product[]): AvailabilityRecord[] => products.flatMap((product) =>
  product.variants?.length
    ? product.variants.map((variant) => ({ product, variant }))
    : [{ product }],
)

export function maintainAvailabilityAfterStockChange(
  previous: Database,
  products: Product[],
  inventoryItems: Database['inventoryItems'],
  actor: AuditActor,
  now: Date = new Date(),
): Database {
  let nextProducts = products
  let next = { ...previous, products, inventoryItems }
  for (const store of previous.stores) {
    const storeProducts = nextProducts.filter((product) => product.storeId === store.id)
    const result = clearReturnedFlags(storeProducts, inventoryItems, store.settings.availability, now)
    if (result.changes.length) {
      const updatedProducts = new Map<string, Product>(
        result.products.map((product): [string, Product] => [product.id, product]),
      )
      nextProducts = nextProducts.map((product) => updatedProducts.get(product.id) ?? product)
      next = { ...next, products: nextProducts }
      next = logFlagChanges(next, actor, store.id, result.changes, 'Returned')
    }

    const beforeProducts = previous.products.filter((product) => product.storeId === store.id)
    const afterProducts = nextProducts.filter((product) => product.storeId === store.id)
    const beforeInventory = previous.inventoryItems
    for (const after of rowsFor(afterProducts)) {
      const beforeProduct = beforeProducts.find((product) => product.id === after.product.id)
      const beforeVariant = after.variant
        ? beforeProduct?.variants?.find((variant) => variant.id === after.variant?.id)
        : undefined
      if (!beforeProduct || (after.variant && !beforeVariant)) continue
      const oldInventory = beforeInventory.find((item) =>
        item.id === beforeProduct.inventoryItemId && item.storeId === store.id,
      )
      const currentInventory = inventoryItems.find((item) =>
        item.id === after.product.inventoryItemId && item.storeId === store.id,
      )
      const was = isUnavailable(beforeProduct, beforeVariant, store.settings.availability, oldInventory, now)
      const is = isUnavailable(after.product, after.variant, store.settings.availability, currentInventory, now)
      if (was.unavailable === is.unavailable) continue
      const automatic = was.source === 'stock' || was.source === 'inventory' ||
        is.source === 'stock' || is.source === 'inventory'
      if (!automatic) continue
      const returned = was.unavailable && !is.unavailable
      next = addLog(next, actor, {
        storeId: store.id,
        action: returned ? 'deactivated' : 'activated',
        entity: 'product',
        entityId: after.product.id,
        summary: returned
          ? `Returned ${productLabel(after.product.name, after.variant?.name)}`
          : `86d ${productLabel(after.product.name, after.variant?.name)}: ${is.reason}`,
        before: { unavailable: was.unavailable, reason: was.reason },
        after: { unavailable: is.unavailable, reason: is.reason },
      })
    }
  }
  return { ...next, products: nextProducts, inventoryItems }
}

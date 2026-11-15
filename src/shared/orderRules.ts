import type {
  InventoryItem, OpenOrder, OrderItem, OrderModifier, Product, ProductVariant,
  StockOverride, Store, User,
} from '../types.ts'
import { round } from '../lib/pricing-utils.ts'
import { canOverrideStock } from '../lib/permissions.ts'
import { isUnavailable } from './availability.ts'

export type OrderRuleCode =
  | 'UNAVAILABLE_86'
  | 'OVER_STOCK'
  | 'INGREDIENT_SHORT'
  | 'PRODUCT_INACTIVE'
  | 'PRICE_CHANGED'
  | 'OPTION_INVALID'
  | 'CREDIT_LIMIT'
  | 'DISCOUNT_NOT_ALLOWED'

export type OrderIssueCode = OrderRuleCode

export interface OrderRuleIssue {
  code: OrderRuleCode
  lineId?: string
  severity: 'block' | 'warn'
  message: string
  data?: Record<string, string | number | boolean | null>
}

export interface OrderRulesContext {
  store: Store
  products: Product[]
  inventoryItems: InventoryItem[]
  openOrders?: OpenOrder[]
  /** The order being edited/paid is not its own reservation. */
  excludeOpenOrderId?: string
  actor?: Pick<User, 'id' | 'name' | 'role' | 'permissions' | 'stationOnly'>
  users?: User[]
  customer?: { id: string; limit: number; balance: number }
  payWithCredit?: boolean
  validateSentItems?: boolean
  discount?: number
  estimatedTotal?: number
}

const SENT_STATUSES = new Set(['sent', 'preparing', 'ready', 'served'])

export const stockKey = (productId: string, variantId?: string): string =>
  `${productId}:${variantId ?? 'base'}`

const optionOf = (product: Product, groupId: string, optionId: string) =>
  product.modifiers?.find((group) => group.id === groupId)?.options.find((option) => option.id === optionId)

export function recipeFor(
  product: Product,
  variant: ProductVariant | undefined,
  modifiers: OrderModifier[] | undefined,
): Array<{ inventoryItemId: string; qtyPerUnit: number }> {
  const amounts = new Map<string, number>()
  const recipe = [...(product.recipe ?? []), ...(variant?.recipe ?? [])]
  for (const modifier of modifiers ?? []) {
    const option = optionOf(product, modifier.groupId, modifier.optionId)
    recipe.push(...(option?.recipe ?? []))
  }
  for (const ingredient of recipe) {
    amounts.set(
      ingredient.inventoryItemId,
      (amounts.get(ingredient.inventoryItemId) ?? 0) + ingredient.qtyPerUnit,
    )
  }
  return [...amounts].map(([inventoryItemId, qtyPerUnit]) => ({ inventoryItemId, qtyPerUnit }))
}

export interface Reservations {
  stock: Map<string, number>
  ingredients: Map<string, number>
}

/** Quantity already promised by every open table order (draft and sent, unpaid). */
export function computeReservations(
  openOrders: OpenOrder[] | undefined,
  products: Product[],
  excludeOpenOrderId?: string,
  deductIngredients = true,
): Reservations {
  const stamp = new Map<string, number>()
  const ingredients = new Map<string, number>()
  for (const order of openOrders ?? []) {
    if (order.status !== 'open' || order.id === excludeOpenOrderId) continue
    for (const item of order.items) {
      if (item.status === 'void') continue
      const product = products.find((candidate) => candidate.id === item.productId)
      if (!product) continue
      const variant = product.variants?.find((candidate) => candidate.id === item.variantId)
      const recipe = recipeFor(product, variant, item.modifiers)
      if (recipe.length && deductIngredients) {
        for (const line of recipe) {
          ingredients.set(line.inventoryItemId, (ingredients.get(line.inventoryItemId) ?? 0) + line.qtyPerUnit * item.qty)
        }
      } else if (product.inventoryItemId && !(recipe.length && deductIngredients)) {
        ingredients.set(
          product.inventoryItemId,
          (ingredients.get(product.inventoryItemId) ?? 0) + item.qty,
        )
      }
      if (variant?.trackStock || product.trackStock) {
        const key = stockKey(product.id, item.variantId)
        stamp.set(key, (stamp.get(key) ?? 0) + item.qty)
      }
    }
  }
  return { stock: stamp, ingredients }
}

export function availableStock(
  product: Product,
  variant: ProductVariant | undefined,
  reservations: Reservations,
  inventoryItems: InventoryItem[] = [],
  deductIngredients = false,
): number {
  const tracked = variant ? variant.trackStock : product.trackStock
  const stockAvailable = tracked
    ? round((variant ? variant.stock : product.stock) -
      (reservations.stock.get(stockKey(product.id, variant?.id)) ?? 0))
    : Number.POSITIVE_INFINITY
  const hasRecipe = deductIngredients && Boolean(product.recipe?.length || variant?.recipe?.length)
  const inventoryAvailable = product.inventoryItemId && !hasRecipe
    ? availableIngredient(product.inventoryItemId, inventoryItems, reservations)
    : Number.POSITIVE_INFINITY
  return Math.min(stockAvailable, inventoryAvailable)
}

export function availableIngredient(
  itemId: string,
  inventoryItems: InventoryItem[],
  reservations: Reservations,
): number {
  const item = inventoryItems.find((candidate) => candidate.id === itemId)
  if (!item) return Number.POSITIVE_INFINITY
  return round(item.onHand - (reservations.ingredients.get(itemId) ?? 0))
}

const stockSeverity = (store: Store): 'block' | 'warn' | null => {
  const mode = store.settings.orderRules.stockOverflowMode
  return mode === 'block' ? 'block' : mode === 'warn' ? 'warn' : null
}

export function stockOverrideAccepted(
  override: StockOverride | undefined,
  qty: number,
  ctx: OrderRulesContext,
): boolean {
  if (!override || typeof override.confirmedById !== 'string') return false
  if (!Number.isFinite(override.requested) || override.requested !== qty ||
    !Number.isFinite(override.available) || override.available < 0 ||
    !Number.isFinite(Date.parse(override.at)) || Date.parse(override.at) > Date.now()) return false
  const confirmers = ctx.users ?? []
  const confirmer = confirmers.find((candidate) =>
    candidate.id === override.confirmedById &&
    candidate.storeId === ctx.store.id &&
    candidate.active,
  )
  if (!confirmer) return false
  return canOverrideStock(confirmer, ctx.store.settings.orderRules)
}

/** The single rules engine: same result in the app, the POS UI and the hub. */
export function validateOrderLines(lines: OrderItem[], ctx: OrderRulesContext): OrderRuleIssue[] {
  const issues: OrderRuleIssue[] = []
  const reservations = computeReservations(
    ctx.openOrders,
    ctx.products,
    ctx.excludeOpenOrderId,
    ctx.store.settings.orderRules.deductIngredientsOnSale,
  )
  const now = new Date()
  const checkout = Boolean(ctx.payWithCredit)
  const consumed = computeReservations([], ctx.products)

  for (const line of lines) {
    const lineId = line.lineId
    if (line.status === 'void') continue
    const product = ctx.products.find((candidate) => candidate.id === line.productId)
    const sent = SENT_STATUSES.has(String(line.status))
    if (!product || (!product.active && !sent)) {
      issues.push({
        code: 'PRODUCT_INACTIVE',
        lineId,
        severity: 'block',
        message: `${product?.name ?? line.name} is no longer available.`,
        data: { productId: line.productId },
      })
      continue
    }
    if (!product.soldByWeight && !Number.isSafeInteger(line.qty)) {      issues.push({ code: 'OPTION_INVALID', lineId, severity: 'block', message: `${product.name} must be sold in whole units.` })
    }
    if (line.qty <= 0 || !Number.isFinite(line.qty)) {
      issues.push({ code: 'OPTION_INVALID', lineId, severity: 'block', message: `Enter a valid quantity for ${product.name}.` })
      continue
    }
    const variant = line.variantId
      ? product.variants?.find((candidate) => candidate.id === line.variantId)
      : undefined
    if (line.variantId && !variant) {
      issues.push({ code: 'OPTION_INVALID', lineId, severity: 'block', message: `Choose a valid variant for ${product.name}.` })
      continue
    }
    if ((product.variants?.length ?? 0) > 0 && !variant) {
      issues.push({ code: 'OPTION_INVALID', lineId, severity: 'block', message: `Choose a variant for ${product.name}.` })
      continue
    }

    const seenGroups = new Set<string>()
    const seenOptions = new Set<string>()
    let modifiersValid = true
    for (const modifier of line.modifiers ?? []) {
      const group = product.modifiers?.find((candidate) => candidate.id === modifier.groupId)
      const option = group?.options.find((candidate) => candidate.id === modifier.optionId)
      const optionKey = `${modifier.groupId}:${modifier.optionId}`
      if (!group || !option || seenOptions.has(optionKey) ||
        (group.selection === 'single' && seenGroups.has(group.id))) {
        modifiersValid = false
        break
      }
      seenGroups.add(group.id)
      seenOptions.add(optionKey)
    }
    for (const group of product.modifiers ?? []) {
      const selected = (line.modifiers ?? []).filter((modifier) => modifier.groupId === group.id).length
      if (group.required && !selected) modifiersValid = false
      if (group.selection === 'single' && selected > 1) modifiersValid = false
    }
    if (!modifiersValid) {
      issues.push({
        code: 'OPTION_INVALID',
        lineId,
        severity: 'block',
        message: `Choose valid options for ${product.name}.`,
      })
      continue
    }

    const expected = round((variant?.price ?? product.price) +
      (line.modifiers ?? []).reduce((sum, modifier) => sum + modifier.priceDelta, 0))
    if (Math.abs(expected - line.price) > 0.0005) {
      issues.push({
        code: 'PRICE_CHANGED',
        lineId,
        severity: 'warn',
        message: `${product.name} is now ${expected.toFixed(3)} DT (order says ${line.price.toFixed(3)} DT).`,
        data: { expected, current: line.price },
      })
    }

    const recipe = recipeFor(product, variant, line.modifiers)
    if (sent && !ctx.validateSentItems) {
      if (recipe.length && ctx.store.settings.orderRules.deductIngredientsOnSale) {
        for (const ingredient of recipe) {
          consumed.ingredients.set(
            ingredient.inventoryItemId,
            (consumed.ingredients.get(ingredient.inventoryItemId) ?? 0) + ingredient.qtyPerUnit * line.qty,
          )
        }
      } else if (product.inventoryItemId) {
        consumed.ingredients.set(
          product.inventoryItemId,
          (consumed.ingredients.get(product.inventoryItemId) ?? 0) + line.qty,
        )
      }
      if (variant ? variant.trackStock : product.trackStock) {
        const key = stockKey(product.id, variant?.id)
        consumed.stock.set(key, (consumed.stock.get(key) ?? 0) + line.qty)
      }
      continue
    }

    const modifierRecipeShort = ctx.store.settings.orderRules.deductIngredientsOnSale &&
      recipe.some((ingredient) =>
        (ctx.inventoryItems.find((item) => item.id === ingredient.inventoryItemId)?.onHand ?? 0) <
        ingredient.qtyPerUnit,
      )
    const availability = isUnavailable(
      product, variant, ctx.store.settings.availability, ctx.inventoryItems,
      now, ctx.store.settings.orderRules.deductIngredientsOnSale,
    )
    if (availability.unavailable || modifierRecipeShort) {
      issues.push({
        code: 'UNAVAILABLE_86',
        lineId,
        severity: 'block',
        message: `${product.name}${variant ? ` (${variant.name})` : ''} is 86'd (${availability.reason || 'Ingredient out of stock'}).`,
        data: { reason: availability.reason || 'Ingredient out of stock' },
      })
      continue
    }

    const severity = stockSeverity(ctx.store)
    const overridden = stockOverrideAccepted(line.stockOverride, line.qty, ctx)
    if (recipe.length && ctx.store.settings.orderRules.deductIngredientsOnSale) {
      const reservedIngredients = new Map(reservations.ingredients)
      for (const [itemId, qty] of consumed.ingredients) {
        reservedIngredients.set(itemId, (reservedIngredients.get(itemId) ?? 0) + qty)
      }
      for (const ingredient of recipe) {
        const need = ingredient.qtyPerUnit * line.qty
        const available = availableIngredient(ingredient.inventoryItemId, ctx.inventoryItems, {
          stock: reservations.stock,
          ingredients: reservedIngredients,
        })
        if (need <= available + 0.000001 || !severity || overridden) continue
        const item = ctx.inventoryItems.find((candidate) => candidate.id === ingredient.inventoryItemId)
        issues.push({
          code: 'INGREDIENT_SHORT',
          lineId,
          severity,
          message: `Only ${Math.max(0, available).toFixed(3)} ${item?.baseUnit ?? ''} of ${item?.name ?? 'an ingredient'} left for ${product.name}.`,
          data: {
            itemId: ingredient.inventoryItemId,
            need,
            available: Math.max(0, available),
            maxQty: Math.max(0, Math.floor(Math.max(0, available) / Math.max(0.000001, ingredient.qtyPerUnit))),
          },
        })
        break
      }
      for (const ingredient of recipe) {
        consumed.ingredients.set(
          ingredient.inventoryItemId,
          (consumed.ingredients.get(ingredient.inventoryItemId) ?? 0) + ingredient.qtyPerUnit * line.qty,
        )
      }
      if (variant ? variant.trackStock : product.trackStock) {
        const key = stockKey(product.id, variant?.id)
        const available = round((variant ? variant.stock : product.stock) -
          (reservations.stock.get(key) ?? 0) - (consumed.stock.get(key) ?? 0))
        if (severity && !overridden && line.qty > available + 0.000001) {
          issues.push({
            code: 'OVER_STOCK',
            lineId,
            severity,
            message: `Only ${Math.max(0, available)} of ${product.name}${variant ? ` (${variant.name})` : ''} left in stock.`,
            data: { requested: line.qty, available: Math.max(0, available) },
          })
        }
        consumed.stock.set(key, (consumed.stock.get(key) ?? 0) + line.qty)
      }
      continue
    }
    const reservedStock = new Map(reservations.stock)
    for (const [key, qty] of consumed.stock) {
      reservedStock.set(key, (reservedStock.get(key) ?? 0) + qty)
    }
    const reservedIngredients = new Map(reservations.ingredients)
    for (const [itemId, qty] of consumed.ingredients) {
      reservedIngredients.set(itemId, (reservedIngredients.get(itemId) ?? 0) + qty)
    }
    const available = availableStock(product, variant, {
      stock: reservedStock,
      ingredients: reservedIngredients,
    }, ctx.inventoryItems, ctx.store.settings.orderRules.deductIngredientsOnSale)
    if (severity && !overridden && line.qty > available + 0.000001) {
      issues.push({
        code: 'OVER_STOCK',
        lineId,
        severity,
        message: `Only ${Math.max(0, available)} of ${product.name}${variant ? ` (${variant.name})` : ''} left in stock.`,
        data: { requested: line.qty, available: Math.max(0, available) },
      })
    }
    if (variant ? variant.trackStock : product.trackStock) {
      const key = stockKey(product.id, variant?.id)
      consumed.stock.set(key, (consumed.stock.get(key) ?? 0) + line.qty)
    }
    if (product.inventoryItemId && !(recipe.length && ctx.store.settings.orderRules.deductIngredientsOnSale)) {
      consumed.ingredients.set(
        product.inventoryItemId,
        (consumed.ingredients.get(product.inventoryItemId) ?? 0) + line.qty,
      )
    }
  }

  if (checkout) {
    if ((ctx.discount ?? 0) > 0 && ctx.actor &&
      ctx.actor.role !== 'admin' && ctx.actor.permissions.discount !== true) {
      issues.push({
        code: 'DISCOUNT_NOT_ALLOWED',
        severity: 'block',
        message: 'You do not have permission to apply discounts.',
      })
    }
    if (ctx.customer && Number.isFinite(ctx.estimatedTotal ?? NaN) &&
      ctx.customer.balance + (ctx.estimatedTotal ?? 0) > ctx.customer.limit) {
      issues.push({
        code: 'CREDIT_LIMIT',
        severity: 'block',
        message: `This order exceeds the customer's credit limit (${ctx.customer.limit.toFixed(3)} DT).`,
        data: { limit: ctx.customer.limit, balance: ctx.customer.balance },
      })
    }
  }
  return issues
}

export type ResolvedLines =
  | { ok: true; items: OrderItem[]; issues: OrderRuleIssue[] }
  | { ok: false; error: string; issues: OrderRuleIssue[] }

/** Validate + resolve requested lines from the catalogue, keeping prices server-authoritative. */
export function resolveOrderLines(requested: OrderItem[], ctx: OrderRulesContext): ResolvedLines {
  if (!Array.isArray(requested) || !requested.length) {
    return { ok: false, error: 'Cart is empty.', issues: [] }
  }
  const resolved: OrderItem[] = []
  for (const line of requested) {
    if (!line || typeof line.productId !== 'string' || !Number.isFinite(line.qty) || line.qty <= 0) {
      return { ok: false, error: 'Each item quantity must be a positive amount.', issues: [] }
    }
    const product = ctx.products.find((candidate) =>
      candidate.id === line.productId && candidate.storeId === ctx.store.id,
    )
    if (!product) return { ok: false, error: 'An item in the cart is unavailable in this store.', issues: [] }
    const qty = round(line.qty)
    if (qty <= 0) return { ok: false, error: 'Weight must be greater than zero.', issues: [] }
    if (product.soldByWeight) {
      if (!ctx.store.settings.features.weightItems) {
        return { ok: false, error: 'Weight-based sales are disabled for this store.', issues: [] }
      }
      if (qty !== line.qty) return { ok: false, error: 'Weight must be entered to three decimal places.', issues: [] }
    } else if (!Number.isSafeInteger(line.qty)) {
      return { ok: false, error: 'Each item quantity must be a positive whole number.', issues: [] }
    }
    const variant = line.variantId
      ? product.variants?.find((candidate) => candidate.id === line.variantId)
      : undefined
    const modifiers: OrderModifier[] = []
    const seenGroups = new Set<string>()
    const seenOptions = new Set<string>()
    for (const requestedModifier of line.modifiers ?? []) {
      const group = product.modifiers?.find((candidate) => candidate.id === requestedModifier.groupId)
      const option = group?.options.find((candidate) => candidate.id === requestedModifier.optionId)
      const optionKey = `${requestedModifier.groupId}:${requestedModifier.optionId}`
      if (!group || !option || seenOptions.has(optionKey) ||
        (group.selection === 'single' && seenGroups.has(group.id))) {
        return { ok: false, error: `Choose valid options for ${product.name}.`, issues: [] }
      }
      seenGroups.add(group.id)
      seenOptions.add(optionKey)
      modifiers.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDelta: option.priceDelta,
      })
    }
    for (const group of product.modifiers ?? []) {
      const selected = modifiers.filter((modifier) => modifier.groupId === group.id).length
      if (group.required && !selected) {
        return { ok: false, error: `Select an option for ${group.name} on ${product.name}.`, issues: [] }
      }
      if (group.selection === 'single' && selected > 1) {
        return { ok: false, error: `Choose only one option for ${group.name}.`, issues: [] }
      }
    }
    const price = round((variant?.price ?? product.price) +
      modifiers.reduce((sum, modifier) => sum + modifier.priceDelta, 0))
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: `The configured price for ${product.name} is invalid.`, issues: [] }
    }
    resolved.push({
      ...line,
      productId: product.id,
      name: product.name,
      price,
      qty,
      variantId: variant?.id,
      variantName: variant?.name,
      modifiers,
      note: typeof line.note === 'string' ? line.note.trim().slice(0, 240) : '',
      saleUnit: product.soldByWeight ? product.saleUnit ?? 'piece' : undefined,
      soldByWeight: product.soldByWeight === true,
    })
  }
  const issues = validateOrderLines(resolved, ctx)
  const blocker = issues.find((issue) => issue.severity === 'block')
  if (blocker) return { ok: false, error: blocker.message, issues }
  return { ok: true, items: resolved, issues }
}

export interface StockPlan {
  productStock: Map<string, { productId: string; variantId?: string; qty: number }>
  ingredients: Map<string, { itemId: string; qty: number }>
}

export function planStockDeductions(
  lines: OrderItem[],
  products: Product[],
  deductIngredients: boolean,
): StockPlan {
  const productStock = new Map<string, { productId: string; variantId?: string; qty: number }>()
  const ingredients = new Map<string, { itemId: string; qty: number }>()
  for (const line of lines) {
    if (line.status === 'void') continue
    const product = products.find((candidate) => candidate.id === line.productId)
    if (!product) continue
    const variant = product.variants?.find((candidate) => candidate.id === line.variantId)
    const recipe = recipeFor(product, variant, line.modifiers)
    if (recipe.length && deductIngredients) {
      for (const ingredient of recipe) {
        const previous = ingredients.get(ingredient.inventoryItemId)?.qty ?? 0
        ingredients.set(ingredient.inventoryItemId, {
          itemId: ingredient.inventoryItemId,
          qty: roundQuantity(previous + ingredient.qtyPerUnit * line.qty),
        })
      }
    }
    if (variant ? variant.trackStock : product.trackStock) {
      const key = stockKey(product.id, variant?.id)
      const previous = productStock.get(key)?.qty ?? 0
      productStock.set(key, {
        productId: product.id,
        variantId: variant?.id,
        qty: roundQuantity(previous + line.qty),
      })
    } else if (product.inventoryItemId && !(recipe.length && deductIngredients)) {
      const previous = ingredients.get(product.inventoryItemId)?.qty ?? 0
      ingredients.set(product.inventoryItemId, {
        itemId: product.inventoryItemId,
        qty: roundQuantity(previous + line.qty),
      })
    }
  }
  return { productStock, ingredients }
}

const roundQuantity = (value: number): number => Math.round(value * 1_000_000) / 1_000_000

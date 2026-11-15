import { useEffect, useRef, useState } from 'react'
import { round } from '../../lib/pricing-utils'
import { uid } from '../../lib/utils'
import { verifySecret } from '../../lib/hash'
import { canOverrideStock } from '../../lib/permissions'
import type { Database, OrderItem, Product, Store, User } from '../../types'
import { validateOrderLines, type OrderIssueCode, type OrderRulesContext } from '../../shared/orderRules'
import type { ProductSelection } from './ProductOptionsModal'

export type StockPrompt = {
  lineId: string
  productName: string
  variantName?: string
  requested: number
  available: number
  maxQty: number
  ingredient: boolean
}

const stockIssueCodes: OrderIssueCode[] = ['OVER_STOCK', 'INGREDIENT_SHORT']

export function useProductCart(
  db: Database,
  store: Store | null,
  user: User | null,
  push: (message: string, type?: 'success' | 'error' | 'info') => void,
  hasOpenShift: boolean,
) {
  const [cart, setCartState] = useState<OrderItem[]>([])
  const cartRef = useRef<OrderItem[]>([])
  const [optionsProduct, setOptionsProduct] = useState<{ product: Product; variantId?: string } | null>(null)
  const [stockPrompt, setStockPrompt] = useState<StockPrompt | null>(null)
  const pendingCart = useRef<OrderItem[] | null>(null)
  const shiftPromptShown = useRef(false)

  const setCart = (items: OrderItem[]) => {
    cartRef.current = items
    setCartState(items)
  }

  useEffect(() => {
    if (hasOpenShift) shiftPromptShown.current = false
  }, [hasOpenShift])

  const qtyInCart = (productId: string) =>
    cart.filter((item) => item.productId === productId).reduce((total, item) => total + item.qty, 0)

  const rulesContext = (): OrderRulesContext | null => {
    if (!store) return null
    return {
      store,
      products: db.products,
      inventoryItems: db.inventoryItems,
      openOrders: db.openOrders,
      actor: user
        ? { id: user.id, name: user.name, role: user.role, permissions: user.permissions, stationOnly: user.stationOnly }
        : undefined,
      users: db.users,
    }
  }

  /**
   * Validates the whole cart and either commits it, blocks it, or asks how to
   * handle an over-stock line. Returns true when the cart was committed.
   */
  const commitCandidate = (candidate: OrderItem[], lineId: string): boolean => {
    const ctx = rulesContext()
    if (!ctx) return false
    const issues = validateOrderLines(candidate, ctx)
    const blocker = issues.find((issue) => issue.severity === 'block')
    if (blocker) {
      push(blocker.message, 'error')
      return false
    }
    const stockIssue = issues.find((issue) =>
      issue.lineId === lineId && stockIssueCodes.includes(issue.code),
    )
    if (stockIssue) {
      const line = candidate.find((item) => item.lineId === lineId)
      pendingCart.current = candidate
      setStockPrompt({
        lineId,
        productName: line?.name ?? '',
        variantName: line?.variantName,
        requested: line?.qty ?? 0,
        available: Number(stockIssue.data?.available ?? 0),
        maxQty: Math.max(0, Number(stockIssue.data?.maxQty ?? stockIssue.data?.available ?? 0)),
        ingredient: stockIssue.code === 'INGREDIENT_SHORT',
      })
      return false
    }
    pendingCart.current = null
    setStockPrompt(null)
    setCart(candidate)
    return true
  }

  const mergeInto = (prev: OrderItem[], addition: OrderItem): OrderItem[] => {
    const modifierKey = (item: OrderItem) => (item.modifiers ?? [])
      .map((modifier) => `${modifier.groupId}:${modifier.optionId}`).sort().join(',')
    const found = prev.find((item) =>
      item.productId === addition.productId &&
      item.variantId === addition.variantId &&
      modifierKey(item) === modifierKey(addition) &&
      (item.note ?? '') === (addition.note ?? '') &&
      !item.stockOverride,
    )
    if (!found) return [...prev, addition]
    return prev.map((item) => item === found
      ? { ...item, qty: round(item.qty + addition.qty) }
      : item)
  }

  const addSelection = (product: Product, selection: ProductSelection) => {
    if (!store) return
    if (store.settings.requireShiftForOrders && !hasOpenShift && !shiftPromptShown.current) {
      shiftPromptShown.current = true
      push('Open your shift before taking orders.', 'error')
    }
    const variant = product.variants?.find((item) => item.id === selection.variantId)
    const price = round((variant?.price ?? product.price) +
      selection.modifiers.reduce((total, modifier) => total + modifier.priceDelta, 0))
    const lineId = uid('line')
    const addition: OrderItem = {
      lineId,
      stationId: product.stationId === null
        ? undefined
        : product.stationId ?? db.categories.find((category) =>
            category.id === product.categoryId && category.storeId === product.storeId,
          )?.stationId,
      status: 'draft',
      productId: product.id,
      name: product.name,
      price,
      qty: selection.qty,
      variantId: variant?.id,
      variantName: variant?.name,
      modifiers: selection.modifiers,
      note: selection.note,
      saleUnit: product.soldByWeight ? product.saleUnit ?? 'piece' : undefined,
      soldByWeight: product.soldByWeight === true,
    }
    const next = mergeInto(cartRef.current, addition)
    commitCandidate(next, lineId)
  }
  const addItem = (productId: string, variantId?: string) => {
    if (!store) return
    const product = db.products.find((candidate) =>
      candidate.id === productId && candidate.storeId === store.id && candidate.active,
    )
    if (!product) return
    if (product.soldByWeight && !store.settings.features.weightItems) {
      push('Weight-based sales are disabled for this store.', 'error')
      return
    }
    if ((product.modifiers?.length || product.variants?.length || product.soldByWeight) && !variantId) {
      setOptionsProduct({ product })
      return
    }
    if (variantId && (product.modifiers?.length || product.soldByWeight)) {
      setOptionsProduct({ product, variantId })
      return
    }
    addSelection(product, { variantId, modifiers: [], note: '', qty: 1 })
  }

  const scanBarcode = (code: string) => {
    if (!store) return
    const normalized = code.trim().toLowerCase()
    const product = db.products.find((candidate) =>
      candidate.storeId === store.id && candidate.active &&
      (candidate.barcode ?? '').toLowerCase() === normalized,
    )
    if (product) {
      addItem(product.id)
      return
    }
    const variantProduct = db.products.find((candidate) =>
      candidate.storeId === store.id && candidate.active &&
      candidate.variants?.some((variant) => (variant.barcode ?? '').toLowerCase() === normalized),
    )
    const variant = variantProduct?.variants?.find((candidate) =>
      (candidate.barcode ?? '').toLowerCase() === normalized,
    )
    if (variantProduct && variant) {
      addItem(variantProduct.id, variant.id)
      return
    }
    push('No active product matches that barcode.', 'error')
  }

  const applyLineQty = (lineId: string, qty: number) => {
    if (!store) return
    if (!Number.isFinite(qty) || qty < 0) {
      push('Enter a valid item quantity.', 'error')
      return
    }
    const line = cart.find((item) => item.lineId === lineId)
    if (!line) return
    const product = db.products.find((candidate) => candidate.id === line.productId)
    if (qty === 0) {
      setCart(cart.filter((item) => item.lineId !== lineId))
      return
    }
    if (round(qty) !== qty) {
      push('Enter a valid item quantity.', 'error')
      return
    }
    if (product && !product.soldByWeight && !Number.isSafeInteger(qty)) {
      push(`${product.name} must be sold in whole units.`, 'error')
      return
    }
    const next = cart.map((item) => item.lineId === lineId ? { ...item, qty, stockOverride: undefined } : item)
    commitCandidate(next, lineId)
  }

  const changeQty = (lineId: string, delta: number) => {
    const line = cart.find((item) => item.lineId === lineId)
    if (!line) return
    applyLineQty(lineId, round(line.qty + delta))
  }

  const setLineQty = (lineId: string, qty: number) => applyLineQty(lineId, qty)

  const cancelStockPrompt = () => {
    pendingCart.current = null
    setStockPrompt(null)
  }

  /** Applies the chosen resolution, verifying a manager PIN when the user lacks overrideStock. */
  const resolveStockPrompt = async (action: 'reduce' | 'override' | 'cancel', pin?: string) => {
    const prompt = stockPrompt
    const candidate = pendingCart.current
    const ctx = rulesContext()
    if (!prompt || !candidate || !ctx || !store) {
      cancelStockPrompt()
      return
    }
    if (action === 'cancel') {
      cancelStockPrompt()
      return
    }
    if (action === 'reduce') {
      const line = candidate.find((item) => item.lineId === prompt.lineId)
      if (!line) {
        cancelStockPrompt()
        return
      }
      const maxQty = prompt.ingredient ? prompt.maxQty : prompt.available
      const reduced = Math.max(0, Math.min(line.qty, line.soldByWeight
        ? round(prompt.available)
        : Math.floor(maxQty)))
      if (reduced <= 0) {
        push(`No stock left for ${prompt.productName}.`, 'error')
        cancelStockPrompt()
        return
      }
      const next = candidate.map((item) => item.lineId === prompt.lineId
        ? { ...item, qty: reduced, stockOverride: undefined }
        : item)
      pendingCart.current = null
      setStockPrompt(null)
      setCart(next)
      push(`Reduced ${prompt.productName} to ${reduced}.`, 'info')
      return
    }
    let confirmedBy: User | undefined
    if (user && canOverrideStock(user, store.settings.orderRules)) {
      confirmedBy = user
    } else if (pin?.trim()) {
      for (const candidateUser of db.users) {
        if (!candidateUser.active || candidateUser.storeId !== store.id) continue
        if (!canOverrideStock(candidateUser, store.settings.orderRules)) continue
        if (await verifySecret(pin.trim(), candidateUser.pin)) {
          confirmedBy = candidateUser
          break
        }
      }
    }
    if (!confirmedBy) {
      push(pin?.trim() ? "That PIN can't confirm an over-stock sale." : 'A manager PIN is required to sell over stock.', 'error')
      return
    }
    const at = new Date().toISOString()
    const next = candidate.map((item) => item.lineId === prompt.lineId
      ? {
          ...item,
          stockOverride: {
            confirmedById: confirmedBy.id,
            confirmedByName: confirmedBy.name,
            requested: item.qty,
            available: prompt.available,
            at,
          },
        }
      : item)
    pendingCart.current = null
    setStockPrompt(null)
    setCart(next)
    push(`${prompt.productName} added over stock — it will be 86'd.`, 'info')
  }

  return {
    cart,
    setCart,
    optionsProduct,
    setOptionsProduct,
    qtyInCart,
    addItem,
    addSelection,
    scanBarcode,
    changeQty,
    setLineQty,
    stockPrompt,
    resolveStockPrompt,
    cancelStockPrompt,
  }
}

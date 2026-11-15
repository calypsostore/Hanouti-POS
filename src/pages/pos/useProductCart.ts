import { useState } from 'react'
import { round } from '../../lib/pricing-utils'
import { uid } from '../../lib/utils'
import type { Database, OrderItem, Product, Store } from '../../types'
import type { ProductSelection } from './ProductOptionsModal'

export function useProductCart(
  db: Database,
  store: Store | null,
  push: (message: string, type?: 'success' | 'error' | 'info') => void,
) {
  const [cart, setCart] = useState<OrderItem[]>([])
  const [optionsProduct, setOptionsProduct] = useState<{ product: Product; variantId?: string } | null>(null)

  const qtyInCart = (productId: string) =>
    cart.filter((item) => item.productId === productId).reduce((total, item) => total + item.qty, 0)

  const addSelection = (product: Product, selection: ProductSelection) => {
    if (!store) return
    const variant = product.variants?.find((item) => item.id === selection.variantId)
    const tracksStock = variant ? variant.trackStock : product.trackStock
    const availableStock = variant ? variant.stock : product.stock
    const stockQty = cart
      .filter((item) => item.productId === product.id && item.variantId === selection.variantId)
      .reduce((total, item) => total + item.qty, 0)
    if (tracksStock && round(stockQty + selection.qty) > availableStock) {
      push(`${product.name} is out of stock.`, 'error')
      return
    }
    const price = round((variant?.price ?? product.price) +
      selection.modifiers.reduce((total, modifier) => total + modifier.priceDelta, 0))
    const modifierKey = selection.modifiers
      .map((modifier) => `${modifier.groupId}:${modifier.optionId}`)
      .sort()
      .join(',')
    setCart((prev) => {
      const found = prev.find((item) =>
        item.productId === product.id &&
        item.variantId === selection.variantId &&
        (item.modifiers ?? []).map((modifier) => `${modifier.groupId}:${modifier.optionId}`).sort().join(',') === modifierKey &&
        (item.note ?? '') === selection.note,
      )
      if (found) {
        return prev.map((item) => item === found
          ? { ...item, qty: round(item.qty + selection.qty) }
          : item)
      }
      return [
        ...prev,
        {
          lineId: uid('line'),
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
        },
      ]
    })
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

  const changeQty = (lineId: string, delta: number) => {
    setCart((prev) => prev
      .map((item) => item.lineId === lineId ? { ...item, qty: round(item.qty + delta) } : item)
      .filter((item) => item.qty > 0),
    )
  }

  const setLineQty = (lineId: string, qty: number) => {
    if (!store || !Number.isFinite(qty) || qty <= 0 || round(qty) !== qty) return
    const line = cart.find((item) => item.lineId === lineId)
    if (line) {
      const product = db.products.find((candidate) => candidate.id === line.productId)
      const variant = product?.variants?.find((candidate) => candidate.id === line.variantId)
      const stockTracked = variant ? variant.trackStock : product?.trackStock
      const available = variant ? variant.stock : product?.stock ?? 0
      const otherQty = cart
        .filter((item) => item.productId === line.productId && item.variantId === line.variantId && item.lineId !== lineId)
        .reduce((total, item) => total + item.qty, 0)
      if (stockTracked && round(otherQty + qty) > available) {
        push(`Not enough stock for ${line.name}. Available: ${available}.`, 'error')
        return
      }
    }
    setCart((prev) => prev.map((item) =>
      item.lineId === lineId ? { ...item, qty: round(qty) } : item,
    ))
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
  }
}

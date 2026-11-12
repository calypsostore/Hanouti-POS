import { useCallback } from 'react'
import type { Database, Order, OrderItem, OrderModifier, User } from '../types'
import { computeTotals } from '../lib/pricing'
import { round } from '../lib/pricing-utils'
import { uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import { verifySecret } from '../lib/hash'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

export function useOrdersSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireActor } = dependencies
  const createOrder = useCallback<AppContextValue['createOrder']>(
    (input) => {
      const actorResult = requireActor()
      if (!actorResult.ok) return actorResult
      const seller = actorResult.actor
      if (!seller.storeId) return { ok: false, error: 'No active store session.' }
      const current = dbRef.current
      if (!input || !Array.isArray(input.items)) return { ok: false, error: 'The order items are invalid.' }
      if (!['cash', 'card', 'credit'].includes(input.paymentMethod) ||
        !['takeaway', 'dine-in', 'delivery'].includes(input.channel)) {
        return { ok: false, error: 'Choose a valid order type and payment method.' }
      }
      const target = current.stores.find((s) => s.id === seller.storeId)
      if (!target) return { ok: false, error: 'Store not found.' }
      if (!input.items.length) return { ok: false, error: 'Cart is empty.' }
      if (!current.registerSessions.some((session) => session.storeId === target.id && session.status === 'open')) {
        return { ok: false, error: 'Open the register first' }
      }

      const checkedItems: OrderItem[] = []
      const stockDeductions = new Map<string, { productId: string; variantId?: string; qty: number }>()
      for (const item of input.items) {
        if (!item || typeof item.productId !== 'string' || !Number.isFinite(item.qty) || item.qty <= 0) {
          return { ok: false, error: 'Each item quantity must be a positive amount.' }
        }
        const product = current.products.find((candidate) => candidate.id === item.productId)
        if (!product || product.storeId !== target.id || !product.active) {
          return { ok: false, error: 'An item in the cart is unavailable in this store.' }
        }
        const qty = round(item.qty)
        if (qty <= 0) return { ok: false, error: 'Weight must be greater than zero.' }
        if (product.soldByWeight) {
          if (!target.settings.features.weightItems) {
            return { ok: false, error: 'Weight-based sales are disabled for this store.' }
          }
          if (qty !== item.qty) return { ok: false, error: 'Weight must be entered to three decimal places.' }
        } else if (!Number.isSafeInteger(item.qty)) {
          return { ok: false, error: 'Each item quantity must be a positive whole number.' }
        }
        const variants = product.variants ?? []
        const variant = item.variantId ? variants.find((candidate) => candidate.id === item.variantId) : undefined
        if (item.variantId && !variant) {
          return { ok: false, error: `Choose a valid variant for ${product.name}.` }
        }
        if (variants.length && !variant) {
          return { ok: false, error: `Choose a variant for ${product.name}.` }
        }
        const selected: OrderModifier[] = []
        const incomingModifiers = Array.isArray(item.modifiers) ? item.modifiers : []
        const seenGroups = new Set<string>()
        const seenOptions = new Set<string>()
        for (const requested of incomingModifiers) {
          if (!requested || typeof requested.groupId !== 'string' || typeof requested.optionId !== 'string') {
            return { ok: false, error: `Choose valid options for ${product.name}.` }
          }
          const group = (product.modifiers ?? []).find((candidate) => candidate.id === requested.groupId)
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
        const price = round((variant?.price ?? product.price) + selected.reduce((sum, option) => sum + option.priceDelta, 0))
        if (!Number.isFinite(price) || price < 0) {
          return { ok: false, error: `The configured price for ${product.name} is invalid.` }
        }
        const stockKey = `${product.id}:${variant?.id ?? 'base'}`
        const tracksStock = variant ? variant.trackStock : product.trackStock
        const stockAvailable = variant ? variant.stock : product.stock
        if (tracksStock) {
          const prior = stockDeductions.get(stockKey)?.qty ?? 0
          const nextQty = round(prior + qty)
          if (nextQty > stockAvailable) {
            return { ok: false, error: `Not enough stock for ${product.name}${variant ? ` (${variant.name})` : ''}. Available: ${stockAvailable}.` }
          }
          stockDeductions.set(stockKey, { productId: product.id, variantId: variant?.id, qty: nextQty })
        }
        checkedItems.push({
          lineId: uid('line'),
          productId: product.id,
          name: product.name,
          emoji: product.emoji,
          price,
          qty,
          variantId: variant?.id,
          variantName: variant?.name,
          modifiers: selected,
          note: typeof item.note === 'string' ? item.note.trim() : '',
          saleUnit: product.soldByWeight ? product.saleUnit ?? 'piece' : undefined,
          soldByWeight: product.soldByWeight === true,
        })
      }
      if (input.customerId && !current.customers.some((customer) =>
        customer.id === input.customerId && customer.storeId === target.id,
      )) return { ok: false, error: 'That customer does not belong to this store.' }

      if (input.paymentMethod === 'credit') {
        if (!target.settings.allowCredit) return { ok: false, error: 'Credit tabs are disabled for this store.' }
        if (seller.role !== 'admin' && !seller.permissions.credit) {
          return { ok: false, error: 'You do not have permission to add orders to tabs.' }
        }
        if (!input.customerId) return { ok: false, error: 'Select a customer to add this order to a tab.' }
        const customer = current.customers.find((c) => c.id === input.customerId)
        if (!customer || customer.storeId !== target.id) {
          return { ok: false, error: 'That customer does not belong to this store.' }
        }
      }

      const requestedDiscount = input.discount ?? 0
      if (!Number.isFinite(requestedDiscount) || requestedDiscount < 0) {
        return { ok: false, error: 'Discount must be zero or a positive amount.' }
      }
      if (requestedDiscount > 0 && seller.role !== 'admin' && !seller.permissions.discount) {
        return { ok: false, error: 'You do not have permission to apply discounts.' }
      }
      const undiscounted = computeTotals(checkedItems, target.settings)
      if (requestedDiscount > undiscounted.total) {
        return { ok: false, error: 'Discount cannot exceed the order total.' }
      }
      const discount = round(requestedDiscount)
      const totals = computeTotals(checkedItems, target.settings, discount)
      if (input.paymentMethod === 'credit' && input.customerId) {
        const customer = current.customers.find((candidate) => candidate.id === input.customerId)
        if (!customer) return { ok: false, error: 'That customer does not belong to this store.' }
        const balance = balanceFor(current.ledger, customer.id)
        if (balance + totals.total > customer.limit) {
          return { ok: false, error: `This order exceeds the customer's credit limit (${customer.limit.toFixed(3)} DT).` }
        }
      }
      const order: Order = {
        id: uid('ord'),
        storeId: target.id,
        number: 0,
        items: checkedItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        service: totals.service,
        discount,
        total: totals.total,
        channel: input.channel,
        status: 'completed',
        paymentMethod: input.paymentMethod,
        customerId: input.customerId,
        staffId: seller.id,
        staffName: seller.name,
        note: input.note,
        createdAt: new Date().toISOString(),
      }

      commitDb((prev) => {
        const orderNo = prev.orders
          .filter((existing) => existing.storeId === target.id)
          .reduce((max, existing) => Math.max(max, existing.number), 1000) + 1
        order.number = orderNo
        return {
        ...prev,
        orders: [order, ...prev.orders],
        products: prev.products.map((product) => {
          if (product.storeId !== target.id) return product
          const baseDeduction = stockDeductions.get(`${product.id}:base`)
          if (baseDeduction && product.trackStock) {
            return { ...product, stock: round(product.stock - baseDeduction.qty) }
          }
          const nextVariants = (product.variants ?? []).map((variant) => {
            const deduction = stockDeductions.get(`${product.id}:${variant.id}`)
            return deduction && variant.trackStock
              ? { ...variant, stock: round(variant.stock - deduction.qty) }
              : variant
          })
          return nextVariants.some((variant, index) => variant !== product.variants?.[index])
            ? { ...product, variants: nextVariants }
            : product
        }),
        ledger:
          input.paymentMethod === 'credit' && input.customerId
            ? [
                {
                  id: uid('led'),
                  storeId: target.id,
                  customerId: input.customerId,
                  type: 'charge' as const,
                  amount: order.total,
                  orderId: order.id,
                  staffName: seller.name,
                  createdAt: order.createdAt,
                },
                ...prev.ledger,
              ]
            : prev.ledger,
        }
      })
      return { ok: true, order }
    },
    [commitDb, requireActor],
  )

  const voidOrder = useCallback<AppContextValue['voidOrder']>(
    async (orderId, managerPin) => {
      const current = dbRef.current
      const initialOrder = current.orders.find((candidate) => candidate.id === orderId)
      if (!initialOrder) return { ok: false, error: 'Order not found.' }
      const actorResult = requireActor(initialOrder.storeId)
      if (!actorResult.ok) return actorResult
      const actor = actorResult.actor
      if (initialOrder.status === 'void') return { ok: false, error: 'This order is already void.' }
      let authorizer: User | null = actor
      let verifiedAdminId: string | null = null
      if (actor.role !== 'admin') {
        if (!managerPin?.trim()) return { ok: false, error: 'An active store admin PIN is required to void this order.' }
        const admins = current.users.filter((candidate) =>
          candidate.storeId === initialOrder.storeId && candidate.role === 'admin' && candidate.active,
        )
        authorizer = null
        for (const admin of admins) {
          if (await verifySecret(managerPin.trim(), admin.pin)) {
            verifiedAdminId = admin.id
            break
          }
        }
        if (!verifiedAdminId) return { ok: false, error: "That PIN doesn't match an active store manager." }
      }
      const latestOrder = dbRef.current.orders.find((candidate) => candidate.id === orderId)
      if (!latestOrder || latestOrder.status === 'void') return { ok: false, error: 'This order is already void.' }
      const latestActor = requireActor(latestOrder.storeId)
      if (!latestActor.ok) return latestActor
      if (verifiedAdminId) {
        authorizer = dbRef.current.users.find((candidate) =>
          candidate.id === verifiedAdminId && candidate.storeId === latestOrder.storeId &&
          candidate.role === 'admin' && candidate.active,
        ) ?? null
      } else {
        authorizer = latestActor.actor
      }
      if (!authorizer) return { ok: false, error: 'Manager authorization failed.' }
      const order = latestOrder
      const at = new Date().toISOString()
      const voidedById = authorizer.id
      const voidedByName = authorizer.name
      commitDb((prev) => {
        const ledgerEntries: Database['ledger'] = []
        if (order.paymentMethod === 'credit' && order.customerId) {
          const outstanding = Math.max(0, balanceFor(prev.ledger, order.customerId))
          const reversedCharge = Math.min(order.total, outstanding)
          if (reversedCharge > 0) {
            ledgerEntries.push({
              id: uid('led'),
              storeId: order.storeId,
              customerId: order.customerId,
              type: 'charge',
              amount: -reversedCharge,
              orderId: order.id,
              note: `Voided order #${order.number}`,
              staffName: voidedByName,
              createdAt: at,
            })
          }
          const credit = round(order.total - reversedCharge)
          if (credit > 0) {
            ledgerEntries.push({
              id: uid('led'),
              storeId: order.storeId,
              customerId: order.customerId,
              type: 'payment',
              amount: credit,
              orderId: order.id,
              note: `Customer credit from voided order #${order.number}`,
              creditAdjustment: true,
              staffName: voidedByName,
              createdAt: at,
            })
          }
        }
        return {
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: 'void' as const, voidedById, voidedByName, voidedAt: at }
            : o,
        ),
        products: prev.products.map((product) => {
          if (product.storeId !== order.storeId) return product
          const itemQty = order.items
            .filter((item) => item.productId === product.id && !item.variantId)
            .reduce((total, item) => round(total + item.qty), 0)
          const variants = (product.variants ?? []).map((variant) => {
            const qty = order.items
              .filter((item) => item.productId === product.id && item.variantId === variant.id)
              .reduce((total, item) => round(total + item.qty), 0)
            return variant.trackStock && qty
              ? { ...variant, stock: round(variant.stock + qty) }
              : variant
          })
          if (itemQty && product.trackStock) return { ...product, stock: round(product.stock + itemQty) }
          return variants.some((variant, index) => variant !== product.variants?.[index])
            ? { ...product, variants }
            : product
        }),
        ledger: [...ledgerEntries, ...prev.ledger],
        }
      })
      return { ok: true }
    },
    [commitDb, requireActor],
  )


  return { createOrder, voidOrder }
}

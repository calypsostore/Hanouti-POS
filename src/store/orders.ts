import { useCallback } from 'react'
import type { AuditJsonValue, Database, Order, OrderItem, OrderModifier, User } from '../types'
import { computeTotals } from '../lib/pricing'
import { round } from '../lib/pricing-utils'
import { uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import { verifySecret } from '../lib/hash'
import { addLog } from './audit'
import { can } from '../lib/permissions'
import { guestCountError } from '../lib/tableService'
import { openShiftForStaff } from '../lib/registerShifts'
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
      if (input.channel === 'delivery' && !target.settings.features.delivery) {
        return { ok: false, error: 'Delivery orders are disabled for this store.' }
      }
      if (input.channel !== 'dine-in' && (input.tableId || input.tableName)) {
        return { ok: false, error: 'A table can only be assigned to a dine-in order.' }
      }
      const manualTables = target.settings.tableMode === 'manual'
      const table = input.tableId
        ? current.tables.find((candidate) =>
            candidate.id === input.tableId && candidate.storeId === target.id && candidate.active,
          )
        : undefined
      if (input.tableId && !table) return { ok: false, error: 'Choose an active table from this store.' }
      if (input.channel === 'dine-in' && target.settings.features.tables) {
        if (manualTables) {
          const tableName = typeof input.tableName === 'string' ? input.tableName.trim() : ''
          if (input.tableId || !tableName || tableName.length > 60) {
            return { ok: false, error: 'Enter a table name up to 60 characters.' }
          }
        } else if (!table) {
          return { ok: false, error: 'Choose a table before checking out a dine-in order.' }
        }
      }
      if (input.channel === 'dine-in' && target.settings.features.tables) {
        const guestsError = guestCountError(input.guests, target.settings.guestRequirement)
        if (guestsError) return { ok: false, error: guestsError }
      }
      if (!input.items.length) return { ok: false, error: 'Cart is empty.' }
      const shift = openShiftForStaff(current, target.id, seller.id)
      if (target.settings.requireShiftForOrders && !shift) {
        return { ok: false, error: 'Open your shift before taking orders.' }
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
          price,
          qty,
          variantId: variant?.id,
          variantName: variant?.name,
          modifiers: selected,
          note: typeof item.note === 'string' ? item.note.trim() : '',
          addedById: seller.id,
          addedByName: seller.name,
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
      const createdAt = new Date().toISOString()
      const tableHistory = input.channel === 'dine-in' && target.settings.features.tables
        ? [
            {
              id: uid('evt'),
              type: 'opened' as const,
              actorId: seller.id,
              actorName: seller.name,
              at: createdAt,
              details: table?.name ?? input.tableName ?? '',
            },
            {
              id: uid('evt'),
              type: 'items_added' as const,
              actorId: seller.id,
              actorName: seller.name,
              at: createdAt,
              details: `${checkedItems.length} item line${checkedItems.length === 1 ? '' : 's'}`,
            },
            {
              id: uid('evt'),
              type: 'payment' as const,
              actorId: seller.id,
              actorName: seller.name,
              at: createdAt,
              details: `${input.paymentMethod} · ${totals.total.toFixed(3)} DT`,
            },
            {
              id: uid('evt'),
              type: 'closed' as const,
              actorId: seller.id,
              actorName: seller.name,
              at: createdAt,
            },
          ]
        : undefined
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
        taxRate: target.settings.taxRate,
        channel: input.channel,
        tableId: table?.id,
        tableName: table?.name ?? (manualTables ? input.tableName?.trim() : undefined),
        sectionId: table?.sectionId,
        sectionName: table?.sectionId
          ? current.sections.find((section) => section.id === table.sectionId)?.name
          : undefined,
        guests: target.settings.guestRequirement === 'off' ? undefined : input.guests,
        status: 'completed',
        paymentMethod: input.paymentMethod,
        customerId: input.customerId,
        shiftId: shift?.id,
        staffId: seller.id,
        staffName: seller.name,
        ownerStaffId: seller.id,
        ownerStaffName: seller.name,
        note: input.note,
        createdAt,
        tableHistory,
      }

      commitDb((prev) => {
        const orderNo = prev.orders
          .filter((existing) => existing.storeId === target.id)
          .reduce((max, existing) => Math.max(max, existing.number), 1000) + 1
        order.number = orderNo
        const next: Database = {
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
                  shiftId: shift?.id,
                  createdAt: order.createdAt,
                },
                ...prev.ledger,
              ]
            : prev.ledger,
        }
        const stockChanges: AuditJsonValue[] = []
        for (const deduction of stockDeductions.values()) {
          const product = prev.products.find((candidate) => candidate.id === deduction.productId)
          if (!product) continue
          const variant = deduction.variantId
            ? product.variants?.find((candidate) => candidate.id === deduction.variantId)
            : undefined
          const stockBefore = variant?.stock ?? product.stock
          stockChanges.push({
            product: product.name,
            variant: variant?.name ?? '',
            before: stockBefore,
            after: round(stockBefore - deduction.qty),
          })
        }
        let logged = addLog(next, seller, {
          storeId: target.id,
          action: 'created',
          entity: 'order',
          entityId: order.id,
          summary: `Created order #${order.number} for ${order.total.toFixed(3)} DT${table ? ` at ${table.name}` : ''}`,
          after: {
            number: order.number,
            total: order.total,
            discount: order.discount,
            paymentMethod: order.paymentMethod,
            tableName: order.tableName ?? '',
            guests: order.guests ?? 0,
            stockChanges,
          },
        })
        if (discount > 0) {
          logged = addLog(logged, seller, {
            storeId: target.id,
            action: 'discount_applied',
            entity: 'order',
            entityId: order.id,
            summary: `Applied ${discount.toFixed(3)} DT discount to order #${order.number}`,
            after: { amount: discount, orderTotal: order.total },
          })
        }
        return logged
      })
      return { ok: true, order }
    },
    [commitDb, requireActor],
  )

  const voidOrder = useCallback<AppContextValue['voidOrder']>(
    async (orderId, managerPin, voidReason) => {
      const reason = voidReason?.trim()
      if (!reason) return { ok: false, error: 'Enter a reason for voiding this order.' }
      if (reason.length > 240) return { ok: false, error: 'The void reason must be 240 characters or fewer.' }
      const current = dbRef.current
      const initialOrder = current.orders.find((candidate) => candidate.id === orderId)
      if (!initialOrder) return { ok: false, error: 'Order not found.' }
      const actorResult = requireActor(initialOrder.storeId)
      if (!actorResult.ok) return actorResult
      const actor = actorResult.actor
      if (initialOrder.status === 'void') return { ok: false, error: 'This order is already void.' }
      if (initialOrder.status === 'recorded') {
        return { ok: false, error: 'This table order is still open. Use the floor to cancel it.' }
      }
      let authorizer: User | null = actor
      let verifiedAdminId: string | null = null
      if (actor.role !== 'admin' && !can(actor, 'voidOrders')) {
        if (!managerPin?.trim()) return { ok: false, error: 'An active store admin PIN is required to void this order.' }
        const admins = current.users.filter((candidate) =>
          candidate.storeId === initialOrder.storeId && candidate.active &&
          (candidate.role === 'admin' || can(candidate, 'voidOrders')),
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
          candidate.active && (candidate.role === 'admin' || can(candidate, 'voidOrders')),
        ) ?? null
      } else {
        authorizer = latestActor.actor
      }
      if (!authorizer) return { ok: false, error: 'Manager authorization failed.' }
      const order = latestOrder
      const at = new Date().toISOString()
      const voidedById = authorizer.id
      const voidedByName = authorizer.name
      const voidShift = openShiftForStaff(dbRef.current, order.storeId, latestActor.actor.id)
      commitDb((prev) => {
        const ledgerEntries: Database['ledger'] = []
        let creditRefund = 0
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
              shiftId: voidShift?.id,
              createdAt: at,
            })
          }
          const credit = round(order.total - reversedCharge)
          if (credit > 0) {
            creditRefund = credit
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
              shiftId: voidShift?.id,
              createdAt: at,
            })
          }
        }
        const next: Database = {
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'void' as const,
                voidedById,
                voidedByName,
                voidedAt: at,
                voidShiftId: voidShift?.id,
                tableHistory: o.tableHistory
                  ? [
                      ...o.tableHistory,
                      {
                        id: uid('evt'),
                        type: 'voided' as const,
                        actorId: latestActor.actor.id,
                        actorName: latestActor.actor.name,
                        at,
                        details: reason,
                      },
                    ]
                  : undefined,
              }
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
        let logged = addLog(next, authorizer, {
          storeId: order.storeId,
          action: 'voided',
          entity: 'order',
          entityId: order.id,
          summary: `Voided order #${order.number}${order.tableName ? ` · ${order.tableName}` : ''}: ${reason}`,
          before: { status: order.status, tableName: order.tableName ?? '' },
          after: { status: 'void', reason, total: order.total, tableName: order.tableName ?? '' },
        })
        if (order.paymentMethod === 'cash' || creditRefund > 0) {
          const refundAmount = order.paymentMethod === 'cash' ? order.total : creditRefund
          const refundMethod = order.paymentMethod === 'cash' ? 'cash' : 'store_credit'
          logged = addLog(logged, authorizer, {
            storeId: order.storeId,
            action: 'refund_applied',
            entity: 'order',
            entityId: order.id,
            summary: `Refunded ${refundAmount.toFixed(3)} DT for order #${order.number}${order.tableName ? ` · ${order.tableName}` : ''} (${refundMethod})`,
            after: { amount: refundAmount, method: refundMethod },
          })
        }
        return logged
      })
      return { ok: true }
    },
    [commitDb, requireActor],
  )


  return { createOrder, voidOrder }
}

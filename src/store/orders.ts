import { useCallback } from 'react'
import type { AuditJsonValue, Database, Order, OrderItem, User } from '../types'
import { computeTotals } from '../lib/pricing'
import { round } from '../lib/pricing-utils'
import { uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import { addLog } from './audit'
import { can } from '../lib/permissions'
import { guestCountError } from '../lib/tableService'
import { openShiftForStaff } from '../lib/registerShifts'
import { nextOrderNumber, provisionalOrderNumber } from '../lib/orderNumber'
import { roundQuantity } from '../lib/inventory'
import { maintainAvailabilityAfterStockChange } from './availabilityMaintenance'
import {
  planStockDeductions, resolveOrderLines, stockKey, stockOverrideAccepted, validateOrderLines,
} from '../shared/orderRules'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

export function useOrdersSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, provider, requireActor, verifyAuthorizationPin } = dependencies
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
      const clientOrderId = typeof input.clientOrderId === 'string'
        ? input.clientOrderId.trim().slice(0, 128)
        : undefined
      if (clientOrderId) {
        const existing = current.orders.find((order) =>
          order.storeId === target.id && order.clientOrderId === clientOrderId,
        )
        if (existing) return { ok: true, order: existing }
      }
      const payingOpenOrder = input.excludeOpenOrderId
        ? current.openOrders.find((order) =>
            order.id === input.excludeOpenOrderId && order.storeId === target.id,
          )
        : undefined
      if (input.excludeOpenOrderId && !payingOpenOrder) {
        return { ok: false, error: 'The open order being paid could not be found in this store.' }
      }
      const customer = input.customerId
        ? current.customers.find((candidate) =>
            candidate.id === input.customerId && candidate.storeId === target.id,
          )
        : undefined
      if (input.customerId && !customer) {
        return { ok: false, error: 'That customer does not belong to this store.' }
      }
      const rulesContext = {
        store: target,
        products: current.products,
        inventoryItems: current.inventoryItems,
        openOrders: current.openOrders,
        excludeOpenOrderId: payingOpenOrder?.id,
        actor: seller,
        users: current.users,
        validateSentItems: Boolean(payingOpenOrder),
      }
      const resolved = resolveOrderLines(
        input.items.map((item) => ({ ...item, lineId: item.lineId ?? uid('line') })),
        rulesContext,
      )
      if (!resolved.ok) return { ok: false, error: resolved.error }
      const checkedItems: OrderItem[] = resolved.items.map((item) => {
        const savedLine = payingOpenOrder?.items.find((candidate) => candidate.lineId === item.lineId)
        const preservePrice = target.settings.orderRules.openOrderPricePolicy !== 'current' && savedLine
        return {
          ...item,
          ...(preservePrice ? { price: savedLine.price } : {}),
          addedById: seller.id,
          addedByName: seller.name,
        }
      })

      if (input.paymentMethod === 'credit') {
        if (!target.settings.allowCredit) return { ok: false, error: 'Credit tabs are disabled for this store.' }
        if (seller.role !== 'admin' && !seller.permissions.credit) {
          return { ok: false, error: 'You do not have permission to add orders to tabs.' }
        }
        if (!input.customerId) return { ok: false, error: 'Select a customer to add this order to a tab.' }
      }

      const requestedDiscount = input.discount ?? 0
      if (!Number.isFinite(requestedDiscount) || requestedDiscount < 0) {
        return { ok: false, error: 'Discount must be zero or a positive amount.' }
      }
      const undiscounted = computeTotals(checkedItems, target.settings)
      if (requestedDiscount > undiscounted.total) {
        return { ok: false, error: 'Discount cannot exceed the order total.' }
      }
      const discount = round(requestedDiscount)
      const totals = computeTotals(checkedItems, target.settings, discount)

      const checkoutIssues = validateOrderLines(checkedItems, {
        ...rulesContext,
        payWithCredit: true,
        discount,
        estimatedTotal: totals.total,
        customer: input.paymentMethod === 'credit' && customer
          ? { id: customer.id, limit: customer.limit, balance: balanceFor(current.ledger, customer.id) }
          : undefined,
      })
      const blocker = checkoutIssues.find((issue) => issue.severity === 'block')
      if (blocker) return { ok: false, error: blocker.message }
      const unconfirmed = checkoutIssues.find((issue) => {
        if (issue.code !== 'OVER_STOCK' && issue.code !== 'INGREDIENT_SHORT') return false
        const line = checkedItems.find((item) => item.lineId === issue.lineId)
        return !line || !stockOverrideAccepted(line.stockOverride, line.qty, rulesContext)
      })
      if (unconfirmed) return { ok: false, error: unconfirmed.message }

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
        paidById: seller.id,
        ownerStaffId: seller.id,
        ownerStaffName: seller.name,
        note: input.note,
        createdAt,
        tableHistory,
        clientOrderId,
      }

      commitDb((prev) => {
        order.number = provider.mode === 'hub'
          ? 0
          : nextOrderNumber(
              prev.orders.filter((existing) => existing.storeId === target.id).map((existing) => existing.number),
              target.settings.orderRules.orderNumberFormat,
            )
        order.provisionalNumber = provider.mode === 'hub'
          ? provisionalOrderNumber(
              provider.deviceIdentifier(),
              prev.orders.filter((existing) => existing.storeId === target.id).length + 1,
            )
          : undefined
        const plan = planStockDeductions(
          checkedItems,
          prev.products,
          target.settings.orderRules.deductIngredientsOnSale,
        )
        const updatedProducts = prev.products.map((product) => {
          if (product.storeId !== target.id) return product
          const baseDeduction = plan.productStock.get(stockKey(product.id))
          const nextProduct = baseDeduction && product.trackStock
            ? { ...product, stock: Math.max(0, round(product.stock - baseDeduction.qty)) }
            : product
          const nextVariants = (nextProduct.variants ?? []).map((variant) => {
            const deduction = plan.productStock.get(stockKey(product.id, variant.id))
            return deduction && variant.trackStock
              ? { ...variant, stock: Math.max(0, round(variant.stock - deduction.qty)) }
              : variant
          })
          return nextVariants.some((variant, index) => variant !== nextProduct.variants?.[index])
            ? { ...nextProduct, variants: nextVariants }
            : nextProduct
        })
        const updatedInventory = prev.inventoryItems.map((item) => {
          const line = plan.ingredients.get(item.id)
          if (!line || item.storeId !== target.id) return item
          return { ...item, onHand: Math.max(0, roundQuantity(item.onHand - line.qty)) }
        })
        const orderLabel = order.provisionalNumber ?? String(order.number)
        const ingredientMovements = [...plan.ingredients.values()].flatMap((line) => {
          const item = prev.inventoryItems.find((candidate) =>
            candidate.id === line.itemId && candidate.storeId === target.id,
          )
          if (!item) return []
          const deducted = Math.min(line.qty, item.onHand)
          if (deducted <= 0) return []
          return [{
            id: uid('mov'),
            storeId: target.id,
            itemId: item.id,
            type: 'sale_use' as const,
            qtyDelta: -roundQuantity(deducted),
            unitCostSnapshot: item.avgCostPerBaseUnit,
            reason: `Sale ${orderLabel}`,
            userId: seller.id,
            userName: seller.name,
            refType: 'order',
            refId: order.id,
            createdAt,
          }]
        })
        const baseNext: Database = {
          ...prev,
          orders: [order, ...prev.orders],
          products: updatedProducts,
          inventoryItems: updatedInventory,
          stockMovements: [...ingredientMovements, ...prev.stockMovements],
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
        const maintained = maintainAvailabilityAfterStockChange(
          prev,
          updatedProducts,
          updatedInventory,
          seller,
          new Date(createdAt),
        )
        const next: Database = {
          ...baseNext,
          products: maintained.products,
          inventoryItems: maintained.inventoryItems,
          auditLogs: maintained.auditLogs,
        }
        const stockChanges: AuditJsonValue[] = []
        for (const deduction of plan.productStock.values()) {
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
            after: Math.max(0, round(stockBefore - deduction.qty)),
            shortfall: Math.max(0, round(deduction.qty - stockBefore)),
          })
        }
        for (const line of plan.ingredients.values()) {
          const item = prev.inventoryItems.find((candidate) => candidate.id === line.itemId)
          if (!item) continue
          stockChanges.push({
            product: item.name,
            variant: 'ingredient',
            before: item.onHand,
            after: Math.max(0, roundQuantity(item.onHand - line.qty)),
            shortfall: Math.max(0, roundQuantity(line.qty - item.onHand)),
          })
        }
        const overrides = checkedItems
          .filter((item) => item.stockOverride)
          .map((item) => ({
            line: item.lineId ?? item.productId,
            requested: item.stockOverride?.requested ?? item.qty,
            available: item.stockOverride?.available ?? 0,
            confirmedByName: item.stockOverride?.confirmedByName ?? '',
          }))
        let logged = addLog(next, seller, {
          storeId: target.id,
          action: 'created',
          entity: 'order',
          entityId: order.id,
          summary: `Created order #${orderLabel} for ${order.total.toFixed(3)} DT${table ? ` at ${table.name}` : ''}`,
          after: {
            number: order.number,
            provisionalNumber: order.provisionalNumber ?? '',
            total: order.total,
            discount: order.discount,
            paymentMethod: order.paymentMethod,
            tableName: order.tableName ?? '',
            guests: order.guests ?? 0,
            stockChanges,
            overrides,
          },
        })
        if (discount > 0) {
          logged = addLog(logged, seller, {
            storeId: target.id,
            action: 'discount_applied',
            entity: 'order',
            entityId: order.id,
            summary: `Applied ${discount.toFixed(3)} DT discount to order #${orderLabel}`,
            after: { amount: discount, orderTotal: order.total },
          })
        }
        return logged
      })
      return { ok: true, order }
    },
    [commitDb, provider, requireActor],
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
        const verification = await verifyAuthorizationPin(managerPin.trim(), initialOrder.storeId, 'void-order')
        if (!verification.ok) return verification
        verifiedAdminId = verification.confirmer.id
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
        const store = prev.stores.find((candidate) => candidate.id === order.storeId)
        const restorePlan = planStockDeductions(
          order.items,
          prev.products,
          store?.settings.orderRules.deductIngredientsOnSale === true,
        )
        const restoredProducts = prev.products.map((product) => {
          if (product.storeId !== order.storeId) return product
          const baseQty = restorePlan.productStock.get(stockKey(product.id))?.qty ?? 0
          const nextProduct = baseQty && product.trackStock
            ? { ...product, stock: round(product.stock + baseQty) }
            : product
          const variants = (nextProduct.variants ?? []).map((variant) => {
            const qty = restorePlan.productStock.get(stockKey(product.id, variant.id))?.qty ?? 0
            return variant.trackStock && qty
              ? { ...variant, stock: round(variant.stock + qty) }
              : variant
          })
          return variants.some((variant, index) => variant !== nextProduct.variants?.[index])
            ? { ...nextProduct, variants }
            : nextProduct
        })
        const restoredInventory = prev.inventoryItems.map((item) => {
          const line = restorePlan.ingredients.get(item.id)
          if (!line || item.storeId !== order.storeId) return item
          return { ...item, onHand: roundQuantity(item.onHand + line.qty) }
        })
        const orderLabel = order.provisionalNumber ?? String(order.number)
        const returnMovements = [...restorePlan.ingredients.values()].flatMap((line) => {
          const item = prev.inventoryItems.find((candidate) =>
            candidate.id === line.itemId && candidate.storeId === order.storeId,
          )
          if (!item || line.qty <= 0) return []
          return [{
            id: uid('mov'),
            storeId: order.storeId,
            itemId: item.id,
            type: 'void_return' as const,
            qtyDelta: roundQuantity(line.qty),
            unitCostSnapshot: item.avgCostPerBaseUnit,
            reason: `Void ${orderLabel}`,
            userId: voidedById,
            userName: voidedByName,
            refType: 'order',
            refId: order.id,
            createdAt: at,
          }]
        })
        const baseNext: Database = {
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
          products: restoredProducts,
          inventoryItems: restoredInventory,
          stockMovements: [...returnMovements, ...prev.stockMovements],
          ledger: [...ledgerEntries, ...prev.ledger],
        }
        const maintained = maintainAvailabilityAfterStockChange(
          prev,
          restoredProducts,
          restoredInventory,
          authorizer,
          new Date(at),
        )
        const next: Database = {
          ...baseNext,
          products: maintained.products,
          inventoryItems: maintained.inventoryItems,
          auditLogs: maintained.auditLogs,
        }
        let logged = addLog(next, authorizer, {
          storeId: order.storeId,
          action: 'voided',
          entity: 'order',
          entityId: order.id,
          summary: `Voided order #${orderLabel}${order.tableName ? ` · ${order.tableName}` : ''}: ${reason}`,
          before: { status: order.status, tableName: order.tableName ?? '' },
          after: {
            status: 'void',
            reason,
            total: order.total,
            tableName: order.tableName ?? '',
            restoredIngredients: returnMovements.length,
          },
        })
        if (order.paymentMethod === 'cash' || creditRefund > 0) {
          const refundAmount = order.paymentMethod === 'cash' ? order.total : creditRefund
          const refundMethod = order.paymentMethod === 'cash' ? 'cash' : 'store_credit'
          logged = addLog(logged, authorizer, {
            storeId: order.storeId,
            action: 'refund_applied',
            entity: 'order',
            entityId: order.id,
            summary: `Refunded ${refundAmount.toFixed(3)} DT for order #${orderLabel}${order.tableName ? ` · ${order.tableName}` : ''} (${refundMethod})`,
            after: { amount: refundAmount, method: refundMethod },
          })
        }
        return logged
      })
      return { ok: true }
    },
    [commitDb, requireActor, verifyAuthorizationPin],
  )


  return { createOrder, voidOrder }
}

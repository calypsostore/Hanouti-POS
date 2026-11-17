import { useCallback } from 'react'
import type { AuditJsonValue, Database, Order, OrderItem, User } from '../types'
import { computeTotals } from '../lib/pricing'
import { round } from '../lib/pricing-utils'
import { uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import { addLog } from './audit'
import { can } from '../lib/permissions'
import { dineInTableError, guestCountError } from '../lib/tableService'
import { ensureShiftForActor } from '../lib/registerShifts'
import { nextOrderNumber, provisionalOrderNumber } from '../lib/orderNumber'
import { roundQuantity } from '../lib/inventory'
import { maintainAvailabilityAfterStockChange } from './availabilityMaintenance'
import { staffConsumptionDiscount, staffConsumptionError } from '../lib/staffConsumption'
import { isQuick } from '../lib/posMode'
import { canAddOrdersToTabs, quickTabLimitError } from '../lib/customerTabs'
import {
  planStockDeductions, resolveOrderLines, stockKey, stockOverrideAccepted, validateOrderLines,
} from '../shared/orderRules'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

export type BuiltCreateOrderResult =
  | { ok: true; order: Order; updateDb?: (prev: Database) => Database }
  | { ok: false; error: string }

export type BuildCreateOrder = (
  input: Parameters<AppContextValue['createOrder']>[0],
  current: Database,
) => BuiltCreateOrderResult

export function useOrdersSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, provider, requireActor, verifyAuthorizationPin } = dependencies
  const buildCreateOrder = useCallback<BuildCreateOrder>(
    (input, current) => {
      const actorResult = requireActor()
      if (!actorResult.ok) return actorResult
      const seller = actorResult.actor
      if (!seller.storeId) return { ok: false, error: 'No active store session.' }
      if (!input || !Array.isArray(input.items)) return { ok: false, error: 'The order items are invalid.' }
      if (input.staffConsumption !== undefined && typeof input.staffConsumption !== 'boolean') {
        return { ok: false, error: 'Staff item checkout is invalid.' }
      }
      const staffConsumption = input.staffConsumption === true
      if (staffConsumption && !can(seller, 'useStaffAllowances')) {
        return { ok: false, error: 'You do not have permission to record staff items.' }
      }
      if (!['cash', 'card', 'credit', 'unpaid'].includes(input.paymentMethod) ||
        !['takeaway', 'dine-in', 'delivery'].includes(input.channel)) {
        return { ok: false, error: 'Choose a valid order type and payment method.' }
      }
      if (staffConsumption && input.paymentMethod !== 'cash' && input.paymentMethod !== 'card') {
        return { ok: false, error: 'Staff items must be paid by cash or card.' }
      }
      const target = current.stores.find((s) => s.id === seller.storeId)
      if (!target) return { ok: false, error: 'Store not found.' }
      if (input.paymentMethod === 'unpaid' && !isQuick(target)) {
        return { ok: false, error: 'Unpaid order tracking is available only in Quick mode.' }
      }
      if (staffConsumption && (seller.stationOnly || input.channel !== 'takeaway' || input.customerId)) {
        return { ok: false, error: 'Staff items must be recorded for yourself as a takeaway order.' }
      }
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
      if (input.channel === 'dine-in') {
        const excludedOpenOrder = current.openOrders.find((order) =>
          order.id === input.excludeOpenOrderId && order.storeId === target.id,
        )
        const excludeOpenOrderId = excludedOpenOrder && (manualTables
          ? excludedOpenOrder.tableName.trim().toLowerCase() === input.tableName?.trim().toLowerCase()
          : excludedOpenOrder.tableId === input.tableId)
          ? excludedOpenOrder.id
          : undefined
        const tableError = dineInTableError(target.settings, current.tables, current.openOrders, {
          storeId: target.id,
          tableId: input.tableId,
          tableName: input.tableName,
          excludeOpenOrderId,
        })
        if (tableError) return { ok: false, error: tableError }
      }
      if (input.channel === 'dine-in' && target.settings.features.tables) {
        const guestsError = guestCountError(input.guests, target.settings.guestRequirement)
        if (guestsError) return { ok: false, error: guestsError }
      }
      if (!input.items.length) return { ok: false, error: 'Cart is empty.' }
      const ensuredShift = ensureShiftForActor(current, target.id, seller)
      const shift = ensuredShift.shift
      if ((target.settings.requireShiftForOrders || staffConsumption) && !shift) {
        return { ok: false, error: 'Open your shift before taking orders.' }
      }
      if (staffConsumption) {
        const error = staffConsumptionError(
          input.items,
          target.settings.staffConsumption,
          current.orders,
          shift?.id,
          seller.id,
        )
        if (error) return { ok: false, error }
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
      if (payingOpenOrder && (input.channel !== 'dine-in' || (manualTables
        ? payingOpenOrder.tableName.trim().toLowerCase() !== input.tableName?.trim().toLowerCase()
        : payingOpenOrder.tableId !== input.tableId))) {
        return { ok: false, error: 'The table order being paid does not match the selected table.' }
      }
      const customer = input.customerId
        ? current.customers.find((candidate) =>
            candidate.id === input.customerId && candidate.storeId === target.id,
          )
        : undefined
      if (input.customerId && !customer) {
        return { ok: false, error: 'That customer does not belong to this store.' }
      }
      const rulesStore = staffConsumption
        ? {
            ...target,
            settings: {
              ...target.settings,
              orderRules: { ...target.settings.orderRules, deductIngredientsOnSale: true },
            },
          }
        : target
      const rulesContext = {
        store: rulesStore,
        products: current.products,
        inventoryItems: current.inventoryItems,
        openOrders: current.openOrders,
        excludeOpenOrderId: payingOpenOrder?.id,
        actor: staffConsumption
          ? { ...seller, permissions: { ...seller.permissions, discount: true } }
          : seller,
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
        if (!canAddOrdersToTabs(target, seller)) {
          return { ok: false, error: 'You do not have permission to add orders to tabs.' }
        }
        if (!input.customerId) return { ok: false, error: 'Select a customer to add this order to a tab.' }
      }

      const requestedDiscount = staffConsumption
        ? staffConsumptionDiscount(checkedItems, target.settings, target.settings.staffConsumption)
        : input.discount ?? 0
      if (!Number.isFinite(requestedDiscount) || requestedDiscount < 0) {
        return { ok: false, error: 'Discount must be zero or a positive amount.' }
      }
      const undiscounted = computeTotals(checkedItems, target.settings)
      if (requestedDiscount > undiscounted.total) {
        return { ok: false, error: 'Discount cannot exceed the order total.' }
      }
      const discount = round(requestedDiscount)
      const totals = computeTotals(checkedItems, target.settings, discount)
      if (isQuick(target) && input.paymentMethod === 'credit') {
        const limitError = quickTabLimitError(
          seller,
          balanceFor(current.ledger, input.customerId ?? ''),
          totals.total,
        )
        if (limitError) return { ok: false, error: limitError }
      }

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
        staffConsumption: staffConsumption || undefined,
      }

      const updateDb = (prev: Database): Database => {
        let starting = prev
        if (ensuredShift.autoOpened && shift) {
          starting = {
            ...prev,
            registerSessions: [...prev.registerSessions, shift],
          }
          starting = addLog(starting, seller, {
            storeId: target.id,
            action: 'register_opened',
            entity: 'register',
            entityId: shift.id,
            summary: `Shift auto-opened for ${seller.name}`,
            after: { shiftNumber: shift.shiftNumber ?? '', autoOpened: true },
          })
        }
        order.number = provider.mode === 'hub'
          ? 0
          : nextOrderNumber(
              starting.orders.filter((existing) => existing.storeId === target.id).map((existing) => existing.number),
              target.settings.orderRules.orderNumberFormat,
            )
        order.provisionalNumber = provider.mode === 'hub'
          ? provisionalOrderNumber(
              provider.deviceIdentifier(),
              starting.orders.filter((existing) => existing.storeId === target.id).length + 1,
            )
          : undefined
        const plan = planStockDeductions(
          checkedItems,
          starting.products,
          staffConsumption || target.settings.orderRules.deductIngredientsOnSale,
        )
        const updatedProducts = starting.products.map((product) => {
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
        const updatedInventory = starting.inventoryItems.map((item) => {
          const line = plan.ingredients.get(item.id)
          if (!line || item.storeId !== target.id) return item
          return { ...item, onHand: Math.max(0, roundQuantity(item.onHand - line.qty)) }
        })
        const orderLabel = order.provisionalNumber ?? String(order.number)
        const ingredientMovements = [...plan.ingredients.values()].flatMap((line) => {
          const item = starting.inventoryItems.find((candidate) =>
            candidate.id === line.itemId && candidate.storeId === target.id,
          )
          if (!item) return []
          const deducted = Math.min(line.qty, item.onHand)
          if (deducted <= 0) return []
          return [{
            id: uid('mov'),
            storeId: target.id,
            itemId: item.id,
            type: staffConsumption ? 'staff_use' as const : 'sale_use' as const,
            qtyDelta: -roundQuantity(deducted),
            unitCostSnapshot: item.avgCostPerBaseUnit,
            reason: staffConsumption ? `Staff items ${orderLabel}` : `Sale ${orderLabel}`,
            userId: seller.id,
            userName: seller.name,
            refType: 'order',
            refId: order.id,
            createdAt,
          }]
        })
        const baseNext: Database = {
          ...starting,
          orders: [order, ...starting.orders],
          products: updatedProducts,
          inventoryItems: updatedInventory,
          stockMovements: [...ingredientMovements, ...starting.stockMovements],
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
                  ...starting.ledger,
                ]
              : starting.ledger,
        }
        const maintained = maintainAvailabilityAfterStockChange(
          starting,
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
          const product = starting.products.find((candidate) => candidate.id === deduction.productId)
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
          const item = starting.inventoryItems.find((candidate) => candidate.id === line.itemId)
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
          summary: `${staffConsumption ? 'Recorded staff items' : 'Created order'} #${orderLabel} for ${order.total.toFixed(3)} DT${table ? ` at ${table.name}` : ''}`,
          after: {
            number: order.number,
            provisionalNumber: order.provisionalNumber ?? '',
            total: order.total,
            discount: order.discount,
            paymentMethod: order.paymentMethod,
            tableName: order.tableName ?? '',
            guests: order.guests ?? 0,
            staffConsumption,
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
      }
      return { ok: true, order, updateDb }
    },
    [provider, requireActor],
  )
  const createOrder = useCallback<AppContextValue['createOrder']>((input) => {
    const built = buildCreateOrder(input, dbRef.current)
    if (!built.ok) return built
    if (built.updateDb) commitDb(built.updateDb)
    return { ok: true, order: built.order }
  }, [buildCreateOrder, commitDb, dbRef])

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
      const ensuredVoidShift = ensureShiftForActor(dbRef.current, order.storeId, latestActor.actor)
      const voidShift = ensuredVoidShift.shift
      commitDb((prev) => {
        const starting = ensuredVoidShift.autoOpened && voidShift
          ? addLog({
              ...prev,
              registerSessions: [...prev.registerSessions, voidShift],
            }, latestActor.actor, {
              storeId: order.storeId,
              action: 'register_opened',
              entity: 'register',
              entityId: voidShift.id,
              summary: `Shift auto-opened for ${latestActor.actor.name}`,
              after: { shiftNumber: voidShift.shiftNumber ?? '', autoOpened: true },
            })
          : prev
        const ledgerEntries: Database['ledger'] = []
        let creditRefund = 0
        if (order.paymentMethod === 'credit' && order.customerId) {
          const outstanding = Math.max(0, balanceFor(starting.ledger, order.customerId))
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
        const store = starting.stores.find((candidate) => candidate.id === order.storeId)
        const restorePlan = planStockDeductions(
          order.items,
          starting.products,
          order.staffConsumption === true || store?.settings.orderRules.deductIngredientsOnSale === true,
        )
        const restoredProducts = starting.products.map((product) => {
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
        const restoredInventory = starting.inventoryItems.map((item) => {
          const line = restorePlan.ingredients.get(item.id)
          if (!line || item.storeId !== order.storeId) return item
          return { ...item, onHand: roundQuantity(item.onHand + line.qty) }
        })
        const orderLabel = order.provisionalNumber ?? String(order.number)
        const returnMovements = [...restorePlan.ingredients.values()].flatMap((line) => {
          const item = starting.inventoryItems.find((candidate) =>
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
          ...starting,
          orders: starting.orders.map((o) =>
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
          stockMovements: [...returnMovements, ...starting.stockMovements],
          ledger: [...ledgerEntries, ...starting.ledger],
        }
        const maintained = maintainAvailabilityAfterStockChange(
          starting,
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


  return { createOrder, buildCreateOrder, voidOrder }
}

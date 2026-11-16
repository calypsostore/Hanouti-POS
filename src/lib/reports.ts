import type {
  AuditJsonValue,
  Database,
  RegisterReportDetails,
  RegisterSession,
  RegisterSnapshot,
} from '../types'
import { round } from './pricing-utils.ts'
import { recipeFor } from '../shared/orderRules.ts'
import { expectedShiftCash, orderPaidBy } from './shiftCash.ts'
import {
  completedOrdersAt,
  ordersCreatedInWindow,
  ordersForRegisterSession,
  recordedOrdersAt,
  registerSessionItems,
  voidedOrdersForRegisterSession,
} from './registerItems.ts'

/**
 * Cash-register report engine.
 *
 * Every number is computed from persisted data (orders, ledger, expenses)
 * inside the session window — never from transient UI state — so an X report
 * printed twice in a row is identical, and a Z report frozen at close never
 * changes afterwards.
 */

type TotalsSource = Pick<Database, 'orders' | 'ledger' | 'expenses' | 'purchasePayments'> &
  Partial<Pick<Database, 'registerSessions'>> &
  Partial<Pick<Database, 'stores'>>

const isInWindow = (value: string, start: number, end: number) => {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end
}

const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0))

export const computeRegisterTotals = (
  db: TotalsSource,
  storeId: string,
  startISO: string,
  endISO: string,
  openingCash: number,
  sessionId?: string,
): RegisterSnapshot => {
  const start = new Date(startISO).getTime()
  const end = new Date(endISO).getTime()

  const session = sessionId ? db.registerSessions?.find((candidate) => candidate.id === sessionId) : undefined
  const sessionScope = sessionId
    ? {
        id: sessionId,
        storeId,
        openedAt: startISO,
        staffId: session?.staffId,
        openedById: session?.openedById,
      }
    : undefined
  const createdInWindow = sessionScope
    ? ordersForRegisterSession(db, sessionScope, endISO)
    : ordersCreatedInWindow(db, storeId, start, end)
  const completed = completedOrdersAt(createdInWindow, end)
  const recorded = recordedOrdersAt(createdInWindow, end)
  const voided = sessionScope
    ? voidedOrdersForRegisterSession(db, sessionScope, endISO)
    : db.orders.filter((order) =>
        order.storeId === storeId &&
        order.status === 'void' &&
        !!order.voidedAt &&
        isInWindow(order.voidedAt, start, end),
      )

  const cashSales = sum(completed.filter((order) => order.paymentMethod === 'cash').map((order) => order.total))
  const cashReceived = sum(
    createdInWindow.filter((order) =>
      order.paymentMethod === 'cash' && order.status !== 'recorded',
    ).map((order) => order.total),
  )
  const cardSales = sum(completed.filter((order) => order.paymentMethod === 'card').map((order) => order.total))
  const creditSales = sum(completed.filter((order) => order.paymentMethod === 'credit').map((order) => order.total))
  const cashRefunds = sum(
    voided.filter((order) => order.paymentMethod === 'cash').map((order) => order.total),
  )

  const payments = db.ledger.filter((l) => {
    return l.storeId === storeId &&
      l.type === 'payment' &&
      !l.creditAdjustment &&
      (sessionId
        ? l.shiftId === sessionId && (!l.createdAt || isInWindow(l.createdAt, start, end))
        : isInWindow(l.createdAt ?? '', start, end))
  })
  const cashSettlements = sum(payments.filter((payment) => payment.method === 'cash').map((payment) => payment.amount))
  const cardSettlements = sum(payments.filter((payment) => payment.method === 'card').map((payment) => payment.amount))

  const cashExpenses = sum(db.expenses
    .filter((expense) => expense.storeId === storeId &&
      (sessionId
        ? expense.shiftId === sessionId && (!expense.createdAt || isInWindow(expense.createdAt, start, end))
        : isInWindow(expense.createdAt ?? expense.date, start, end)))
    .map((expense) => expense.amount))
  const supplierCashPayments = sum(db.purchasePayments
    .filter((payment) =>
      payment.storeId === storeId &&
      payment.method === 'cash' &&
      (sessionId
        ? payment.shiftId === sessionId && isInWindow(payment.createdAt, start, end)
        : isInWindow(payment.createdAt, start, end)),
    )
    .map((payment) => payment.amount))
  const expenses = round(cashExpenses + supplierCashPayments)
  const quickMode = db.stores?.find((store) => store.id === storeId)?.settings.posMode === 'quick'

  return {
    salesTotal: round(cashSales + cardSales + creditSales),
    cashSales,
    cardSales,
    creditSales,
    ordersCount: completed.length,
    voidedCount: voided.length,
    voidedTotal: sum(voided.map((order) => order.total)),
    cashRefunds,
    discounts: sum(completed.map((order) => order.discount)),
    tax: sum(completed.map((order) => order.tax)),
    service: sum(completed.map((order) => order.service)),
    expenses,
    cashSettlements,
    cardSettlements,
    settlementCount: payments.length,
    expectedCash: quickMode ? 0 : expectedShiftCash(openingCash, cashReceived, cashSettlements, cashRefunds, expenses),
    recordedCount: recorded.length,
    recordedTotal: sum(recorded.map((order) => order.total)),
  }
}

const auditString = (value: AuditJsonValue | undefined): string =>
  typeof value === 'string' ? value : ''

const auditNumber = (value: AuditJsonValue | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const auditItems = (value: AuditJsonValue | undefined): string[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return []
    const name = auditString(entry.name)
    const qty = auditNumber(entry.qty)
    return name ? [`${qty || 1} x ${name}`] : []
  })
}

export const registerReportDetails = (
  db: Database,
  session: RegisterSession,
  endISO = new Date().toISOString(),
  staffId?: string,
): RegisterReportDetails => {
  const store = db.stores.find((candidate) => candidate.id === session.storeId)
  if (!store) throw new Error('Store not found for register report.')
  const start = Date.parse(session.openedAt)
  const end = Date.parse(endISO)
  const createdInWindow = ordersForRegisterSession(db, session, endISO)
  const completed = completedOrdersAt(createdInWindow, end)
  const snapshot = computeRegisterTotals(
    db,
    session.storeId,
    session.openedAt,
    endISO,
    session.openingFloat ?? session.openingCash,
    session.id,
  )
  const refunds = db.ledger.filter((entry) =>
    entry.storeId === session.storeId &&
    entry.type === 'payment' &&
    entry.creditAdjustment === true &&
    entry.shiftId === session.id &&
    isInWindow(entry.createdAt ?? '', start, end),
  )
  const taxByRate = new Map<number | null, number>()
  const byEmployee = new Map<string, { count: number; total: number }>()
  const byCategory = new Map<string, { qty: number; total: number }>()
  const staffUse = new Map<string, { staffName: string; itemName: string; quantity: number; retailValue: number; chargedValue: number }>()
  const items = registerSessionItems(db, session, endISO, staffId)

  for (const order of completed) {
    const taxRate = typeof order.taxRate === 'number' && Number.isFinite(order.taxRate) ? order.taxRate : null
    taxByRate.set(taxRate, round((taxByRate.get(taxRate) ?? 0) + order.tax))

    if (!staffId || orderPaidBy(order) === staffId) {
      const employee = byEmployee.get(order.staffName) ?? { count: 0, total: 0 }
      byEmployee.set(order.staffName, {
        count: employee.count + 1,
        total: round(employee.total + order.total),
      })
    }

    for (const item of order.items) {
      const lineTotal = round(item.price * item.qty)
      const catalogProduct = db.products.find((candidate) => candidate.id === item.productId)
      const category = db.categories.find((candidate) => candidate.id === catalogProduct?.categoryId)
      const categoryName = category?.name ?? catalogProduct?.name ?? 'Other'
      const categoryTotal = byCategory.get(categoryName) ?? { qty: 0, total: 0 }
      byCategory.set(categoryName, {
        qty: round(categoryTotal.qty + item.qty),
        total: round(categoryTotal.total + lineTotal),
      })
      if (order.staffConsumption && (!staffId || orderPaidBy(order) === staffId)) {
        const itemName = [item.name, item.variantName].filter(Boolean).join(' · ')
        const key = `${order.staffId}:${item.productId}:${item.variantId ?? ''}`
        const currentUse = staffUse.get(key) ?? {
          staffName: order.staffName,
          itemName,
          quantity: 0,
          retailValue: 0,
          chargedValue: 0,
        }
        const modifierValue = (item.modifiers ?? []).reduce((total, modifier) => total + modifier.priceDelta, 0)
        const retailValue = round((item.price + modifierValue) * item.qty)
        const orderRetail = order.items.reduce((total, line) =>
          total + (line.price + (line.modifiers ?? []).reduce((sum, modifier) => sum + modifier.priceDelta, 0)) * line.qty, 0)
        const chargedValue = orderRetail > 0 ? round(order.total * retailValue / orderRetail) : 0
        currentUse.quantity = round(currentUse.quantity + item.qty)
        currentUse.retailValue = round(currentUse.retailValue + retailValue)
        currentUse.chargedValue = round(currentUse.chargedValue + chargedValue)
        staffUse.set(key, currentUse)
      }
    }
  }

  const beans = store.settings.coffeeTracking?.enabled
    ? db.inventoryItems.find((item) =>
        item.id === store.settings.coffeeTracking.inventoryItemId &&
        item.storeId === session.storeId && item.baseUnit === 'g',
      )
    : undefined
  let coffeeServings = 0
  let recipeBeanUse = 0
  if (beans) {
    for (const order of completed) {
      if (staffId && orderPaidBy(order) !== staffId) continue
      for (const item of order.items) {
        const product = db.products.find((candidate) =>
          candidate.id === item.productId && candidate.storeId === session.storeId,
        )
        if (!product) continue
        const variant = product.variants?.find((candidate) => candidate.id === item.variantId)
        const beanQtyPerServing = recipeFor(product, variant, item.modifiers)
          .find((ingredient) => ingredient.inventoryItemId === beans.id)?.qtyPerUnit
        if (!beanQtyPerServing) continue
        coffeeServings = round(coffeeServings + item.qty)
        recipeBeanUse = round(recipeBeanUse + beanQtyPerServing * item.qty)
      }
    }
  }
  const coffeeExpectedUseMin = beans
    ? round(coffeeServings * 1000 / store.settings.coffeeTracking.servingsPerKgMax)
    : 0
  const coffeeExpectedUseMax = beans
    ? round(coffeeServings * 1000 / store.settings.coffeeTracking.servingsPerKgMin)
    : 0
  const beanMovementsAfterOpen = beans
    ? db.stockMovements.filter((movement) =>
        movement.storeId === session.storeId && movement.itemId === beans.id &&
        Date.parse(movement.createdAt) >= start,
      )
    : []
  const openingBeanStock = beans
    ? round(beans.onHand - sum(beanMovementsAfterOpen.map((movement) => movement.qtyDelta)))
    : 0
  const movementsByClose = beanMovementsAfterOpen.filter((movement) => Date.parse(movement.createdAt) <= end)
  const nonSaleBeanMovements = movementsByClose.filter((movement) =>
    movement.type !== 'sale_use' && movement.type !== 'staff_use' && movement.type !== 'count_correction',
  )
  const availableBeans = round(openingBeanStock + sum(nonSaleBeanMovements.map((movement) => movement.qtyDelta)))
  const ledgerRemaining = round(openingBeanStock + sum(movementsByClose.map((movement) => movement.qtyDelta)))
  const inventoryYieldSummaries = store.settings.inventoryYieldTracking?.enabled
    ? store.settings.inventoryYieldTracking.trackers.flatMap((tracker) => {
        const inventoryItem = db.inventoryItems.find((item) =>
          item.id === tracker.inventoryItemId && item.storeId === session.storeId,
        )
        if (!inventoryItem) return []
        const productIds = new Set(tracker.productIds)
        const categoryIds = new Set(tracker.categoryIds)
        let soldQuantity = 0
        let recipeUse = 0
        for (const order of completed) {
          if (staffId && orderPaidBy(order) !== staffId) continue
          for (const orderItem of order.items) {
            const product = db.products.find((candidate) =>
              candidate.id === orderItem.productId && candidate.storeId === session.storeId,
            )
            if (!product || (!productIds.has(product.id) && !categoryIds.has(product.categoryId))) continue
            soldQuantity = round(soldQuantity + orderItem.qty)
            const variant = product.variants?.find((candidate) => candidate.id === orderItem.variantId)
            const itemRecipeUse = recipeFor(product, variant, orderItem.modifiers)
              .find((ingredient) => ingredient.inventoryItemId === inventoryItem.id)?.qtyPerUnit ?? 0
            recipeUse = round(recipeUse + itemRecipeUse * orderItem.qty)
          }
        }
        const expectedUseMin = round(soldQuantity * tracker.referenceQuantity / tracker.servingsMax)
        const expectedUseMax = round(soldQuantity * tracker.referenceQuantity / tracker.servingsMin)
        const movementsAfterOpen = db.stockMovements.filter((movement) =>
          movement.storeId === session.storeId && movement.itemId === inventoryItem.id &&
          Date.parse(movement.createdAt) >= start,
        )
        const openingStock = round(inventoryItem.onHand - sum(movementsAfterOpen.map((movement) => movement.qtyDelta)))
        const movementsByClose = movementsAfterOpen.filter((movement) => Date.parse(movement.createdAt) <= end)
        const nonConsumptionMovements = movementsByClose.filter((movement) =>
          movement.type !== 'sale_use' && movement.type !== 'staff_use' && movement.type !== 'count_correction',
        )
        const availableStock = round(openingStock + sum(nonConsumptionMovements.map((movement) => movement.qtyDelta)))
        return [{
          itemName: inventoryItem.name,
          soldQuantity,
          referenceQuantity: tracker.referenceQuantity,
          expectedUseMin,
          expectedUseMax,
          recipeUse,
          expectedRemainingMin: round(availableStock - expectedUseMax),
          expectedRemainingMax: round(availableStock - expectedUseMin),
          ledgerRemaining: round(openingStock + sum(movementsByClose.map((movement) => movement.qtyDelta))),
          unit: inventoryItem.baseUnit,
        }]
      })
    : undefined

  const voidedOrders = voidedOrdersForRegisterSession(db, session, endISO)
    .filter((order) => !staffId || order.voidedById === staffId)
    .map((order) => {
      const log = db.auditLogs.find((entry) =>
        entry.storeId === session.storeId &&
        entry.entity === 'order' &&
        entry.entityId === order.id &&
        entry.action === 'voided' &&
        isInWindow(entry.createdAt, start, end),
      )
      return {
        number: order.number,
        total: order.total,
        paymentMethod: order.paymentMethod,
        reason: auditString(log?.after?.reason),
        items: order.items.map((item) => `${item.qty} x ${item.name}`),
      }
    })

  const cancelledItems = db.auditLogs
    .filter((entry) =>
      entry.storeId === session.storeId &&
      entry.entity === 'order' &&
      entry.action === 'voided' &&
      !!entry.entityId &&
      !db.orders.some((order) => order.id === entry.entityId) &&
      isInWindow(entry.createdAt, start, end),
    )
    .map((entry) => ({
      tableName: auditString(entry.before?.tableName) || 'Table order',
      total: auditNumber(entry.before?.total),
      items: auditItems(entry.before?.items),
    }))

  const cashExpenses = sum(db.expenses
    .filter((expense) =>
      expense.storeId === session.storeId &&
      expense.shiftId === session.id &&
      (!expense.createdAt || isInWindow(expense.createdAt, start, end)),
    )
    .map((expense) => expense.amount))
  const supplierCashPayments = sum(db.purchasePayments
    .filter((payment) =>
      payment.storeId === session.storeId &&
      payment.method === 'cash' &&
      payment.shiftId === session.id &&
      isInWindow(payment.createdAt, start, end),
    )
    .map((payment) => payment.amount))

  return {
    storeName: store.name,
    storeAddress: store.address,
    storeCity: store.city,
    storePhone: store.phone,
    receiptWidth: store.settings.printer.width,
    grossSales: sum(completed.map((order) => order.total + order.discount)),
    netSales: sum(completed.map((order) => order.total)),
    completedOrders: completed.length,
    totalTransactions: completed.length + snapshot.settlementCount,
    storeCreditRefunds: sum(refunds.map((entry) => entry.amount)),
    cashReceived: sum(createdInWindow
      .filter((order) => order.paymentMethod === 'cash' && order.status !== 'recorded')
      .map((order) => order.total)),
    cashExpenses,
    supplierCashPayments,
    taxBreakdown: [...taxByRate.entries()]
      .map(([rate, amount]) => ({ rate, amount }))
      .sort((a, b) => (a.rate ?? Number.POSITIVE_INFINITY) - (b.rate ?? Number.POSITIVE_INFINITY)),
    byEmployee: [...byEmployee.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.total - a.total),
    byCategory: [...byCategory.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.total - a.total),
    staffConsumptions: [...staffUse.values()].sort((a, b) =>
      a.staffName.localeCompare(b.staffName) || a.itemName.localeCompare(b.itemName),
    ),
    inventoryYieldSummaries,
    coffeeBeanSummary: beans && !store.settings.inventoryYieldTracking?.enabled
      ? {
          itemName: beans.name,
          servingsSold: coffeeServings,
          expectedUseMin: coffeeExpectedUseMin,
          expectedUseMax: coffeeExpectedUseMax,
          recipeUse: recipeBeanUse,
          expectedRemainingMin: round(availableBeans - coffeeExpectedUseMax),
          expectedRemainingMax: round(availableBeans - coffeeExpectedUseMin),
          ledgerRemaining,
          unit: 'g' as const,
        }
      : undefined,
    ...items,
    voidedOrders,
    cancelledItems,
  }
}

/** Live snapshot for an open session, frozen snapshot for a closed one. */
export const sessionSnapshot = (
  db: TotalsSource,
  session: RegisterSession,
  now = new Date().toISOString(),
): RegisterSnapshot | null => {
  if (session.status === 'closed' && session.snapshot) return session.snapshot
  if (session.status !== 'open') return null
  return computeRegisterTotals(
    db,
    session.storeId,
    session.openedAt,
    now,
    session.openingFloat ?? session.openingCash,
    session.id,
  )
}

export interface RegisterBreakdown {
  byEmployee: Array<{ name: string; count: number; total: number }>
  byCategory: Array<{ name: string; qty: number; total: number }>
}

/** Group the session window's completed orders by employee and product category. */
export const registerBreakdown = (
  db: Database,
  session: RegisterSession,
  endISO = new Date().toISOString(),
  staffId?: string,
): RegisterBreakdown => {
  const end = new Date(endISO).getTime()

  const done = completedOrdersAt(
    ordersForRegisterSession(db, session, endISO),
    end,
  )

  const byEmployee = new Map<string, { count: number; total: number }>()
  for (const o of done) {
    if (staffId && orderPaidBy(o) !== staffId) continue
    const cur = byEmployee.get(o.staffName) ?? { count: 0, total: 0 }
    byEmployee.set(o.staffName, { count: cur.count + 1, total: round(cur.total + o.total) })
  }

  const byCategory = new Map<string, { qty: number; total: number }>()
  for (const o of done) {
    for (const item of o.items) {
      const product = db.products.find((p) => p.id === item.productId)
      const category = db.categories.find((c) => c.id === product?.categoryId)
      const name = category?.name ?? product?.name ?? 'Other'
      const cur = byCategory.get(name) ?? { qty: 0, total: 0 }
      byCategory.set(name, { qty: cur.qty + item.qty, total: round(cur.total + item.price * item.qty) })
    }
  }

  return {
    byEmployee: [...byEmployee.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total),
    byCategory: [...byCategory.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total),
  }
}

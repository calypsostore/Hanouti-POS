import type { Database, RegisterSession, RegisterSnapshot } from '../types'
import { round } from './pricing-utils'

/**
 * Cash-register report engine.
 *
 * Every number is computed from persisted data (orders, ledger, expenses)
 * inside the session window — never from transient UI state — so an X report
 * printed twice in a row is identical, and a Z report frozen at close never
 * changes afterwards.
 */

type TotalsSource = Pick<Database, 'orders' | 'ledger' | 'expenses' | 'purchasePayments'>

export const computeRegisterTotals = (
  db: TotalsSource,
  storeId: string,
  startISO: string,
  endISO: string,
  openingCash: number,
): RegisterSnapshot => {
  const start = new Date(startISO).getTime()
  const end = new Date(endISO).getTime()

  const createdInWindow = db.orders.filter((o) => {
    if (o.storeId !== storeId) return false
    const t = new Date(o.createdAt).getTime()
    return t >= start && t <= end
  })
  const voided = db.orders.filter((o) => {
    if (o.storeId !== storeId || o.status !== 'void' || !o.voidedAt) return false
    const t = new Date(o.voidedAt).getTime()
    return t >= start && t <= end
  })
  const voidedInWindow = (o: (typeof db.orders)[number]) => {
    if (!o.voidedAt) return false
    const t = new Date(o.voidedAt).getTime()
    return t >= start && t <= end
  }
  const done = createdInWindow.filter(
    (o) => !voidedInWindow(o) && (o.status === 'completed' || o.status === 'void'),
  )

  const cashSales = round(
    done.filter((o) => o.paymentMethod === 'cash').reduce((a, o) => a + o.total, 0) +
      voided
        .filter((o) => {
          const created = new Date(o.createdAt).getTime()
          return o.paymentMethod === 'cash' && created >= start && created <= end
        })
        .reduce((a, o) => a + o.total, 0),
  )
  const cardSales = round(done.filter((o) => o.paymentMethod === 'card').reduce((a, o) => a + o.total, 0))
  const creditSales = round(done.filter((o) => o.paymentMethod === 'credit').reduce((a, o) => a + o.total, 0))

  // Refunds: a voided order that was already paid in cash returns to the drawer.
  const cashRefunds = round(
    voided.filter((o) => o.paymentMethod === 'cash').reduce((a, o) => a + o.total, 0),
  )

  const payments = db.ledger.filter((l) => {
    if (l.storeId !== storeId || l.type !== 'payment' || l.creditAdjustment) return false
    const t = new Date(l.createdAt).getTime()
    return t >= start && t <= end
  })
  const cashSettlements = round(payments.filter((l) => l.method === 'cash').reduce((a, l) => a + l.amount, 0))
  const cardSettlements = round(payments.filter((l) => l.method === 'card').reduce((a, l) => a + l.amount, 0))

  const expenses = round(
    db.expenses
      .filter((e) => {
        if (e.storeId !== storeId) return false
        const t = new Date(e.createdAt ?? e.date).getTime()
        return t >= start && t <= end
      })
      .reduce((a, e) => a + e.amount, 0) +
      db.purchasePayments
        .filter((payment) => {
          if (payment.storeId !== storeId || payment.method !== 'cash') return false
          const t = new Date(payment.createdAt).getTime()
          return t >= start && t <= end
        })
        .reduce((a, payment) => a + payment.amount, 0),
  )

  return {
    salesTotal: round(cashSales + cardSales + creditSales),
    cashSales,
    cardSales,
    creditSales,
    ordersCount: done.length,
    voidedCount: voided.length,
    voidedTotal: round(voided.reduce((a, o) => a + o.total, 0)),
    cashRefunds,
    discounts: round(done.reduce((a, o) => a + o.discount, 0)),
    tax: round(done.reduce((a, o) => a + o.tax, 0)),
    service: round(done.reduce((a, o) => a + o.service, 0)),
    expenses,
    cashSettlements,
    cardSettlements,
    settlementCount: payments.length,
    // Drawer expectation: opening float + cash taken in − cash handed out.
    expectedCash: round(openingCash + cashSales + cashSettlements - expenses - cashRefunds),
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
  return computeRegisterTotals(db, session.storeId, session.openedAt, now, session.openingCash)
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
): RegisterBreakdown => {
  const start = new Date(session.openedAt).getTime()
  const end = new Date(endISO).getTime()

  const done = db.orders.filter((o) => {
    if (o.storeId !== session.storeId || o.status !== 'completed') return false
    const t = new Date(o.createdAt).getTime()
    return t >= start && t <= end
  })

  const byEmployee = new Map<string, { count: number; total: number }>()
  for (const o of done) {
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

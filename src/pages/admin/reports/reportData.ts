import { balanceFor } from '../../../lib/selectors'
import { dateKey, fmtDate, sum } from '../../../lib/utils'

export type Period = 'today' | 'week' | 'month' | 'year'

type AppDb = ReturnType<typeof import('../../../store/AppStore').useApp>['db']
type ReportOrder = AppDb['orders'][number]
type ReportStore = NonNullable<ReturnType<typeof import('../../../store/AppStore').useApp>['store']>

export function getRange(period: Period, now: Date) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === 'week') start.setDate(start.getDate() - 6)
  if (period === 'month') start.setDate(1)
  if (period === 'year') start.setMonth(0, 1)
  const label =
    period === 'today'
      ? `Today, ${fmtDate(now.toISOString())}`
      : period === 'week'
        ? `Last 7 days · ${fmtDate(start.toISOString())} – ${fmtDate(now.toISOString())}`
        : period === 'month'
          ? now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
          : `Year ${now.getFullYear()}`
  return { start, label }
}

export function buildSeries(period: Period, orders: ReportOrder[], now: Date) {
  if (period === 'today') {
    return Array.from({ length: 14 }, (_, i) => {
      const hour = 7 + i
      const value = sum(
        orders.filter((o) => new Date(o.createdAt).getHours() === hour),
        (o) => o.total,
      )
      return {
        label: `${String(hour).padStart(2, '0')}:00`,
        value: Math.round(value * 1000) / 1000,
        current: hour === now.getHours(),
      }
    })
  }
  if (period === 'week' || period === 'month') {
    const days = period === 'week' ? 7 : now.getDate()
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now)
      if (period === 'week') {
        d.setDate(d.getDate() - (days - 1 - i))
      } else {
        d.setDate(i + 1)
      }
      const key = dateKey(d)
      const value = sum(
        orders.filter((o) => dateKey(o.createdAt) === key),
        (o) => o.total,
      )
      return {
        label:
          period === 'week'
            ? d.toLocaleDateString('en-GB', { weekday: 'short' })
            : String(i + 1),
        value: Math.round(value * 1000) / 1000,
        current: key === dateKey(now),
      }
    })
  }
  return Array.from({ length: 12 }, (_, m) => {
    const value = sum(
      orders.filter((o) => {
        const d = new Date(o.createdAt)
        return d.getMonth() === m && d.getFullYear() === now.getFullYear()
      }),
      (o) => o.total,
    )
    return {
      label: new Date(now.getFullYear(), m, 1).toLocaleDateString('en-GB', { month: 'short' }),
      value: Math.round(value * 1000) / 1000,
      current: m === now.getMonth(),
    }
  })
}

export function createReportData(db: AppDb, store: ReportStore, period: Period, now: Date) {
  const { start, label } = getRange(period, now)
  const orders = db.orders.filter(
    (o) =>
      o.storeId === store.id &&
      o.status === 'completed' &&
      new Date(o.createdAt) >= start &&
      new Date(o.createdAt) <= now,
  )
  const sales = sum(orders, (o) => o.total)
  const expenses = sum(
    db.expenses.filter(
      (e) => e.storeId === store.id && new Date(e.date) >= start && new Date(e.date) <= now,
    ),
    (e) => e.amount,
  )
  const avgTicket = orders.length ? sales / orders.length : 0
  const series = buildSeries(period, orders, now)
  const seriesTotal = sum(series, (s) => s.value)

  const productStats = new Map<string, { name: string; qty: number; revenue: number }>()
  orders.forEach((o) =>
    o.items.forEach((i) => {
      const cur = productStats.get(i.productId) ?? { name: i.name, qty: 0, revenue: 0 }
      cur.qty += i.qty
      cur.revenue += i.qty * i.price
      productStats.set(i.productId, cur)
    }),
  )
  const topProducts = Array.from(productStats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8)

  const categoryStats = new Map<string, { name: string; revenue: number }>()
  orders.forEach((o) =>
    o.items.forEach((i) => {
      const product = db.products.find((p) => p.id === i.productId)
      const cat = db.categories.find((c) => c.id === product?.categoryId)
      const key = cat?.name ?? 'Other'
      const cur = categoryStats.get(key) ?? { name: key, revenue: 0 }
      cur.revenue += i.qty * i.price
      categoryStats.set(key, cur)
    }),
  )
  const categoryList = Array.from(categoryStats.values()).sort((a, b) => b.revenue - a.revenue)

  const staffStats = new Map<string, { name: string; orders: number; revenue: number }>()
  orders.forEach((o) => {
    const cur = staffStats.get(o.staffId) ?? { name: o.staffName, orders: 0, revenue: 0 }
    cur.orders += 1
    cur.revenue += o.total
    staffStats.set(o.staffId, cur)
  })
  const staffList = Array.from(staffStats.values()).sort((a, b) => b.revenue - a.revenue)

  const paymentMix = (['cash', 'card', 'credit'] as const).map((method) => {
    const list = orders.filter((o) => o.paymentMethod === method)
    return { name: method, value: sum(list, (o) => o.total), count: list.length }
  })
  const paymentTotal = Math.max(1, sum(paymentMix, (p) => p.value))
  const ledgerInRange = db.ledger.filter(
    (l) => l.storeId === store.id && new Date(l.createdAt) >= start && new Date(l.createdAt) <= now,
  )
  const charges = sum(ledgerInRange.filter((l) => l.type === 'charge'), (l) => l.amount)
  const settled = sum(
    ledgerInRange.filter((l) => l.type === 'payment' && !l.creditAdjustment),
    (l) => l.amount,
  )
  const outstanding = sum(
    db.customers.filter((c) => c.storeId === store.id),
    (c) => Math.max(0, balanceFor(db.ledger, c.id)),
  )
  const expenseByCategory = new Map<string, number>()
  db.expenses
    .filter((e) => e.storeId === store.id && new Date(e.date) >= start && new Date(e.date) <= now)
    .forEach((e) => expenseByCategory.set(e.category, (expenseByCategory.get(e.category) ?? 0) + e.amount))

  return {
    label,
    orders,
    sales,
    expenses,
    avgTicket,
    series,
    seriesTotal,
    topProducts,
    categoryList,
    staffList,
    paymentMix,
    paymentTotal,
    charges,
    settled,
    outstanding,
    expenseByCategory,
  }
}

export type ReportData = ReturnType<typeof createReportData>

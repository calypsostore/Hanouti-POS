import type { Database } from '../types'
import { round } from './pricing-utils'
import { orderPaidBy } from './shiftCash.ts'

export type StaffPerformancePeriod = 'today' | 'week' | 'month' | 'year'

export const getStaffPerformance = (
  db: Database,
  storeId: string,
  staffId: string,
  period: StaffPerformancePeriod,
  now = new Date(),
  tolerance = 0,
) => {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  } else if (period === 'month') {
    start.setDate(1)
  } else if (period === 'year') {
    start.setMonth(0, 1)
  }
  const startTime = start.getTime()
  const endTime = now.getTime()
  const inPeriod = (value: string | undefined) => {
    const time = value ? Date.parse(value) : Number.NaN
    return Number.isFinite(time) && time >= startTime && time <= endTime
  }
  const orders = db.orders.filter((order) =>
    order.storeId === storeId && orderPaidBy(order) === staffId && inPeriod(order.createdAt),
  )
  const completed = orders.filter((order) => order.status === 'completed')
  const voids = db.orders.filter((order) =>
    order.storeId === storeId && order.voidedById === staffId && inPeriod(order.voidedAt),
  )
  const sessions = db.registerSessions.filter((session) =>
    session.storeId === storeId && (session.staffId ?? session.openedById) === staffId && inPeriod(session.openedAt),
  )
  const closed = sessions.filter((session) => session.status === 'closed' && session.difference !== undefined)
  const sales = round(completed.reduce((total, order) => total + order.total, 0))
  const discounts = round(completed.reduce((total, order) => total + order.discount, 0))
  const gross = round(completed.reduce((total, order) => total + order.subtotal, 0))
  const accuracyCount = closed.filter((session) => Math.abs(round(session.difference ?? 0)) <= tolerance).length
  const cashAccuracy = closed.length === 0 ? 100 : round((accuracyCount / closed.length) * 100)
  const discountRate = gross > 0 ? round((discounts / gross) * 100) : 0
  const voidRate = orders.length > 0 ? round((voids.length / orders.length) * 100) : 0
  const tablesServed = completed.filter((order) => order.channel === 'dine-in' && (order.tableId || order.tableName)).length
  const shortage = round(closed.reduce((total, session) =>
    total + (session.difference !== undefined && session.difference < 0 ? Math.abs(session.difference) : 0), 0))
  const overage = round(closed.reduce((total, session) =>
    total + (session.difference !== undefined && session.difference > 0 ? session.difference : 0), 0))
  const status = cashAccuracy >= 98 && discountRate <= 5 && voidRate <= 2
    ? 'Excellent'
    : cashAccuracy >= 90 && discountRate <= 10 && voidRate <= 5
      ? 'Good'
      : 'Needs attention'
  return {
    shifts: sessions.length,
    sales,
    orders: completed.length,
    averageTicket: completed.length ? round(sales / completed.length) : 0,
    tablesServed,
    voids: voids.length,
    discountRate,
    cashAccuracy,
    shortage,
    overage,
    status,
  }
}

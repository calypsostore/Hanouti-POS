import type { Advance, Attendance, Database, Payroll, PayrollSettings } from '../types'
import { summarizeAttendanceDay } from './payroll'
import { round } from './pricing-utils'
import { dateKey } from './utils'

export function getStaffOverviewStats(db: Database, storeId: string, userId: string, now = new Date()) {
  const orders = db.orders.filter((order) => order.storeId === storeId && order.staffId === userId)
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthOrders = orders.filter((order) => order.createdAt.slice(0, 7) === month && order.status === 'completed')
  return {
    ordersHandled: orders.length,
    salesTotal: round(orders
      .filter((order) => order.status === 'completed')
      .reduce((total, order) => total + order.total, 0)),
    voids: orders.filter((order) => order.status === 'void').length,
    discountsThisMonth: round(monthOrders.reduce((total, order) => total + order.discount, 0)),
  }
}

export function getStaffSalesThisMonth(db: Database, storeId: string, userId: string, now = new Date()) {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return round(db.orders
    .filter((order) =>
      order.storeId === storeId && order.staffId === userId &&
      order.status === 'completed' && order.createdAt.slice(0, 7) === month,
    )
    .reduce((total, order) => total + order.total, 0))
}

export function getAttendanceMonth(
  records: Attendance[],
  settings: PayrollSettings,
  month: string,
) {
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`
    const summary = summarizeAttendanceDay(records, settings, date)
    if (!summary) return null
    const ordered = [...summary.records].sort((a, b) => a.clockIn.localeCompare(b.clockIn))
    return {
      date,
      status: summary.status,
      hours: summary.hours,
      source: ordered.some((record) => record.source === 'auto') ? 'auto' as const : 'manual' as const,
      clockIn: ordered[0]?.clockIn,
      clockOut: ordered.at(-1)?.clockOut ?? ordered.at(-1)?.lastSeen,
      note: ordered.map((record) => record.note).filter(Boolean).join(' · '),
    }
  }).filter((day): day is NonNullable<typeof day> => day !== null)
}

export function getAttendanceMonthSummary(
  records: ReturnType<typeof getAttendanceMonth>,
) {
  const fullDays = records.filter((day) => day.status === 'present').length
  const halfDays = records.filter((day) => day.status === 'half').length
  const absentDays = records.filter((day) => day.status === 'absent').length
  return {
    fullDays,
    halfDays,
    absentDays,
    daysWorked: round(fullDays + halfDays * 0.5),
    hours: round(records.reduce((total, day) => total + day.hours, 0)),
  }
}

export function getStaffPaymentTotals(payrolls: Payroll[], advances: Advance[]) {
  return {
    totalPaid: round(payrolls.reduce((total, payroll) => total + payroll.netPaid, 0)),
    outstandingAdvances: round(advances
      .filter((advance) => advance.status === 'open')
      .reduce((total, advance) => total + advance.amount, 0)),
  }
}

export function getStaffActivityLogs(db: Database, userId: string) {
  const attendanceIds = new Set(db.attendance.filter((entry) => entry.userId === userId).map((entry) => entry.id))
  const shiftIds = new Set(db.shifts.filter((shift) => shift.userId === userId).map((shift) => shift.id))
  const advanceIds = new Set(db.advances.filter((advance) => advance.userId === userId).map((advance) => advance.id))
  const payrollIds = new Set(db.payrolls.filter((payroll) => payroll.userId === userId).map((payroll) => payroll.id))
  return db.auditLogs.filter((log) => {
    if (log.userId === userId) return true
    if (log.entity === 'staff' && log.entityId === userId) return true
    if (log.entity === 'payroll' && (
      log.entityId !== undefined && (attendanceIds.has(log.entityId) || advanceIds.has(log.entityId) || payrollIds.has(log.entityId)) ||
      log.before?.userId === userId || log.after?.userId === userId
    )) return true
    return log.entity === 'shift' && (
      (!!log.entityId && shiftIds.has(log.entityId)) ||
      log.before?.userId === userId || log.after?.userId === userId
    )
  })
}

export function getWeekDates(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    return dateKey(current)
  })
}

export function shiftHours(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  return round((endHour * 60 + endMinute - startHour * 60 - startMinute) / 60)
}

export function getPlannedShiftHours(shifts: Array<Pick<Database['shifts'][number], 'startTime' | 'endTime'>>) {
  return round(shifts.reduce((total, shift) => total + shiftHours(shift.startTime, shift.endTime), 0))
}

export function addDays(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number)
  const current = new Date(year, month - 1, day)
  current.setDate(current.getDate() + amount)
  return dateKey(current)
}

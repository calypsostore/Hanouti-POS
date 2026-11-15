import type { Advance, Attendance, AttendanceStatus, Database, PayrollSettings, User } from '../types'
import { DEFAULT_PAYROLL_SETTINGS } from './defaults'
import { round } from './pricing-utils'
import { dateKey, uid } from './utils'
import { shouldTrackAttendance } from './staff'

export interface AttendanceDaySummary {
  date: string
  status: AttendanceStatus
  hours: number
  records: Attendance[]
}

export interface PayrollEstimate {
  daysWorked: number
  fullDays: number
  halfDays: number
  absentDays: number
  earned: number
  openAdvances: number
  netDue: number
}

export const cashDifferenceDeduction = (
  storeId: string,
  userId: string,
  amount: number,
  note: string,
  now = new Date(),
): Advance => ({
  id: uid('adv'),
  storeId,
  userId,
  amount: round(amount),
  date: now.toISOString(),
  note: `Cash difference deduction: ${note}`.slice(0, 500),
  status: 'open',
})

const hoursBetween = (start: string, end: string) => {
  const startTime = Date.parse(start)
  const endTime = Date.parse(end)
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0
  return Math.max(0, (endTime - startTime) / 3_600_000)
}

const statusForHours = (hours: number, settings: PayrollSettings): AttendanceStatus =>
  hours >= settings.fullDayHours ? 'present' : hours >= settings.halfDayHours ? 'half' : 'absent'

const attendanceEnd = (record: Attendance) => record.clockOut ?? record.lastSeen

const refreshStoreStatuses = (db: Database, storeId: string) => {
  const settings = db.stores.find((store) => store.id === storeId)?.settings.payroll ?? DEFAULT_PAYROLL_SETTINGS
  const totals = new Map<string, number>()
  for (const record of db.attendance) {
    if (record.storeId !== storeId) continue
    const key = `${record.userId}:${record.date}`
    totals.set(key, round((totals.get(key) ?? 0) + hoursBetween(record.clockIn, attendanceEnd(record))))
  }
  return db.attendance.map((record) => record.storeId === storeId
    ? {
        ...record,
        status: statusForHours(totals.get(`${record.userId}:${record.date}`) ?? 0, settings),
      }
    : record)
}

export function reconcileAttendance(db: Database, now = new Date()): Database {
  const today = dateKey(now)
  let attendance = db.attendance
  let changed = false
  for (const record of db.attendance) {
    if (record.clockOut) continue
    const settings = db.stores.find((store) => store.id === record.storeId)?.settings.payroll ?? DEFAULT_PAYROLL_SETTINGS
    const lastSeenTime = Date.parse(record.lastSeen)
    const shouldClose = record.date !== today ||
      (Number.isFinite(lastSeenTime) && now.getTime() - lastSeenTime >= settings.autoCloseHours * 3_600_000)
    if (!shouldClose) continue
    if (!changed) attendance = [...db.attendance]
    changed = true
    const index = attendance.findIndex((entry) => entry.id === record.id)
    if (index >= 0) {
      attendance[index] = {
        ...record,
        clockOut: Number.isFinite(lastSeenTime) ? record.lastSeen : record.clockIn,
      }
    }
  }
  if (!changed) return db
  const next = { ...db, attendance }
  return {
    ...next,
    attendance: Array.from(
      new Set(attendance.map((record) => record.storeId)),
    ).reduce((records, storeId) => refreshStoreStatuses({ ...next, attendance: records }, storeId), attendance),
  }
}

export function clockInAttendance(db: Database, user: User, now = new Date()): Database {
  if (!shouldTrackAttendance(user) || !user.storeId) return db
  const reconciled = reconcileAttendance(db, now)
  const timestamp = now.toISOString()
  const today = dateKey(now)
  const open = reconciled.attendance.find((record) =>
    record.storeId === user.storeId && record.userId === user.id &&
    record.date === today && !record.clockOut,
  )
  const attendance = open
    ? reconciled.attendance.map((record) => record.id === open.id
        ? { ...record, lastSeen: timestamp }
        : record)
    : [{
        id: uid('att'),
        storeId: user.storeId,
        userId: user.id,
        date: today,
        clockIn: timestamp,
        lastSeen: timestamp,
        status: 'absent' as const,
        source: 'auto' as const,
      }, ...reconciled.attendance]
  return {
    ...reconciled,
    attendance: refreshStoreStatuses({ ...reconciled, attendance }, user.storeId),
  }
}

export function clockOutAttendance(db: Database, user: User, now = new Date()): Database {
  if (!shouldTrackAttendance(user) || !user.storeId) return db
  const reconciled = reconcileAttendance(db, now)
  const timestamp = now.toISOString()
  const today = dateKey(now)
  let changed = false
  const attendance = reconciled.attendance.map((record) => {
    if (record.storeId !== user.storeId || record.userId !== user.id || record.clockOut) return record
    changed = true
    return {
      ...record,
      clockOut: record.date === today ? timestamp : record.lastSeen,
      lastSeen: record.date === today ? timestamp : record.lastSeen,
    }
  })
  if (!changed) return reconciled
  return {
    ...reconciled,
    attendance: refreshStoreStatuses({ ...reconciled, attendance }, user.storeId),
  }
}

export function heartbeatAttendance(db: Database, userId: string, now = new Date()): Database {
  const reconciled = reconcileAttendance(db, now)
  const user = reconciled.users.find((candidate) => candidate.id === userId && candidate.active)
  if (!user || !shouldTrackAttendance(user) || !user.storeId) return reconciled
  return clockInAttendance(reconciled, user, now)
}

export function summarizeAttendanceDay(
  records: Attendance[],
  settings: PayrollSettings,
  date: string,
): AttendanceDaySummary | null {
  const dayRecords = records.filter((record) => record.date === date)
  if (!dayRecords.length) return null
  const hours = round(dayRecords.reduce(
    (total, record) => total + hoursBetween(record.clockIn, attendanceEnd(record)),
    0,
  ))
  return { date, hours, status: statusForHours(hours, settings), records: dayRecords }
}

export function estimatePayroll(
  user: User,
  records: Attendance[],
  openAdvanceAmounts: number[],
  settings: PayrollSettings,
  month: string,
): PayrollEstimate {
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const days = new Map<string, AttendanceDaySummary>()
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    const summary = summarizeAttendanceDay(records, settings, date)
    if (summary) days.set(date, summary)
  }
  const fullDays = Array.from(days.values()).filter((day) => day.status === 'present').length
  const halfDays = Array.from(days.values()).filter((day) => day.status === 'half').length
  const absentDays = Array.from(days.values()).filter((day) => day.status === 'absent').length
  const daysWorked = round(fullDays + halfDays * 0.5)
  const earned = user.salaryType === 'daily'
    ? round(daysWorked * user.salaryAmount)
    : user.salaryType === 'monthly'
      ? round(Math.min(user.salaryAmount, user.salaryAmount / settings.workingDaysPerMonth * daysWorked))
      : 0
  const openAdvances = round(openAdvanceAmounts.reduce((total, amount) => total + amount, 0))
  const netDue = round(Math.max(0, earned - openAdvances))
  return { daysWorked, fullDays, halfDays, absentDays, earned, openAdvances, netDue }
}

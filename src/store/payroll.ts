import { useCallback } from 'react'
import type {
  Advance, Attendance, Expense, Payroll, PayrollSettings, Store,
} from '../types'
import { round } from '../lib/pricing-utils'
import { dateKey, uid } from '../lib/utils'
import { addLog } from './audit'
import type { AddAdvanceInput, AppContextValue, ManualAttendanceInput } from './types'
import type { StoreSliceDependencies } from './sliceTypes'
import {
  estimatePayroll,
  heartbeatAttendance,
  reconcileAttendance,
  summarizeAttendanceDay,
} from '../lib/payroll'

const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) && dateKey(date) === value
}

const expenseDate = (date: string, now: Date) => date === dateKey(now)
  ? now.toISOString()
  : new Date(`${date}T12:00:00`).toISOString()

const attendanceSnapshot = (records: Attendance[], settings: PayrollSettings, date: string) => {
  const summary = summarizeAttendanceDay(records, settings, date)
  return summary
    ? {
        date,
        status: summary.status,
        hours: summary.hours,
        sessions: summary.records.length,
        source: summary.records.some((record) => record.source === 'auto') ? 'auto' : 'manual',
        note: summary.records.map((record) => record.note).filter(Boolean).join('; ').slice(0, 200),
      }
    : { date, status: 'absent', hours: 0, sessions: 0, source: 'none', note: '' }
}

export function usePayrollSlice({ dbRef, commitDb, requireCapability }: StoreSliceDependencies) {
  const addAdvance = useCallback<AppContextValue['addAdvance']>((storeId, userId, data: AddAdvanceInput) => {
    const actorResult = requireCapability(storeId, 'managePayroll')
    if (!actorResult.ok) return actorResult
    const staff = dbRef.current.users.find((candidate) =>
      candidate.id === userId && candidate.storeId === storeId && candidate.role === 'staff',
    )
    if (!staff) return { ok: false, error: 'Staff member not found in this store.' }
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      return { ok: false, error: 'Enter an advance amount greater than zero.' }
    }
    if (!isValidDate(data.date)) return { ok: false, error: 'Choose a valid advance date.' }
    const amount = round(data.amount)
    if (amount <= 0) return { ok: false, error: 'Enter an advance amount greater than zero.' }
    const now = new Date()
    const advance: Advance = {
      id: uid('adv'),
      storeId,
      userId,
      amount,
      date: expenseDate(data.date, now),
      note: data.note.trim().slice(0, 500),
      status: 'open',
    }
    const expense: Expense = {
      id: uid('exp'),
      storeId,
      category: 'Salary advance',
      note: `Salary advance for ${staff.name}`,
      amount,
      date: expenseDate(data.date, now),
      createdAt: now.toISOString(),
      createdBy: actorResult.actor.id,
    }
    commitDb((prev) => {
      let next = {
        ...prev,
        advances: [advance, ...prev.advances],
        expenses: [expense, ...prev.expenses],
      }
      next = addLog(next, actorResult.actor, {
        storeId,
        action: 'created',
        entity: 'payroll',
        entityId: advance.id,
        summary: `Gave ${staff.name} a salary advance of ${amount.toFixed(3)} DT`,
        after: { userId, amount, date: data.date, status: advance.status, noteAdded: Boolean(advance.note) },
      })
      return addLog(next, actorResult.actor, {
        storeId,
        action: 'created',
        entity: 'expense',
        entityId: expense.id,
        summary: `Recorded Salary advance expense of ${amount.toFixed(3)} DT`,
        after: { category: expense.category, amount, date: data.date, staffId: userId },
      })
    })
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const paySalary = useCallback<AppContextValue['paySalary']>((storeId, userId, month) => {
    const actorResult = requireCapability(storeId, 'managePayroll')
    if (!actorResult.ok) return actorResult
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, error: 'Choose a valid payroll month.' }
    const current = dbRef.current
    const staff = current.users.find((candidate) =>
      candidate.id === userId && candidate.storeId === storeId && candidate.role === 'staff',
    )
    if (!staff) return { ok: false, error: 'Staff member not found in this store.' }
    if (current.payrolls.some((payroll) =>
      payroll.storeId === storeId && payroll.userId === userId && payroll.month === month,
    )) return { ok: false, error: 'This month’s salary has already been paid.' }
    const store = current.stores.find((candidate) => candidate.id === storeId)
    const payrollSettings = getPayrollSettings(store)
    if (!payrollSettings) return { ok: false, error: 'Payroll settings are unavailable for this store.' }
    const openAdvances = current.advances.filter((advance) =>
      advance.storeId === storeId && advance.userId === userId && advance.status === 'open',
    )
    const estimate = estimatePayroll(
      staff,
      current.attendance.filter((record) => record.storeId === storeId && record.userId === userId),
      openAdvances.map((advance) => advance.amount),
      payrollSettings,
      month,
    )
    if (staff.salaryType === 'none' || estimate.earned <= 0) {
      return { ok: false, error: 'Set a salary and record attendance before paying this month.' }
    }
    if (estimate.openAdvances > estimate.earned) {
      return { ok: false, error: 'Open advances exceed earned salary; this payroll cannot be settled yet.' }
    }
    const latestActor = requireCapability(storeId, 'managePayroll')
    if (!latestActor.ok) return latestActor
    const paidAt = new Date()
    const payrollId = uid('pay')
    const payroll: Payroll = {
      id: payrollId,
      storeId,
      userId,
      month,
      daysWorked: estimate.daysWorked,
      earned: estimate.earned,
      advancesDeducted: estimate.openAdvances,
      netPaid: estimate.netDue,
      paidAt: paidAt.toISOString(),
      paidBy: latestActor.actor.id,
    }
    const expense: Expense | null = estimate.netDue > 0
      ? {
          id: uid('exp'),
          storeId,
          category: 'Salaries',
          note: `Salary for ${staff.name} — ${month}`,
          amount: estimate.netDue,
          date: paidAt.toISOString(),
          createdAt: paidAt.toISOString(),
          createdBy: latestActor.actor.id,
        }
      : null
    commitDb((prev) => {
      if (prev.payrolls.some((entry) =>
        entry.storeId === storeId && entry.userId === userId && entry.month === month,
      )) return prev
      let next = {
        ...prev,
        payrolls: [payroll, ...prev.payrolls],
        advances: prev.advances.map((advance) =>
          openAdvances.some((open) => open.id === advance.id)
            ? { ...advance, status: 'deducted' as const, payrollId }
            : advance,
        ),
        expenses: expense ? [expense, ...prev.expenses] : prev.expenses,
      }
      next = addLog(next, latestActor.actor, {
        storeId,
        action: 'created',
        entity: 'payroll',
        entityId: payroll.id,
        summary: `Paid ${staff.name} ${month} salary: ${estimate.netDue.toFixed(3)} DT net`,
        after: {
          userId,
          month,
          daysWorked: estimate.daysWorked,
          earned: estimate.earned,
          advancesDeducted: estimate.openAdvances,
          netPaid: estimate.netDue,
        },
      })
      if (!expense) return next
      return addLog(next, latestActor.actor, {
        storeId,
        action: 'created',
        entity: 'expense',
        entityId: expense.id,
        summary: `Recorded Salaries expense of ${expense.amount.toFixed(3)} DT`,
        after: { category: expense.category, amount: expense.amount, date: expense.date, staffId: userId },
      })
    })
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const saveManualAttendance = useCallback<AppContextValue['saveManualAttendance']>((
    storeId,
    userId,
    data: ManualAttendanceInput,
  ) => {
    const actorResult = requireCapability(storeId, 'managePayroll')
    if (!actorResult.ok) return actorResult
    const staff = dbRef.current.users.find((candidate) =>
      candidate.id === userId && candidate.storeId === storeId && candidate.role === 'staff',
    )
    if (!staff) return { ok: false, error: 'Staff member not found in this store.' }
    if (!isValidDate(data.date) || data.date > dateKey(new Date())) {
      return { ok: false, error: 'Choose a valid date that is not in the future.' }
    }
    if (!['present', 'half', 'absent'].includes(data.status)) {
      return { ok: false, error: 'Choose a valid attendance status.' }
    }
    const current = dbRef.current
    const store = current.stores.find((candidate) => candidate.id === storeId)
    const settings = getPayrollSettings(store)
    if (!settings) return { ok: false, error: 'Payroll settings are unavailable for this store.' }
    const dayRecords = current.attendance.filter((record) =>
      record.storeId === storeId && record.userId === userId && record.date === data.date,
    )
    if (current.payrolls.some((payroll) =>
      payroll.storeId === storeId && payroll.userId === userId && payroll.month === data.date.slice(0, 7),
    )) return { ok: false, error: 'Attendance cannot be changed after this month’s payroll is paid.' }
    if (dayRecords.some((record) => !record.clockOut)) {
      return { ok: false, error: 'Clock out the active shift before editing this attendance day.' }
    }
    const clockIn = data.status === 'absent'
      ? new Date(`${data.date}T12:00:00`)
      : parseLocalTime(data.date, data.clockIn)
    const clockOut = data.status === 'absent'
      ? clockIn
      : parseLocalTime(data.date, data.clockOut)
    if (!clockIn || !clockOut || !Number.isFinite(clockIn.getTime()) || !Number.isFinite(clockOut.getTime())) {
      return { ok: false, error: 'Enter valid clock-in and clock-out times.' }
    }
    const entry: Attendance = {
      id: dayRecords[0]?.id ?? uid('att'),
      storeId,
      userId,
      date: data.date,
      clockIn: clockIn.toISOString(),
      clockOut: clockOut.toISOString(),
      lastSeen: clockOut.toISOString(),
      status: data.status,
      source: 'manual',
      note: data.note?.trim().slice(0, 500) || undefined,
    }
    const summary = summarizeAttendanceDay([entry], settings, data.date)
    if (summary?.status !== data.status) {
      return {
        ok: false,
        error: `Those times do not match ${data.status} attendance. Check this store’s full-day and half-day hour settings.`,
      }
    }
    const before = attendanceSnapshot(dayRecords, settings, data.date)
    const after = attendanceSnapshot([entry], settings, data.date)
    commitDb((prev) => {
      const attendance = [
        entry,
        ...prev.attendance.filter((record) =>
          record.storeId !== storeId || record.userId !== userId || record.date !== data.date,
        ),
      ]
      return addLog({ ...prev, attendance }, actorResult.actor, {
        storeId,
        action: 'edited',
        entity: 'payroll',
        entityId: entry.id,
        summary: `Manually edited attendance for ${staff.name} on ${data.date}`,
        before,
        after,
      })
    })
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const heartbeat = useCallback((userId: string) => {
    commitDb((prev) => heartbeatAttendance(prev, userId))
  }, [commitDb])

  const reconcile = useCallback(() => {
    commitDb((prev) => reconcileAttendance(prev))
  }, [commitDb])

  return { addAdvance, paySalary, saveManualAttendance, heartbeatAttendance: heartbeat, reconcileAttendance: reconcile }
}

const getPayrollSettings = (store: Store | undefined) => {
  return store?.settings.payroll
}

const parseLocalTime = (date: string, time?: string) => {
  if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined
  const parsed = new Date(`${date}T${time}:00`)
  return Number.isFinite(parsed.getTime()) ? parsed : undefined
}

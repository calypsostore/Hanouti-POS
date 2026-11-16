import { useCallback } from 'react'
import type { CashDifferenceResolution, RegisterDayReport, RegisterSession } from '../types'
import { round } from '../lib/pricing-utils'
import { dateKey, uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import { computeRegisterTotals, registerReportDetails } from '../lib/reports'
import { can } from '../lib/permissions'
import { nextShiftNumber, openShiftForStaff } from '../lib/registerShifts'
import { addLog } from './audit'
import { isCashDifferenceWithinTolerance, shiftCashDifference } from '../lib/shiftCash'
import { cashDifferenceDeduction } from '../lib/payroll'
import { clearManualAvailability } from './availabilityMaintenance'
import { shiftOpenScheduleError } from '../lib/shiftAccess'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

export function useRegisterSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireActor, requireCapability } = dependencies
  const openRegister = useCallback<AppContextValue['openRegister']>(
    (storeId, openingCash) => {
      const actorResult = requireActor(storeId, true)
      if (!actorResult.ok) return actorResult
      const actor = actorResult.actor
      if (!can(actor, 'openShift')) {
        return { ok: false, error: 'You do not have permission to open a shift.' }
      }
      if (dbRef.current.registerDayReports.some((report) =>
        report.storeId === storeId && report.date === dateKey(new Date()),
      )) {
        return { ok: false, error: 'The store day is closed. Open a new shift on the next business day.' }
      }
      if (!Number.isFinite(openingCash) || openingCash < 0) {
        return { ok: false, error: 'Enter a valid opening cash amount.' }
      }
      if (openShiftForStaff(dbRef.current, storeId, actor.id)) {
        return { ok: false, error: 'You already have an open shift for this store.' }
      }
      const store = dbRef.current.stores.find((candidate) => candidate.id === storeId)
      if (!store) return { ok: false, error: 'Store not found.' }
      if (actor.role === 'staff' && !actor.stationOnly) {
        const scheduleError = shiftOpenScheduleError(
          store.settings.shiftAccess,
          dbRef.current.shifts,
          storeId,
          actor.id,
          new Date(),
        )
        if (scheduleError) {
          commitDb((prev) => addLog(prev, actor, {
            storeId,
            action: 'shift_access_denied',
            entity: 'register',
            summary: `Blocked shift opening: ${scheduleError}`,
          }))
          return { ok: false, error: scheduleError }
        }
      }
      const session: RegisterSession = {
        id: uid('reg'),
        storeId,
        status: 'open',
        openedAt: new Date().toISOString(),
        openedById: actor.id,
        openedByName: actor.name,
        staffId: actor.id,
        shiftNumber: nextShiftNumber(dbRef.current.registerSessions, storeId),
        openingCash: round(openingCash),
        openingFloat: round(openingCash),
      }
      const firstShiftToday = !dbRef.current.registerSessions.some((candidate) =>
        candidate.storeId === storeId && dateKey(candidate.openedAt) === dateKey(session.openedAt),
      )
      commitDb((prev) => {
        let next = { ...prev, registerSessions: [...prev.registerSessions, session] }
        if (firstShiftToday && store?.settings.availability.resetManualAtFirstShift) {
          next = clearManualAvailability(next, storeId, actor)
        }
        return addLog(next, actor, {
        storeId,
        action: 'register_opened',
        entity: 'register',
        entityId: session.id,
        summary: `Opened shift ${session.shiftNumber} with ${session.openingCash.toFixed(3)} DT opening cash`,
        after: { openingCash: session.openingCash },
        })
      })
      return { ok: true }
    },
    [commitDb, dbRef, requireActor],
  )

  const closeRegister = useCallback<AppContextValue['closeRegister']>(
    (sessionId, countedCash, note, forceReason, leaveFloatForNextShift) => {
      const current = dbRef.current
      const session = current.registerSessions.find((s) => s.id === sessionId)
      if (!session) return { ok: false, error: 'Register session not found.' }
      const actorResult = requireActor(session.storeId)
      if (!actorResult.ok) return actorResult
      const actor = actorResult.actor
      if (session.status !== 'open') {
        return { ok: false, error: 'This session was already closed and cannot change.' }
      }
      const isOwner = (session.staffId ?? session.openedById) === actor.id
      if (isOwner && !can(actor, 'closeShift')) {
        return { ok: false, error: 'You do not have permission to close your shift.' }
      }
      if (!isOwner && (!can(actor, 'forceCloseShift') || !forceReason?.trim())) {
        return { ok: false, error: 'Force-closing another shift requires permission and a reason.' }
      }
      if (!Number.isFinite(countedCash) || countedCash < 0) {
        return { ok: false, error: 'Enter the cash you counted in the drawer.' }
      }

      // The closed shift snapshot stays fixed; the store-day Z is closed separately by an admin.
      const closedAt = new Date().toISOString()
      const snapshot = computeRegisterTotals(
        current,
        session.storeId,
        session.openedAt,
        closedAt,
        session.openingFloat ?? session.openingCash,
        session.id,
      )
      const counted = round(countedCash)

      const store = current.stores.find((candidate) => candidate.id === session.storeId)
      const difference = store?.settings.posMode === 'quick'
        ? 0
        : shiftCashDifference(counted, snapshot.expectedCash)
      const tolerance = store?.settings.automation.cashDifferenceTolerance ?? 0
      const cashDifference = !isCashDifferenceWithinTolerance(difference, tolerance)
        ? {
            id: uid('cashdiff'),
            storeId: session.storeId,
            staffId: session.staffId ?? session.openedById,
            shiftId: session.id,
            amount: difference,
            type: difference < 0 ? 'shortage' as const : 'overage' as const,
            status: 'open' as const,
            createdAt: new Date().toISOString(),
          }
        : undefined
      const reportDetails = registerReportDetails(current, session, closedAt)
      commitDb((prev) => {
        const closed = addLog({
        ...prev,
        cashDifferences: cashDifference ? [cashDifference, ...prev.cashDifferences] : prev.cashDifferences,
        registerSessions: prev.registerSessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                status: 'closed' as const,
                closeType: 'shift' as const,
                closedAt,
                closedById: actor.id,
                closedByName: actor.name,
                countedCash: counted,
                difference,
                leaveFloatForNextShift: leaveFloatForNextShift === true,
                note: [forceReason?.trim(), note?.trim()].filter(Boolean).join(' · ') || undefined,
                snapshot,
                reportDetails,
              }
            : s,
        ),
      }, actor, {
        storeId: session.storeId,
        action: 'register_closed',
        entity: 'register',
        entityId: session.id,
        summary: `${isOwner ? 'Closed' : 'Force-closed'} shift ${session.shiftNumber ?? ''} with ${counted.toFixed(3)} DT counted cash (difference ${difference.toFixed(3)} DT)`,
        after: { countedCash: counted, difference, expectedCash: snapshot.expectedCash, forceReason: forceReason?.trim() ?? '' },
        })
        return cashDifference
          ? addLog(closed, actor, {
              storeId: session.storeId,
              action: 'created',
              entity: 'cash_difference',
              entityId: cashDifference.id,
              summary: `Recorded ${cashDifference.type} of ${Math.abs(difference).toFixed(3)} DT for ${session.staffId ?? session.openedByName}`,
              after: { staffId: cashDifference.staffId, shiftId: session.id, amount: difference, type: cashDifference.type },
            })
          : closed
      })
      return { ok: true }
    },
    [commitDb, dbRef, requireActor],
  )

  const closeRegisterDay = useCallback<AppContextValue['closeRegisterDay']>((storeId, staffFloat, countedCash, note) => {
    const actorResult = requireActor(storeId)
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    if (actor.role !== 'admin') return { ok: false, error: 'Only the owner can close the store-day Z report.' }
    if (!Number.isFinite(staffFloat) || staffFloat < 0) {
      return { ok: false, error: 'Enter the staff working float for this store day.' }
    }
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return { ok: false, error: 'Enter the cash counted at day end.' }
    }

    const current = dbRef.current
    const day = dateKey(new Date())
    if (current.registerDayReports.some((report) => report.storeId === storeId && report.date === day)) {
      return { ok: false, error: 'The store-day Z report has already been closed.' }
    }
    if (current.registerSessions.some((session) => session.storeId === storeId && session.status === 'open')) {
      return { ok: false, error: 'Close or hand over every staff shift before closing the day.' }
    }
    const daySessions = current.registerSessions.filter((session) =>
      session.storeId === storeId && dateKey(session.openedAt) === day,
    )
    if (!daySessions.length) return { ok: false, error: 'There are no register shifts to close for today.' }

    const closedAt = new Date().toISOString()
    const startISO = new Date(`${day}T00:00:00`).toISOString()
    const openingCash = round(staffFloat)
    const daySession: RegisterSession = {
      id: '',
      storeId,
      status: 'open',
      openedAt: startISO,
      openedById: actor.id,
      openedByName: actor.name,
      openingCash,
      openingFloat: openingCash,
    }
    const snapshot = computeRegisterTotals(current, storeId, startISO, closedAt, openingCash)
    const reportDetails = registerReportDetails(current, daySession, closedAt)
    const counted = round(countedCash)
    const store = current.stores.find((candidate) => candidate.id === storeId)
    const difference = store?.settings.posMode === 'quick'
      ? 0
      : shiftCashDifference(counted, snapshot.expectedCash)
    const zReportNumber = Math.max(
      ...current.registerDayReports.filter((report) => report.storeId === storeId).map((report) => report.zReportNumber),
      ...current.registerSessions.filter((session) => session.storeId === storeId)
        .map((session) => session.zReportNumber ?? 0),
      0,
    ) + 1
    const report: RegisterDayReport = {
      id: uid('regday'),
      storeId,
      date: day,
      closedAt,
      closedById: actor.id,
      closedByName: actor.name,
      zReportNumber,
      openingCash,
      countedCash: counted,
      difference,
      note: note?.trim().slice(0, 500) || undefined,
      snapshot,
      reportDetails,
    }
    commitDb((prev) => addLog({
      ...prev,
      registerDayReports: [...prev.registerDayReports, report],
    }, actor, {
      storeId,
      action: 'register_closed',
      entity: 'register',
      entityId: report.id,
      summary: `Closed store-day Z-${String(zReportNumber).padStart(6, '0')} for ${day}`,
      after: {
        date: day,
        staffFloat: openingCash,
        countedCash: counted,
        difference,
        expectedCash: snapshot.expectedCash,
      },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const resolveCashDifference = useCallback<AppContextValue['resolveCashDifference']>((
    id,
    resolution: CashDifferenceResolution,
    note,
  ) => {
    const difference = dbRef.current.cashDifferences.find((item) => item.id === id)
    if (!difference) return { ok: false, error: 'Cash difference not found.' }
    const actorResult = requireCapability(difference.storeId, 'manageCashDifferences')
    if (!actorResult.ok) return actorResult
    if (difference.status !== 'open') return { ok: false, error: 'Only open cash differences can be settled.' }
    if (!['paid_back', 'salary_deduction', 'waived', 'other'].includes(resolution)) {
      return { ok: false, error: 'Choose a valid cash difference resolution.' }
    }
    if (resolution === 'salary_deduction' && difference.amount > 0) {
      return { ok: false, error: 'Only a shortage can be deducted from salary.' }
    }
    const staff = dbRef.current.users.find((item) =>
      item.id === difference.staffId && item.storeId === difference.storeId && item.role === 'staff',
    )
    if (!staff) return { ok: false, error: 'The staff member for this difference no longer exists.' }
    const at = new Date()
    const advance = resolution === 'salary_deduction'
      ? cashDifferenceDeduction(difference.storeId, difference.staffId, Math.abs(difference.amount), note?.trim() || difference.id, at)
      : undefined
    commitDb((prev) => {
      const updated = {
        ...prev,
        cashDifferences: prev.cashDifferences.map((item) => item.id === id
          ? { ...item, status: 'settled' as const, resolvedAt: at.toISOString(), resolvedById: actorResult.actor.id, resolution, note: note?.trim().slice(0, 500) || undefined }
          : item),
        advances: advance ? [advance, ...prev.advances] : prev.advances,
      }
      return addLog(updated, actorResult.actor, {
        storeId: difference.storeId,
        action: 'cash_difference_resolved',
        entity: 'cash_difference',
        entityId: difference.id,
        summary: `Resolved ${difference.type} of ${Math.abs(difference.amount).toFixed(3)} DT (${resolution})`,
        before: { status: difference.status },
        after: { status: 'settled', resolution, note: note?.trim() ?? '', advanceId: advance?.id ?? '' },
      })
    })
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const voidCashDifference = useCallback<AppContextValue['voidCashDifference']>((id, reason) => {
    const difference = dbRef.current.cashDifferences.find((item) => item.id === id)
    if (!difference) return { ok: false, error: 'Cash difference not found.' }
    const actorResult = requireCapability(difference.storeId, 'manageCashDifferences')
    if (!actorResult.ok) return actorResult
    const normalizedReason = reason.trim().slice(0, 500)
    if (!normalizedReason) return { ok: false, error: 'A reason is required to void a cash difference.' }
    if (difference.status !== 'open') return { ok: false, error: 'Only open cash differences can be voided.' }
    const at = new Date().toISOString()
    commitDb((prev) => addLog({
      ...prev,
      cashDifferences: prev.cashDifferences.map((item) => item.id === id
        ? { ...item, status: 'voided' as const, resolvedAt: at, resolvedById: actorResult.actor.id, resolution: 'error_voided' as const, note: normalizedReason }
        : item),
    }, actorResult.actor, {
      storeId: difference.storeId,
      action: 'cash_difference_voided',
      entity: 'cash_difference',
      entityId: difference.id,
      summary: `Voided cash difference: ${normalizedReason}`,
      before: { status: difference.status },
      after: { status: 'voided', reason: normalizedReason },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const archiveCashDifference = useCallback<AppContextValue['archiveCashDifference']>((id) => {
    const difference = dbRef.current.cashDifferences.find((item) => item.id === id)
    if (!difference) return { ok: false, error: 'Cash difference not found.' }
    const actorResult = requireCapability(difference.storeId, 'manageCashDifferences')
    if (!actorResult.ok) return actorResult
    if (difference.status === 'archived') return { ok: false, error: 'This cash difference is already archived.' }
    const archivedFromStatus: 'open' | 'settled' | 'voided' = difference.status
    commitDb((prev) => addLog({
      ...prev,
      cashDifferences: prev.cashDifferences.map((item) => item.id === id
        ? { ...item, status: 'archived' as const, archivedFromStatus }
        : item),
    }, actorResult.actor, {
      storeId: difference.storeId,
      action: 'cash_difference_archived',
      entity: 'cash_difference',
      entityId: difference.id,
      summary: `Archived ${difference.type} of ${Math.abs(difference.amount).toFixed(3)} DT`,
      before: { status: difference.status },
      after: { status: 'archived' },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const restoreCashDifference = useCallback<AppContextValue['restoreCashDifference']>((id) => {
    const difference = dbRef.current.cashDifferences.find((item) => item.id === id)
    if (!difference) return { ok: false, error: 'Cash difference not found.' }
    const actorResult = requireCapability(difference.storeId, 'manageCashDifferences')
    if (!actorResult.ok) return actorResult
    if (actorResult.actor.role !== 'admin') return { ok: false, error: 'Only an admin can restore archived cash differences.' }
    if (difference.status === 'open') return { ok: false, error: 'This cash difference is already open.' }
    const status = difference.status === 'archived' ? difference.archivedFromStatus ?? 'open' : 'open'
    commitDb((prev) => addLog({
      ...prev,
      cashDifferences: prev.cashDifferences.map((item) => item.id === id
        ? { ...item, status, archivedFromStatus: undefined }
        : item),
    }, actorResult.actor, {
      storeId: difference.storeId,
      action: 'cash_difference_restored',
      entity: 'cash_difference',
      entityId: difference.id,
      summary: `Restored archived cash difference to ${status}`,
      before: { status: 'archived' },
      after: { status },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const settleCredit = useCallback<AppContextValue['settleCredit']>(
    (customerId, amount, method, note) => {
      const current = dbRef.current
      const customer = current.customers.find((c) => c.id === customerId)
      if (!customer) return { ok: false, error: 'Customer not found.' }
      const actorResult = requireActor(customer.storeId)
      if (!actorResult.ok) return actorResult
      const actor = actorResult.actor
      if (actor.role !== 'admin' && !actor.permissions.settle) {
        return { ok: false, error: 'You do not have permission to record payments.' }
      }
      const balance = balanceFor(current.ledger, customerId)
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.' }
      if (amount > balance + 0.0001) {
        return { ok: false, error: `Amount exceeds the outstanding balance (${balance.toFixed(3)} DT).` }
      }
      const remainingBalance = round(balance - amount)
      const shift = openShiftForStaff(current, customer.storeId, actor.id)
      commitDb((prev) => addLog({
        ...prev,
        ledger: [
          {
            id: uid('led'),
            storeId: customer.storeId,
            customerId,
            type: 'payment',
            amount: round(amount),
            method,
            note: note || 'Tab settlement',
            staffName: actor.name,
            shiftId: shift?.id,
            createdAt: new Date().toISOString(),
          },
          ...prev.ledger,
        ],
      }, actor, {
        storeId: customer.storeId,
        action: 'debt_payment',
        entity: 'customer',
        entityId: customerId,
        summary: `${amount.toFixed(3)} DT tab payment recorded for ${customer.name}`,
        before: { balance },
        after: { amount: round(amount), method, balance: remainingBalance },
      }))
      return { ok: true }
    },
    [commitDb, dbRef, requireActor],
  )


  return {
    openRegister,
    closeRegister,
    closeRegisterDay,
    settleCredit,
    resolveCashDifference,
    voidCashDifference,
    archiveCashDifference,
    restoreCashDifference,
  }
}

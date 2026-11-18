import { useCallback } from 'react'
import type { CashDifferenceResolution, RegisterDayReport, RegisterSession } from '../types'
import { round } from '../lib/pricing-utils'
import { dateKey, uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import { autoCloseRegisterSessionForZ, computeRegisterTotals, registerReportDetails } from '../lib/reports'
import { can } from '../lib/permissions'
import {
  ensureShiftForActor,
  hasOpenShiftsRequiringManualClose,
  isPrivilegedAutoShift,
  nextShiftNumber,
  openShiftForStaff,
} from '../lib/registerShifts'
import { addLog } from './audit'
import { withEnsuredShift } from './registerShiftHelpers'
import { isCashDifferenceWithinTolerance, shiftCashDifference } from '../lib/shiftCash'
import { cashDifferenceDeduction } from '../lib/payroll'
import { clearManualAvailability } from './availabilityMaintenance'
import { shiftOpenScheduleError } from '../lib/shiftAccess'
import { isQuick } from '../lib/posMode'
import { canSettleCustomerTabs } from '../lib/customerTabs'
import { calculateQuickDayClose, calculateQuickShiftClose } from '../lib/quickShifts'
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
      if (isQuick(store) && actor.role !== 'admin' && !store.settings.allowQuickOpeningFloatEdit) {
        const previousShift = dbRef.current.registerSessions
          .filter((session) => session.storeId === storeId && session.status === 'closed')
          .sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt))[0]
        const expectedFloat = previousShift?.openingFloat ?? previousShift?.openingCash ?? 0
        if (round(openingCash) !== round(expectedFloat)) {
          return { ok: false, error: 'The opening float is locked to the previous shift. Ask the owner to allow staff edits.' }
        }
      }
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
    (sessionId, countedCash, note, forceReason, leaveFloatForNextShift, expectedSales) => {
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
      if (expectedSales !== undefined && (!Number.isFinite(expectedSales) || expectedSales < 0)) {
        return { ok: false, error: 'Enter a valid expected sales amount or leave it blank.' }
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
      const quickClose = store && isQuick(store)
        ? calculateQuickShiftClose(
            session.openingFloat ?? session.openingCash,
            counted,
            expectedSales === undefined ? undefined : round(expectedSales),
          )
        : undefined
      const difference = quickClose?.difference ?? shiftCashDifference(counted, snapshot.expectedCash)
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
                declaredSales: quickClose?.declaredSales,
                expectedSales: quickClose && expectedSales !== undefined ? round(expectedSales) : undefined,
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
        after: {
          countedCash: counted,
          difference,
          expectedCash: snapshot.expectedCash,
          declaredSales: quickClose?.declaredSales ?? 0,
          expectedSales: quickClose && expectedSales !== undefined ? round(expectedSales) : 0,
          forceReason: forceReason?.trim() ?? '',
        },
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

  const closeRegisterDay = useCallback<AppContextValue['closeRegisterDay']>((
    storeId,
    staffFloat,
    countedCash,
    note,
    quickOpenShiftCounts,
  ) => {
    const actorResult = requireActor(storeId)
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    const current = dbRef.current
    const store = current.stores.find((candidate) => candidate.id === storeId)
    if (!store) return { ok: false, error: 'Store not found.' }
    const quick = isQuick(store)
    if (actor.role !== 'admin' && !(quick && can(actor, 'forceCloseShift'))) {
      return { ok: false, error: 'Only the owner or an authorized manager can close the store-day Z report.' }
    }
    if (!quick && (!Number.isFinite(staffFloat) || staffFloat < 0)) {
      return { ok: false, error: 'Enter the staff working float for this store day.' }
    }
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return { ok: false, error: 'Enter the cash counted at day end.' }
    }

    const day = dateKey(new Date())
    if (current.registerDayReports.some((report) => report.storeId === storeId && report.date === day)) {
      return { ok: false, error: 'The store-day Z report has already been closed.' }
    }
    const openSessions = current.registerSessions.filter((session) =>
      session.storeId === storeId && session.status === 'open',
    )
    const autoCloseable = openSessions.filter((session) =>
      isPrivilegedAutoShift(current, storeId, session),
    )
    if (hasOpenShiftsRequiringManualClose(current, storeId)) {
      return { ok: false, error: 'Close or force-close every staff shift before closing the day.' }
    }
    const daySessions = current.registerSessions.filter((session) =>
      session.storeId === storeId &&
      (dateKey(session.openedAt) === day ||
        (quick && ((session.closedAt && dateKey(session.closedAt) === day) || session.status === 'open'))),
    )
    if (!daySessions.length) return { ok: false, error: 'There are no register shifts to close for today.' }

    const closedAt = new Date().toISOString()
    const startISO = new Date(`${day}T00:00:00`).toISOString()
    const openingCash = quick
      ? round([...daySessions].sort((a, b) => a.openedAt.localeCompare(b.openedAt))[0].openingFloat ??
        [...daySessions].sort((a, b) => a.openedAt.localeCompare(b.openedAt))[0].openingCash)
      : round(staffFloat)
    const quickForceClosedSessions = quick
      ? daySessions.filter((session) => session.status === 'open').flatMap((session) => {
          const counted = quickOpenShiftCounts?.[session.id]
          if (!Number.isFinite(counted) || Number(counted) < 0) return []
          const sessionClosedAt = closedAt
          const snapshot = computeRegisterTotals(
            current,
            storeId,
            session.openedAt,
            sessionClosedAt,
            session.openingFloat ?? session.openingCash,
            session.id,
          )
          const declared = calculateQuickShiftClose(
            session.openingFloat ?? session.openingCash,
            Number(counted),
          )
          return [{
            ...session,
            status: 'closed' as const,
            closeType: 'shift' as const,
            closedAt: sessionClosedAt,
            closedById: actor.id,
            closedByName: actor.name,
            countedCash: round(Number(counted)),
            declaredSales: declared.declaredSales,
            expectedSales: undefined,
            difference: 0,
            leaveFloatForNextShift: false,
            note: [session.note, 'Force-closed during Quick day Z', note?.trim()].filter(Boolean).join(' · ').slice(0, 500),
            snapshot,
            reportDetails: registerReportDetails(current, session, sessionClosedAt),
          }]
        })
      : []
    if (quick && quickForceClosedSessions.length !== daySessions.filter((session) => session.status === 'open').length) {
      return { ok: false, error: 'Enter a valid counted total for every open shift before closing the day.' }
    }
    const autoClosedSessions = quick ? quickForceClosedSessions : autoCloseable.map((session) =>
      autoCloseRegisterSessionForZ(current, session, closedAt, actor),
    )
    const autoClosedById = new Map(autoClosedSessions.map((session) => [session.id, session]))
    const reportSource = {
      ...current,
      registerSessions: current.registerSessions.map((session) => autoClosedById.get(session.id) ?? session),
    }
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
    const baseSnapshot = computeRegisterTotals(reportSource, storeId, startISO, closedAt, openingCash)
    const reportDetails = registerReportDetails(reportSource, daySession, closedAt)
    const counted = round(countedCash)
    const quickShiftSummary = quick
      ? calculateQuickDayClose(daySessions.map((session) => {
          const closedSession = autoClosedById.get(session.id) ?? session
          const staffId = closedSession.staffId ?? closedSession.openedById
          const staff = current.users.find((candidate) => candidate.id === staffId && candidate.storeId === storeId)
          return {
            shiftId: closedSession.id,
            staffId,
            staffName: staff?.name ?? closedSession.openedByName,
            openedAt: closedSession.openedAt,
            closedAt: closedSession.closedAt,
            openingFloat: closedSession.openingFloat ?? closedSession.openingCash,
            countedCash: closedSession.countedCash,
            declaredSales: closedSession.declaredSales,
            expectedSales: closedSession.expectedSales,
            difference: closedSession.expectedSales === undefined ? 0 : closedSession.difference,
            correctionEntries: current.cashDifferences
              .filter((difference) => difference.shiftId === closedSession.id)
              .flatMap((difference) => difference.correctionEntries ?? []),
            note: closedSession.note,
            forceClosed: quickForceClosedSessions.some((forced) => forced.id === closedSession.id),
          }
        }), openingCash, counted)
      : undefined
    const snapshot = quickShiftSummary
      ? { ...baseSnapshot, expectedCash: quickShiftSummary.expectedCash }
      : baseSnapshot
    const difference = quickShiftSummary
      ? quickShiftSummary.difference
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
      quickShiftSummary,
    }
    commitDb((prev) => {
      let next = {
        ...prev,
        registerSessions: prev.registerSessions.map((session) =>
          autoClosedById.get(session.id) ?? session,
        ),
        registerDayReports: [...prev.registerDayReports, report],
      }
      for (const session of autoClosedSessions) {
        next = addLog(next, actor, {
          storeId,
          action: 'register_closed',
          entity: 'register',
          entityId: session.id,
          summary: `${quick ? 'Force-closed' : 'Auto-closed'} shift ${session.shiftNumber ?? ''} for store-day Z`,
          after: {
            countedCash: session.countedCash ?? 0,
            declaredSales: session.declaredSales ?? 0,
            expectedCash: session.snapshot?.expectedCash ?? 0,
            difference: session.difference ?? 0,
            staffId: session.staffId ?? session.openedById,
          },
        })
      }
      return addLog(next, actor, {
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
        declaredSales: quickShiftSummary?.declaredSales ?? 0,
      },
      })
    })
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const recordCashDifferenceCorrection = useCallback<AppContextValue['recordCashDifferenceCorrection']>((id, amount, note) => {
    const current = dbRef.current
    const difference = current.cashDifferences.find((item) => item.id === id)
    if (!difference) return { ok: false, error: 'Cash difference not found.' }
    const actorResult = requireActor(difference.storeId)
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    const store = current.stores.find((item) => item.id === difference.storeId)
    if (!store || !isQuick(store)) return { ok: false, error: 'Staff corrections are only available for Quick shifts.' }
    const mayResolveOwn = difference.staffId === actor.id && can(actor, 'closeShift')
    if (!mayResolveOwn && !can(actor, 'manageCashDifferences')) {
      return { ok: false, error: 'You do not have permission to correct this cash difference.' }
    }
    if (difference.status !== 'open' || difference.type !== 'shortage') {
      return { ok: false, error: 'Only open shortages can receive a cash correction.' }
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Enter a correction amount greater than zero.' }
    }
    const corrections = difference.correctionEntries ?? []
    const corrected = round(corrections.reduce((total, entry) => total + entry.amount, 0))
    const remaining = round(Math.abs(difference.amount) - corrected)
    const correctionAmount = round(amount)
    if (correctionAmount <= 0 || correctionAmount > remaining) {
      return { ok: false, error: `Correction must not exceed the remaining ${remaining.toFixed(3)} DT shortage.` }
    }
    const at = new Date().toISOString()
    const correction = {
      id: uid('cashcorr'),
      amount: correctionAmount,
      staffId: actor.id,
      staffName: actor.name,
      at,
      note: note?.trim().slice(0, 500) || undefined,
    }
    const fullyCorrected = correctionAmount === remaining
    commitDb((prev) => addLog({
      ...prev,
      cashDifferences: prev.cashDifferences.map((item) => item.id === id
        ? {
            ...item,
            correctionEntries: [...(item.correctionEntries ?? []), correction],
            status: fullyCorrected ? 'settled' as const : item.status,
            resolvedAt: fullyCorrected ? at : item.resolvedAt,
            resolvedById: fullyCorrected ? actor.id : item.resolvedById,
            resolution: fullyCorrected ? 'paid_back' as const : item.resolution,
          }
        : item),
    }, actor, {
      storeId: difference.storeId,
      action: 'cash_difference_resolved',
      entity: 'cash_difference',
      entityId: difference.id,
      summary: `Recorded a ${correctionAmount.toFixed(3)} DT cash correction for ${difference.staffId}`,
      before: { remainingShortage: remaining, status: difference.status },
      after: { correctionAmount, fullyCorrected, staffId: actor.id, at },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const acceptCashDifference = useCallback<AppContextValue['acceptCashDifference']>((id, note) => {
    const difference = dbRef.current.cashDifferences.find((item) => item.id === id)
    if (!difference) return { ok: false, error: 'Cash difference not found.' }
    const actorResult = requireActor(difference.storeId)
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    const store = dbRef.current.stores.find((item) => item.id === difference.storeId)
    if (!store || !isQuick(store)) return { ok: false, error: 'Staff acceptance is only available for Quick shifts.' }
    const mayResolveOwn = difference.staffId === actor.id && can(actor, 'closeShift')
    if (!mayResolveOwn && !can(actor, 'manageCashDifferences')) {
      return { ok: false, error: 'You do not have permission to accept this cash difference.' }
    }
    if (difference.status !== 'open') return { ok: false, error: 'Only open cash differences can be accepted.' }
    const at = new Date().toISOString()
    commitDb((prev) => addLog({
      ...prev,
      cashDifferences: prev.cashDifferences.map((item) => item.id === id
        ? {
            ...item,
            status: 'settled' as const,
            resolvedAt: at,
            resolvedById: actor.id,
            resolution: 'waived' as const,
            note: note?.trim().slice(0, 500) || item.note,
          }
        : item),
    }, actor, {
      storeId: difference.storeId,
      action: 'cash_difference_resolved',
      entity: 'cash_difference',
      entityId: difference.id,
      summary: `Accepted ${Math.abs(difference.amount).toFixed(3)} DT cash difference`,
      before: { amount: difference.amount, status: difference.status },
      after: { amount: difference.amount, status: 'settled', resolution: 'waived', staffId: actor.id, at },
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
      const store = current.stores.find((candidate) => candidate.id === customer.storeId)
      if (!store) return { ok: false, error: 'Store not found.' }
      if (method !== 'cash' && method !== 'card') {
        return { ok: false, error: 'Choose cash or card for this tab payment.' }
      }
      const quick = isQuick(store)
      if (quick && !store.settings.allowCredit) {
        return { ok: false, error: 'Customer tabs are disabled for this store.' }
      }
      if (!canSettleCustomerTabs(store, actor)) {
        return { ok: false, error: 'You do not have permission to record payments.' }
      }
      const balance = balanceFor(current.ledger, customerId)
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.' }
      if (amount > balance + 0.0001) {
        return { ok: false, error: `Amount exceeds the outstanding balance (${balance.toFixed(3)} DT).` }
      }
      const remainingBalance = round(balance - amount)
      const ensuredShift = ensureShiftForActor(current, customer.storeId, actor)
      if (quick && actor.role === 'staff' && !ensuredShift.shift) {
        return { ok: false, error: 'Open your shift before receiving a tab payment.' }
      }
      commitDb((prev) => addLog(withEnsuredShift({
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
            shiftId: ensuredShift.shift?.id,
            createdAt: new Date().toISOString(),
          },
          ...prev.ledger,
        ],
      }, ensuredShift, actor, customer.storeId), actor, {
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
    recordCashDifferenceCorrection,
    acceptCashDifference,
    voidCashDifference,
    archiveCashDifference,
    restoreCashDifference,
  }
}

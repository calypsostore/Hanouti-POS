import { useCallback } from 'react'
import type { RegisterSession } from '../types'
import { round } from '../lib/pricing-utils'
import { uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import { computeRegisterTotals, registerReportDetails } from '../lib/reports'
import { can } from '../lib/permissions'
import { nextShiftNumber, openShiftForStaff } from '../lib/registerShifts'
import { addLog } from './audit'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

export function useRegisterSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireActor } = dependencies
  const openRegister = useCallback<AppContextValue['openRegister']>(
    (storeId, openingCash) => {
      const actorResult = requireActor(storeId)
      if (!actorResult.ok) return actorResult
      const actor = actorResult.actor
      if (!can(actor, 'openShift')) {
        return { ok: false, error: 'You do not have permission to open a shift.' }
      }
      if (!Number.isFinite(openingCash) || openingCash < 0) {
        return { ok: false, error: 'Enter a valid opening cash amount.' }
      }
      if (openShiftForStaff(dbRef.current, storeId, actor.id)) {
        return { ok: false, error: 'You already have an open shift for this store.' }
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
      }
      commitDb((prev) => addLog({
        ...prev,
        registerSessions: [...prev.registerSessions, session],
      }, actor, {
        storeId,
        action: 'register_opened',
        entity: 'register',
        entityId: session.id,
        summary: `Opened shift ${session.shiftNumber} with ${session.openingCash.toFixed(3)} DT opening cash`,
        after: { openingCash: session.openingCash },
      }))
      return { ok: true }
    },
    [commitDb, dbRef, requireActor],
  )

  const closeRegister = useCallback<AppContextValue['closeRegister']>(
    (sessionId, countedCash, note) => {
      const current = dbRef.current
      const session = current.registerSessions.find((s) => s.id === sessionId)
      if (!session) return { ok: false, error: 'Register session not found.' }
      const actorResult = requireActor(session.storeId)
      if (!actorResult.ok) return actorResult
      const actor = actorResult.actor
      if (session.status !== 'open') {
        return { ok: false, error: 'This session was already closed and cannot change.' }
      }
      if (actor.role !== 'admin' && (session.staffId ?? session.openedById) !== actor.id) {
        return { ok: false, error: 'You can only close your own shift.' }
      }
      if (!can(actor, 'closeShift')) {
        return { ok: false, error: 'You do not have permission to close shifts.' }
      }
      if (current.openOrders.some((order) => order.storeId === session.storeId)) {
        return { ok: false, error: 'Close or cancel all open table orders before closing the register.' }
      }
      if (!Number.isFinite(countedCash) || countedCash < 0) {
        return { ok: false, error: 'Enter the cash you counted in the drawer.' }
      }

      // The snapshot is computed once from persisted data and frozen: the
      // stored Z report never changes even if later orders are voided.
      const closedAt = new Date().toISOString()
      const snapshot = computeRegisterTotals(
        current,
        session.storeId,
        session.openedAt,
        closedAt,
        session.openingCash,
        session.id,
      )
      const counted = round(countedCash)

      const store = current.stores.find((candidate) => candidate.id === session.storeId)
      const difference = store?.settings.posMode === 'quick'
        ? 0
        : round(counted - snapshot.expectedCash)
      const zReportNumber = current.registerSessions
        .filter((candidate) => candidate.storeId === session.storeId)
        .reduce((max, candidate) => Math.max(max, candidate.zReportNumber ?? 0), 0) + 1
      const reportDetails = registerReportDetails(current, session, closedAt)
      commitDb((prev) => addLog({
        ...prev,
        registerSessions: prev.registerSessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                status: 'closed' as const,
                closedAt,
                closedById: actor.id,
                closedByName: actor.name,
                countedCash: counted,
                difference,
                note: note?.trim() || undefined,
                snapshot,
                zReportNumber,
                reportDetails,
              }
            : s,
        ),
      }, actor, {
        storeId: session.storeId,
        action: 'register_closed',
        entity: 'register',
        entityId: session.id,
        summary: `Closed shift ${session.shiftNumber ?? ''} with ${counted.toFixed(3)} DT counted cash (difference ${difference.toFixed(3)} DT)`,
        after: { countedCash: counted, difference, expectedCash: snapshot.expectedCash },
      }))
      return { ok: true }
    },
    [commitDb, dbRef, requireActor],
  )

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


  return { openRegister, closeRegister, settleCredit }
}

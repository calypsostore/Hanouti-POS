import { useCallback } from 'react'
import type { RegisterSession } from '../types'
import { round } from '../lib/pricing-utils'
import { uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import { computeRegisterTotals } from '../lib/reports'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

export function useRegisterSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireActor } = dependencies
  const openRegister = useCallback<AppContextValue['openRegister']>(
    (storeId, openingCash) => {
      const actorResult = requireActor(storeId)
      if (!actorResult.ok) return actorResult
      const actor = actorResult.actor
      if (actor.role !== 'admin' && !actor.permissions.register) {
        return { ok: false, error: 'You do not have permission to open the register.' }
      }
      if (!Number.isFinite(openingCash) || openingCash < 0) {
        return { ok: false, error: 'Enter a valid opening cash amount.' }
      }
      if (dbRef.current.registerSessions.some((s) => s.storeId === storeId && s.status === 'open')) {
        return { ok: false, error: 'A register session is already open for this store.' }
      }
      const session: RegisterSession = {
        id: uid('reg'),
        storeId,
        status: 'open',
        openedAt: new Date().toISOString(),
        openedById: actor.id,
        openedByName: actor.name,
        openingCash: round(openingCash),
      }
      commitDb((prev) => ({ ...prev, registerSessions: [...prev.registerSessions, session] }))
      return { ok: true }
    },
    [commitDb, requireActor],
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
      if (actor.role !== 'admin' && !actor.permissions.supervisor && session.openedById !== actor.id) {
        return { ok: false, error: 'You can only close a register session you opened.' }
      }
      if (actor.role !== 'admin' && !actor.permissions.register) {
        return { ok: false, error: 'You do not have permission to close the register.' }
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
      )
      const counted = round(countedCash)

      commitDb((prev) => ({
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
                difference: round(counted - snapshot.expectedCash),
                note: note?.trim() || undefined,
                snapshot,
              }
            : s,
        ),
      }))
      return { ok: true }
    },
    [commitDb, requireActor],
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
      commitDb((prev) => ({
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
            createdAt: new Date().toISOString(),
          },
          ...prev.ledger,
        ],
      }))
      return { ok: true }
    },
    [commitDb, requireActor],
  )


  return { openRegister, closeRegister, settleCredit }
}

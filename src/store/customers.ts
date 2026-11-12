import { useCallback } from 'react'
import type { Customer } from '../types'
import { uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

export function useCustomersSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireAdmin } = dependencies
  const addCustomer = useCallback<AppContextValue['addCustomer']>(
    (storeId, data) => {
      const actorResult = requireAdmin(storeId)
      if (!actorResult.ok) return actorResult
      if (!data.name.trim()) return { ok: false, error: 'Enter the customer name.' }
      if (!Number.isFinite(data.limit) || data.limit < 0) return { ok: false, error: 'Enter a valid credit limit.' }
      commitDb((prev) => ({
        ...prev,
        customers: [
          ...prev.customers,
          {
            id: uid('cus'),
            storeId,
            name: data.name.trim(),
            phone: data.phone.trim(),
            limit: data.limit,
            notes: data.notes.trim(),
            cycle: data.cycle ?? 'monthly',
            createdAt: new Date().toISOString(),
          },
        ],
      }))
      return { ok: true }
    },
    [commitDb, requireAdmin],
  )

  const updateCustomer = useCallback<AppContextValue['updateCustomer']>(
    (id, patch) => {
      const customer = dbRef.current.customers.find((c) => c.id === id)
      if (!customer) return { ok: false, error: 'Customer not found.' }
      const actorResult = requireAdmin(customer.storeId)
      if (!actorResult.ok) return actorResult
      if (patch.storeId !== undefined && patch.storeId !== customer.storeId) {
        return { ok: false, error: 'A customer cannot be moved to another store.' }
      }
      if (patch.limit !== undefined && (!Number.isFinite(patch.limit) || patch.limit < 0)) {
        return { ok: false, error: 'Enter a valid credit limit.' }
      }
      const safePatch: Partial<Customer> = { ...patch }
      delete safePatch.id
      delete safePatch.storeId
      commitDb((prev) => ({
        ...prev,
        customers: prev.customers.map((c) => (c.id === id ? { ...c, ...safePatch } : c)),
      }))
      return { ok: true }
    },
    [commitDb, requireAdmin],
  )

  const deleteCustomer = useCallback<AppContextValue['deleteCustomer']>(
    (id) => {
      const current = dbRef.current
      const customer = current.customers.find((c) => c.id === id)
      if (!customer) return { ok: false, error: 'Customer not found.' }
      const actorResult = requireAdmin(customer.storeId)
      if (!actorResult.ok) return actorResult
      const balance = balanceFor(current.ledger, id)
      if (balance > 0) return { ok: false, error: 'Settle the outstanding balance before removing this customer.' }
      commitDb((prev) => ({
        ...prev,
        customers: prev.customers.filter((c) => c.id !== id),
        ledger: prev.ledger.filter((l) => l.customerId !== id),
      }))
      return { ok: true }
    },
    [commitDb, requireAdmin],
  )


  return { addCustomer, updateCustomer, deleteCustomer }
}

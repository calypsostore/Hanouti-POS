import { useCallback } from 'react'
import type { AuditJsonValue, Customer } from '../types'
import { uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import { isQuick } from '../lib/posMode'
import { addLog, changedAuditFields } from './audit'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

const customerSnapshot = (customer: Customer): Record<string, AuditJsonValue> => ({
  name: customer.name,
  phone: customer.phone,
  limit: customer.limit,
  notesLength: customer.notes.length,
  cycle: customer.cycle ?? 'monthly',
})

export function useCustomersSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireAdmin, requireCapability } = dependencies
  const authorizeCustomerChange = useCallback((storeId: string) => {
    const store = dbRef.current.stores.find((item) => item.id === storeId)
    if (!store) return { ok: false as const, error: 'Store not found.' }
    return isQuick(store)
      ? requireCapability(storeId, 'manageCustomers')
      : requireAdmin(storeId)
  }, [dbRef, requireAdmin, requireCapability])
  const addCustomer = useCallback<AppContextValue['addCustomer']>(
    (storeId, data) => {
      const actorResult = authorizeCustomerChange(storeId)
      if (!actorResult.ok) return actorResult
      if (!data.name.trim()) return { ok: false, error: 'Enter the customer name.' }
      if (!Number.isFinite(data.limit) || data.limit < 0) return { ok: false, error: 'Enter a valid credit limit.' }
      const customer: Customer = {
        id: uid('cus'),
        storeId,
        name: data.name.trim(),
        phone: data.phone.trim(),
        limit: data.limit,
        notes: data.notes.trim(),
        cycle: data.cycle ?? 'monthly',
        createdAt: new Date().toISOString(),
      }
      commitDb((prev) => addLog({
        ...prev,
        customers: [...prev.customers, customer],
      }, actorResult.actor, {
        storeId,
        action: 'created',
        entity: 'customer',
        entityId: customer.id,
        summary: `Created customer ${customer.name}`,
        after: customerSnapshot(customer),
      }))
      return { ok: true }
    },
    [authorizeCustomerChange, commitDb],
  )

  const updateCustomer = useCallback<AppContextValue['updateCustomer']>(
    (id, patch) => {
      const customer = dbRef.current.customers.find((c) => c.id === id)
      if (!customer) return { ok: false, error: 'Customer not found.' }
      const actorResult = authorizeCustomerChange(customer.storeId)
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
      const updated = { ...customer, ...safePatch }
      const changes = changedAuditFields(customerSnapshot(customer), customerSnapshot(updated))
      commitDb((prev) => addLog({
        ...prev,
        customers: prev.customers.map((c) => (c.id === id ? updated : c)),
      }, actorResult.actor, {
        storeId: customer.storeId,
        action: 'edited',
        entity: 'customer',
        entityId: id,
        summary: `Edited customer ${customer.name}${changes.fields.length ? ` (${changes.fields.join(', ')})` : ''}`,
        before: changes.before,
        after: changes.after,
      }))
      return { ok: true }
    },
    [authorizeCustomerChange, commitDb, dbRef],
  )

  const deleteCustomer = useCallback<AppContextValue['deleteCustomer']>(
    (id) => {
      const current = dbRef.current
      const customer = current.customers.find((c) => c.id === id)
      if (!customer) return { ok: false, error: 'Customer not found.' }
      const actorResult = authorizeCustomerChange(customer.storeId)
      if (!actorResult.ok) return actorResult
      const balance = balanceFor(current.ledger, id)
      if (balance > 0) return { ok: false, error: 'Settle the outstanding balance before removing this customer.' }
      commitDb((prev) => addLog({
        ...prev,
        customers: prev.customers.filter((c) => c.id !== id),
        ledger: prev.ledger.filter((l) => l.customerId !== id),
      }, actorResult.actor, {
        storeId: customer.storeId,
        action: 'deleted',
        entity: 'customer',
        entityId: id,
        summary: `Deleted customer ${customer.name}`,
        before: customerSnapshot(customer),
      }))
      return { ok: true }
    },
    [authorizeCustomerChange, commitDb, dbRef],
  )


  return { addCustomer, updateCustomer, deleteCustomer }
}

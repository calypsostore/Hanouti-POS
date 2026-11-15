import { round } from '../../src/lib/pricing-utils.ts'
import type { AuthenticatedActor, HubStoreState } from './types.ts'
import { requireCapability } from './auth.ts'

export function validateLedgerEntry(
  input: Record<string, unknown>,
  state: HubStoreState,
  actor: AuthenticatedActor,
): Record<string, unknown> {
  if (actor.stationOnly) throw Object.assign(new Error('Station devices cannot write customer ledger entries.'), { status: 403 })
  if (input.type !== 'charge' && input.type !== 'payment') throw new Error('Ledger entry type is invalid.')
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount === 0) {
    throw new Error('Ledger amount must be a non-zero finite amount.')
  }
  if (typeof input.customerId !== 'string' ||
    state.collections.customers?.[input.customerId]?.storeId !== actor.storeId) {
    throw new Error('Ledger entry must reference a customer in this store.')
  }
  if (input.type === 'payment' && (input.amount < 0 || !['cash', 'card'].includes(String(input.method)))) {
    throw new Error('A ledger payment must be positive and use cash or card.')
  }
  if (input.type === 'charge' && input.amount < 0) requireCapability(actor, 'voidOrders')
  else requireCapability(actor, input.type === 'charge' ? 'credit' : 'settle')

  if (input.orderId !== undefined) {
    if (typeof input.orderId !== 'string' || state.collections.orders?.[input.orderId]?.storeId !== actor.storeId) {
      throw new Error('Ledger entry must reference an order in this store.')
    }
  }
  if (input.type === 'charge' && input.amount > 0) {
    const order = typeof input.orderId === 'string' ? state.collections.orders?.[input.orderId] : undefined
    if (!order || order.status === 'void' || order.paymentMethod !== 'credit' ||
      order.customerId !== input.customerId || round(input.amount) !== order.total) {
      throw new Error('A credit charge must match the customer and total of a non-void credit order.')
    }
  }
  if (input.creditAdjustment === true) requireCapability(actor, 'voidOrders')
  if (input.creditAdjustment !== undefined && typeof input.creditAdjustment !== 'boolean') {
    throw new Error('Ledger credit adjustment flag is invalid.')
  }
  if (input.shiftId !== undefined &&
    (typeof input.shiftId !== 'string' || state.collections.shifts?.[input.shiftId]?.storeId !== actor.storeId)) {
    throw new Error('Ledger entry must reference a shift in this store.')
  }

  const existing = state.collections.ledger?.[String(input.id)]
  if (existing && JSON.stringify(existing) !== JSON.stringify(input)) {
    throw new Error('Ledger entries are append-only and cannot be changed.')
  }
  return {
    ...input,
    amount: round(input.amount),
    staffName: String(state.collections.users?.[actor.userId]?.name ?? ''),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
}

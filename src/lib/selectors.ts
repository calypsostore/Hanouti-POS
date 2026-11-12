import type { LedgerEntry } from '../types'
import { round } from './pricing-utils'

export const balanceFor = (ledger: LedgerEntry[], customerId: string) => {
  const entries = ledger.filter((l) => l.customerId === customerId)
  const charges = entries.filter((l) => l.type === 'charge').reduce((a, l) => a + l.amount, 0)
  const payments = entries.filter((l) => l.type === 'payment').reduce((a, l) => a + l.amount, 0)
  return round(charges - payments)
}

export const customerActivity = (ledger: LedgerEntry[], customerId: string) =>
  ledger
    .filter((l) => l.customerId === customerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

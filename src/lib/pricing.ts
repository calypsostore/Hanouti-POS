import type { OrderChannel, StoreSettings } from '../types'
import { round } from './pricing-utils'

export const computeTotals = (
  items: Array<{ price: number; qty: number }>,
  settings: StoreSettings,
  discount = 0,
  _channel?: OrderChannel,
) => {
  const subtotal = items.reduce((acc, it) => acc + it.price * it.qty, 0)
  const service = subtotal * (settings.serviceCharge / 100)
  const base = subtotal + service
  const tax = settings.taxRate
    ? settings.taxInclusive
      ? base - base / (1 + settings.taxRate / 100)
      : base * (settings.taxRate / 100)
    : 0
  const gross = settings.taxInclusive ? base : base + tax
  const total = Math.max(0, gross - discount)
  return {
    subtotal: round(subtotal),
    service: round(service),
    tax: round(tax),
    total: round(total),
  }
}

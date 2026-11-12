import type { StoreSettings } from '../types'
import { round } from './pricing-utils'

export const computeTotals = (
  items: Array<{ price: number; qty: number }>,
  settings: StoreSettings,
  discount = 0,
) => {
  const subtotal = items.reduce((acc, it) => acc + it.price * it.qty, 0)
  const service = subtotal * (settings.serviceCharge / 100)
  const grossBase = subtotal + service
  const taxableBase = Math.max(0, grossBase - discount)
  const tax = settings.taxRate
    ? settings.taxInclusive
      ? taxableBase - taxableBase / (1 + settings.taxRate / 100)
      : taxableBase * (settings.taxRate / 100)
    : 0
  const gross = settings.taxInclusive ? taxableBase : taxableBase + tax
  const total = Math.max(0, gross)
  // Sanity: a 10% exclusive tax on 100 discounted by 20 is 8; inclusive tax is 80 - 80/1.1.
  return {
    subtotal: round(subtotal),
    service: round(service),
    tax: round(tax),
    total: round(total),
  }
}

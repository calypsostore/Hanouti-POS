import type { Order, OrderItem, Product, StaffConsumptionSettings, StoreSettings } from '../types.ts'
import { computeTotals } from './pricing.ts'
import { round } from './pricing-utils.ts'

export function staffConsumptionError(
  items: OrderItem[],
  settings: StaffConsumptionSettings,
  orders: Order[],
  shiftId: string | undefined,
  staffId: string,
): string | undefined {
  if (!settings.enabled) return 'Staff items are disabled by the administrator.'
  if (!shiftId) return 'Open your shift before recording staff items.'
  if (!items.length) return 'Choose at least one staff item.'
  const requested = new Map<string, number>()
  for (const item of items) {
    if (item.soldByWeight || !Number.isSafeInteger(item.qty) || item.qty <= 0) {
      return 'Staff items must use whole quantities.'
    }
    if (!settings.allowances.some((allowance) => allowance.productId === item.productId)) {
      return 'One or more selected items are not allowed for staff.'
    }
    requested.set(item.productId, (requested.get(item.productId) ?? 0) + item.qty)
  }
  for (const [productId, quantity] of requested) {
    const allowance = settings.allowances.find((entry) => entry.productId === productId)
    if (!allowance) return 'A staff item allowance is missing.'
    const alreadyUsed = orders
      .filter((order) => order.staffConsumption && order.status === 'completed' &&
        order.shiftId === shiftId && order.staffId === staffId)
      .flatMap((order) => order.items)
      .filter((item) => item.productId === productId)
      .reduce((total, item) => total + item.qty, 0)
    if (alreadyUsed + quantity > allowance.maxPerShift) {
      return `Shift limit reached for ${productId} (${allowance.maxPerShift} per shift).`
    }
  }
  return undefined
}

export function staffConsumptionDiscount(
  items: OrderItem[],
  settings: StoreSettings,
  policy: StaffConsumptionSettings,
): number {
  const totals = computeTotals(items, settings)
  const gross = round(totals.subtotal + totals.service)
  if (policy.pricing === 'free') return gross
  if (policy.pricing === 'discount') return round(gross * policy.discountPercent / 100)
  return 0
}

export function enabledStaffProducts(products: Product[], policy: StaffConsumptionSettings): Product[] {
  const allowed = new Set(policy.allowances.map((entry) => entry.productId))
  return products.filter((product) => product.active && allowed.has(product.id))
}

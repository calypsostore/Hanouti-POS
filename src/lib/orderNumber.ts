import type { Order, OrderNumberFormat, StoreSettings } from '../types.ts'

const MIN_ORDER_NUMBER = 1000

/** Standalone numbering: sequential per store, honouring the configured format. */
export function nextOrderNumber(
  numbers: number[],
  format: OrderNumberFormat,
  now: Date = new Date(),
): number {
  const valid = numbers.filter((value) => Number.isFinite(value) && value > 0)
  if (format === 'daily') {
    const day = Number(
      `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`,
    )
    const base = day * 1000
    const inDay = valid.filter((value) => value > base && value < base + 1000)
    return base + Math.max(0, ...inDay.map((value) => value - base)) + 1
  }
  return Math.max(MIN_ORDER_NUMBER, ...valid) + 1
}

/** Short, stable device tag used for offline order numbers (for example D2-0007). */
export function deviceOrderPrefix(deviceId: string): string {
  let hash = 0
  for (const char of deviceId) hash = (hash * 31 + char.charCodeAt(0)) % 1296
  const tag = hash.toString(36).toUpperCase().padStart(2, '0')
  return `D${tag}`
}

export function provisionalOrderNumber(deviceId: string, sequence: number): string {
  const safeSequence = Number.isFinite(sequence) ? Math.max(1, Math.floor(sequence)) : 1
  return `${deviceOrderPrefix(deviceId)}-${String(safeSequence).padStart(4, '0')}`
}

/** Display-only label: a provisional number until the hub assigns the real one. */
export function orderNumberLabel(
  order: Pick<Order, 'number' | 'provisionalNumber'>,
  settings?: Pick<StoreSettings, 'orderRules'>,
): string {
  if (!(order.number > 0) && order.provisionalNumber) return `${order.provisionalNumber} (provisional)`
  const prefix = settings?.orderRules.orderNumberFormat === 'prefix'
    ? settings.orderRules.orderNumberPrefix.trim()
    : ''
  return prefix ? `${prefix}${order.number}` : String(order.number)
}

/** Kitchen tickets and receipts mark a provisional order clearly. */
export const isProvisionalOrder = (order: Pick<Order, 'number' | 'provisionalNumber'>): boolean =>
  !(order.number > 0) && Boolean(order.provisionalNumber)

import type { OrderItemStatus } from '../types'

const STATION_TRANSITIONS: Partial<Record<OrderItemStatus, OrderItemStatus[]>> = {
  sent: ['preparing'],
  preparing: ['sent', 'ready'],
  ready: ['preparing', 'served'],
  served: ['ready'],
}

export const canTransitionStationItem = (
  current: OrderItemStatus | undefined,
  next: OrderItemStatus,
): boolean => !!current && STATION_TRANSITIONS[current]?.includes(next) === true

export const isNoteOnlyStationUpdate = (
  status: OrderItemStatus | undefined,
  patch: { qty?: number; note?: string; useCurrentPrice?: boolean },
): boolean =>
  (status === 'sent' || status === 'preparing' || status === 'ready') &&
  patch.note !== undefined &&
  patch.qty === undefined &&
  patch.useCurrentPrice === undefined

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

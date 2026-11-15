import type { Database } from '../types'
import { computeTotals } from './pricing'
import { mergeOpenOrderItems } from './openOrderItemsMerge'

const orderWasClosed = (database: Database, order: Database['openOrders'][number]) =>
  (order.recordedOrderId && database.orders.some((item) =>
    item.id === order.recordedOrderId && item.status === 'completed',
  )) || database.auditLogs.some((log) =>
    log.entity === 'order' && log.entityId === order.id && log.action === 'voided',
  )

export const mergeOpenOrderSnapshots = (primary: Database, secondary: Database): Database => {
  const orders = primary.openOrders.flatMap((order) => {
    if (orderWasClosed(secondary, order)) return []
    const remote = secondary.openOrders.find((candidate) => candidate.id === order.id)
    if (!remote) return [order]
    const items = mergeOpenOrderItems(order.items, remote.items, order.updatedAt, remote.updatedAt)
    const latest = Date.parse(order.updatedAt) >= Date.parse(remote.updatedAt) ? order : remote
    const store = primary.stores.find((candidate) => candidate.id === order.storeId)
    return [store
      ? {
          ...latest,
          items,
          ...computeTotals(items.filter((item) => item.status !== 'void'), store.settings, latest.discount),
        }
      : { ...latest, items }]
  })
  const primaryIds = new Set(orders.map((order) => order.id))
  const remoteOnly = secondary.openOrders.filter((order) =>
    !primaryIds.has(order.id) && !orderWasClosed(primary, order) && !orderWasClosed(secondary, order),
  )
  return { ...primary, openOrders: [...orders, ...remoteOnly] }
}

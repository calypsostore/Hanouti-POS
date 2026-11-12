import { useCallback } from 'react'
import type { OpenOrder } from '../types'
import { computeTotals } from '../lib/pricing'
import { round } from '../lib/pricing-utils'
import { uid } from '../lib/utils'
import { verifySecret } from '../lib/hash'
import { addLog } from './audit'
import { buildUpdatedOpenOrder, openOrderSnapshot } from './openOrderHelpers'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

export function useOpenOrdersSlice(
  dependencies: StoreSliceDependencies,
  createOrder: AppContextValue['createOrder'],
) {
  const { dbRef, commitDb, requireActor } = dependencies

  const openTableOrder = useCallback<AppContextValue['openTableOrder']>((storeId, tableId, guests) => {
    const actorResult = requireActor(storeId)
    if (!actorResult.ok) return actorResult
    const current = dbRef.current
    const store = current.stores.find((item) => item.id === storeId)
    if (!store?.settings.features.tables) return { ok: false, error: 'Tables are disabled for this store.' }
    const table = current.tables.find((item) => item.id === tableId && item.storeId === storeId && item.active)
    if (!table) return { ok: false, error: 'Choose an active table from this store.' }
    if (current.openOrders.some((order) => order.storeId === storeId && order.tableId === tableId)) {
      return { ok: false, error: 'This table already has an open order.' }
    }
    if (!current.registerSessions.some((session) => session.storeId === storeId && session.status === 'open')) {
      return { ok: false, error: 'Open the register first.' }
    }
    if (guests !== undefined && (!Number.isSafeInteger(guests) || guests < 1 || guests > 50)) {
      return { ok: false, error: 'Guests must be a whole number from 1 to 50.' }
    }
    const actor = actorResult.actor
    const now = new Date().toISOString()
    const order: OpenOrder = {
      id: uid('open'),
      storeId,
      tableId: table.id,
      tableName: table.name,
      guests,
      items: [],
      subtotal: 0,
      tax: 0,
      service: 0,
      discount: 0,
      total: 0,
      channel: 'dine-in',
      status: 'open',
      staffId: actor.id,
      staffName: actor.name,
      createdAt: now,
      updatedAt: now,
    }
    commitDb((prev) => addLog({
      ...prev,
      openOrders: [order, ...prev.openOrders],
    }, actor, {
      storeId,
      action: 'created',
      entity: 'order',
      entityId: order.id,
      summary: `Opened ${table.name}`,
      after: { tableName: table.name, guests: guests ?? 0 },
    }))
    return { ok: true, order }
  }, [commitDb, dbRef, requireActor])

  const addItemsToOpenOrder = useCallback<AppContextValue['addItemsToOpenOrder']>(
    (orderId, items, discount, note) => {
      const current = dbRef.current
      const order = current.openOrders.find((item) => item.id === orderId)
      if (!order) return { ok: false, error: 'Open table order not found.' }
      const actorResult = requireActor(order.storeId)
      if (!actorResult.ok) return actorResult
      if (!Array.isArray(items)) return { ok: false, error: 'The order items are invalid.' }
      if (!items.length && discount === undefined && note === undefined) {
        return { ok: false, error: 'Add items or make a change before saving.' }
      }
      const result = buildUpdatedOpenOrder(order, items, discount, note, actorResult.actor, current)
      if (!result.ok) return result
      commitDb((prev) => addLog({
        ...prev,
        openOrders: prev.openOrders.map((item) => item.id === order.id ? result.order : item),
      }, actorResult.actor, {
        storeId: order.storeId,
        action: 'edited',
        entity: 'order',
        entityId: order.id,
        summary: `Updated open order at ${order.tableName}`,
        before: openOrderSnapshot(order),
        after: openOrderSnapshot(result.order),
      }))
      return result
    },
    [commitDb, dbRef, requireActor],
  )

  const sendToKitchen = useCallback<AppContextValue['sendToKitchen']>(
    (orderId, items = [], discount, note) => {
      const current = dbRef.current
      const order = current.openOrders.find((item) => item.id === orderId)
      if (!order) return { ok: false, error: 'Open table order not found.' }
      const actorResult = requireActor(order.storeId)
      if (!actorResult.ok) return actorResult
      if (!Array.isArray(items)) return { ok: false, error: 'The order items are invalid.' }
      const result = buildUpdatedOpenOrder(order, items, discount, note, actorResult.actor, current)
      if (!result.ok) return result
      const unsent = result.order.items.filter((item) => !item.sentAt)
      if (!unsent.length) return { ok: false, error: 'There are no new items to send to the kitchen.' }
      const sentAt = new Date().toISOString()
      const updated: OpenOrder = {
        ...result.order,
        items: result.order.items.map((item) => item.sentAt ? item : { ...item, sentAt }),
      }
      commitDb((prev) => addLog({
        ...prev,
        openOrders: prev.openOrders.map((item) => item.id === order.id ? updated : item),
      }, actorResult.actor, {
        storeId: order.storeId,
        action: 'edited',
        entity: 'order',
        entityId: order.id,
        summary: `Sent ${unsent.length} item${unsent.length === 1 ? '' : 's'} from ${order.tableName} to the kitchen`,
        before: { unsentItems: order.items.filter((item) => !item.sentAt).length },
        after: { sentItems: unsent.length, sentAt },
      }))
      return { ok: true, order: updated, items: unsent }
    },
    [commitDb, dbRef, requireActor],
  )

  const payOpenOrder = useCallback<AppContextValue['payOpenOrder']>(
    (orderId, paymentMethod, customerId) => {
      const order = dbRef.current.openOrders.find((item) => item.id === orderId)
      if (!order) return { ok: false, error: 'Open table order not found.' }
      const actorResult = requireActor(order.storeId)
      if (!actorResult.ok) return actorResult
      const paid = createOrder({
        items: order.items,
        channel: 'dine-in',
        tableId: order.tableId,
        guests: order.guests,
        paymentMethod,
        customerId,
        discount: order.discount,
        note: order.note,
      })
      if (!paid.ok) return paid
      const actor = requireActor(order.storeId)
      if (!actor.ok) return actor
      commitDb((prev) => addLog({
        ...prev,
        openOrders: prev.openOrders.filter((item) => item.id !== order.id),
      }, actor.actor, {
        storeId: order.storeId,
        action: 'edited',
        entity: 'order',
        entityId: order.id,
        summary: `Paid ${order.tableName} order #${paid.order.number}`,
        before: openOrderSnapshot(order),
        after: { paidOrderId: paid.order.id, orderNumber: paid.order.number, total: paid.order.total },
      }))
      return { ok: true, order: paid.order }
    },
    [commitDb, createOrder, dbRef, requireActor],
  )

  const moveOrderToTable = useCallback<AppContextValue['moveOrderToTable']>((orderId, tableId) => {
    const current = dbRef.current
    const order = current.openOrders.find((item) => item.id === orderId)
    if (!order) return { ok: false, error: 'Open table order not found.' }
    const actorResult = requireActor(order.storeId)
    if (!actorResult.ok) return actorResult
    const table = current.tables.find((item) => item.id === tableId && item.storeId === order.storeId && item.active)
    if (!table) return { ok: false, error: 'Choose an active table from this store.' }
    if (table.id !== order.tableId && current.openOrders.some((item) =>
      item.storeId === order.storeId && item.tableId === table.id,
    )) return { ok: false, error: 'The destination table already has an open order.' }
    const updated = { ...order, tableId: table.id, tableName: table.name, updatedAt: new Date().toISOString() }
    commitDb((prev) => addLog({
      ...prev,
      openOrders: prev.openOrders.map((item) => item.id === order.id ? updated : item),
    }, actorResult.actor, {
      storeId: order.storeId,
      action: 'edited',
      entity: 'order',
      entityId: order.id,
      summary: `Moved open order from ${order.tableName} to ${table.name}`,
      before: { tableName: order.tableName },
      after: { tableName: table.name },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const mergeTableOrders = useCallback<AppContextValue['mergeTableOrders']>((sourceOrderId, targetOrderId) => {
    if (sourceOrderId === targetOrderId) return { ok: false, error: 'Choose two different table orders.' }
    const current = dbRef.current
    const source = current.openOrders.find((item) => item.id === sourceOrderId)
    const target = current.openOrders.find((item) => item.id === targetOrderId)
    if (!source || !target) return { ok: false, error: 'Both open table orders must exist.' }
    if (source.storeId !== target.storeId) return { ok: false, error: 'Orders must belong to the same store.' }
    const actorResult = requireActor(source.storeId)
    if (!actorResult.ok) return actorResult
    const store = current.stores.find((item) => item.id === target.storeId)
    if (!store) return { ok: false, error: 'Store not found.' }
    const items = [
      ...target.items,
      ...source.items.map((item) => ({ ...item, lineId: uid('line') })),
    ]
    const discount = round(target.discount + source.discount)
    const undiscounted = computeTotals(items, store.settings)
    if (discount > undiscounted.total) return { ok: false, error: 'Combined discounts exceed the new order total.' }
    const updated: OpenOrder = {
      ...target,
      items,
      ...computeTotals(items, store.settings, discount),
      discount,
      guests: target.guests !== undefined && source.guests !== undefined &&
        target.guests + source.guests <= 50 ? target.guests + source.guests : target.guests,
      updatedAt: new Date().toISOString(),
    }
    commitDb((prev) => addLog({
      ...prev,
      openOrders: prev.openOrders
        .filter((item) => item.id !== source.id)
        .map((item) => item.id === target.id ? updated : item),
    }, actorResult.actor, {
      storeId: target.storeId,
      action: 'edited',
      entity: 'order',
      entityId: target.id,
      summary: `Merged ${source.tableName} into ${target.tableName}`,
      before: { sourceTable: source.tableName, targetTable: target.tableName, itemCount: target.items.length },
      after: { sourceTable: '', targetTable: target.tableName, itemCount: updated.items.length, total: updated.total },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const cancelOpenOrder = useCallback<AppContextValue['cancelOpenOrder']>(
    async (orderId, managerPin) => {
      const initial = dbRef.current.openOrders.find((item) => item.id === orderId)
      if (!initial) return { ok: false, error: 'Open table order not found.' }
      const actorResult = requireActor(initial.storeId)
      if (!actorResult.ok) return actorResult
      if (!managerPin.trim()) return { ok: false, error: 'An active store admin PIN is required to cancel this order.' }
      const admins = dbRef.current.users.filter((candidate) =>
        candidate.storeId === initial.storeId && candidate.role === 'admin' && candidate.active,
      )
      let verifiedAdminId: string | null = null
      for (const admin of admins) {
        if (await verifySecret(managerPin.trim(), admin.pin)) {
          verifiedAdminId = admin.id
          break
        }
      }
      if (!verifiedAdminId) return { ok: false, error: "That PIN doesn't match an active store manager." }
      const order = dbRef.current.openOrders.find((item) => item.id === orderId)
      if (!order) return { ok: false, error: 'Open table order not found.' }
      const latestActor = requireActor(order.storeId)
      if (!latestActor.ok) return latestActor
      const authorizer = dbRef.current.users.find((candidate) =>
        candidate.id === verifiedAdminId && candidate.storeId === order.storeId &&
        candidate.role === 'admin' && candidate.active,
      )
      if (!authorizer) return { ok: false, error: 'Manager authorization failed.' }
      commitDb((prev) => addLog({
        ...prev,
        openOrders: prev.openOrders.filter((item) => item.id !== order.id),
      }, authorizer, {
        storeId: order.storeId,
        action: 'voided',
        entity: 'order',
        entityId: order.id,
        summary: `Cancelled open order at ${order.tableName}`,
        before: openOrderSnapshot(order),
      }))
      return { ok: true }
    },
    [commitDb, dbRef, requireActor],
  )

  return {
    openTableOrder,
    addItemsToOpenOrder,
    sendToKitchen,
    payOpenOrder,
    moveOrderToTable,
    mergeTableOrders,
    cancelOpenOrder,
  }
}

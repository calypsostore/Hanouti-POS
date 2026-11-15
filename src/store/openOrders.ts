import { useCallback } from 'react'
import type { OpenOrder, Order, OrderItem, OrderItemStatus } from '../types'
import { computeTotals } from '../lib/pricing'
import { round } from '../lib/pricing-utils'
import { uid } from '../lib/utils'
import { verifySecret } from '../lib/hash'
import { addLog } from './audit'
import { can } from '../lib/permissions'
import { guestCountError } from '../lib/tableService'
import { openShiftForStaff } from '../lib/registerShifts'
import { buildUpdatedOpenOrder, openOrderSnapshot } from './openOrderHelpers'
import { resolveOpenOrderItems } from '../lib/openOrderItems'
import { canTransitionStationItem } from '../lib/orderItemLifecycle'
import { handoverOpenOrder } from '../lib/shiftCash'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

const recordedOrderFromOpenOrder = (
  openOrder: OpenOrder,
  previous: Order | undefined,
  number: number,
  shiftId = openOrder.shiftId,
): Order => ({
  id: previous?.id ?? uid('ord'),
  storeId: openOrder.storeId,
  number,
  items: openOrder.items,
  subtotal: openOrder.subtotal,
  tax: openOrder.tax,
  service: openOrder.service,
  discount: openOrder.discount,
  total: openOrder.total,
  channel: 'dine-in',
  tableId: openOrder.tableId,
  tableName: openOrder.tableName,
  sectionId: openOrder.sectionId,
  sectionName: openOrder.sectionName,
  guests: openOrder.guests,
  status: 'recorded',
  paymentMethod: 'unpaid',
  shiftId,
  staffId: openOrder.staffId,
  staffName: openOrder.staffName,
  ownerStaffId: openOrder.staffId,
  ownerStaffName: openOrder.staffName,
  note: openOrder.note,
  createdAt: previous?.createdAt ?? openOrder.createdAt,
  tableHistory: openOrder.tableHistory,
})

export function useOpenOrdersSlice(
  dependencies: StoreSliceDependencies,
  createOrder: AppContextValue['createOrder'],
) {
  const { dbRef, commitDb, requireActor, requireCapability } = dependencies

  const openTableOrder = useCallback<AppContextValue['openTableOrder']>((storeId, tableId, guests, requestedTableName) => {
    const actorResult = requireActor(storeId)
    if (!actorResult.ok) return actorResult
    const current = dbRef.current
    const shift = openShiftForStaff(current, storeId, actorResult.actor.id)
    const store = current.stores.find((item) => item.id === storeId)
    if (!store?.settings.features.tables) return { ok: false, error: 'Tables are disabled for this store.' }
    const manualTables = store.settings.tableMode === 'manual'
    const table = tableId
      ? current.tables.find((item) => item.id === tableId && item.storeId === storeId && item.active)
      : undefined
    const tableName = manualTables ? requestedTableName?.trim() : table?.name
    if (manualTables) {
      if (tableId || !tableName || tableName.length > 60) {
        return { ok: false, error: 'Enter a table name up to 60 characters.' }
      }
    } else if (!table) {
      return { ok: false, error: 'Choose an active table from this store.' }
    }
    if (current.openOrders.some((order) =>
      order.storeId === storeId && (table ? order.tableId === table.id : order.tableName.toLowerCase() === tableName?.toLowerCase()),
    )) {
      return { ok: false, error: 'This table already has an open order.' }
    }
    if (store.settings.requireShiftForOrders && !shift) {
      return { ok: false, error: 'Open your shift before taking table orders.' }
    }
    const guestsError = guestCountError(guests, store.settings.guestRequirement)
    if (guestsError) return { ok: false, error: guestsError }
    const actor = actorResult.actor
    const now = new Date().toISOString()
    const number = [...current.orders, ...current.openOrders]
      .filter((item) => item.storeId === storeId)
      .reduce((max, item) => Math.max(max, item.number), 1000) + 1
    const order: OpenOrder = {
      id: uid('open'),
      storeId,
      number,
      shiftId: shift?.id,
      tableHistory: [{
        id: uid('evt'),
        type: 'opened',
        actorId: actorResult.actor.id,
        actorName: actorResult.actor.name,
        at: now,
        details: tableName ?? 'Table',
      }],
      tableId: table?.id,
      tableName: tableName ?? 'Table',
      sectionId: table?.sectionId,
      sectionName: table?.sectionId
        ? current.sections.find((section) => section.id === table.sectionId)?.name
        : undefined,
      guests: store.settings.guestRequirement === 'off' ? undefined : guests,
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
      summary: `Opened ${order.tableName}`,
      after: { tableName: order.tableName, guests: guests ?? 0 },
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
      const store = current.stores.find((item) => item.id === order.storeId)
      if (!store) return { ok: false, error: 'Store not found.' }
      const shift = openShiftForStaff(current, order.storeId, actorResult.actor.id)
      if (store?.settings.requireShiftForOrders && !shift) {
        return { ok: false, error: 'Open your shift before adding items to table orders.' }
      }
      if (!Array.isArray(items)) return { ok: false, error: 'The order items are invalid.' }
      if (!items.length && discount === undefined && note === undefined) {
        return { ok: false, error: 'Add items or make a change before saving.' }
      }
      const result = buildUpdatedOpenOrder(order, items, discount, note, actorResult.actor, current)
      if (!result.ok) return result
      const recordedOrder = order.recordedOrderId
        ? current.orders.find((item) => item.id === order.recordedOrderId)
        : undefined
      commitDb((prev) => addLog({
        ...prev,
        openOrders: prev.openOrders.map((item) => item.id === order.id ? result.order : item),
        orders: recordedOrder
          ? prev.orders.map((item) => item.id === recordedOrder.id
              ? recordedOrderFromOpenOrder(result.order, recordedOrder, recordedOrder.number, shift?.id)
              : item)
          : prev.orders,
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

  const sendToStations = useCallback<AppContextValue['sendToStations']>(
    (orderId) => {
      const current = dbRef.current
      const order = current.openOrders.find((item) => item.id === orderId)
      if (!order) return { ok: false, error: 'Open table order not found.' }
      const actorResult = requireActor(order.storeId)
      if (!actorResult.ok) return actorResult
      const store = current.stores.find((item) => item.id === order.storeId)
      const shift = openShiftForStaff(current, order.storeId, actorResult.actor.id)
      if (store?.settings.requireShiftForOrders && !shift) {
        return { ok: false, error: 'Open your shift before sending table items to stations.' }
      }
      if (!store) return { ok: false, error: 'Store not found.' }
      const unsent = order.items.flatMap((item) => {
        if (item.status !== 'draft') return []
        const product = current.products.find((candidate) =>
          candidate.id === item.productId && candidate.storeId === order.storeId,
        )
        const category = product
          ? current.categories.find((candidate) =>
              candidate.id === product.categoryId && candidate.storeId === order.storeId,
            )
          : undefined
        const stationId = item.stationId ?? (product?.stationId === null
          ? undefined
          : product?.stationId ?? category?.stationId)
        return stationId && current.stations.some((station) => station.id === stationId && station.storeId === order.storeId)
          ? [{ ...item, stationId }]
          : []
      })
      if (!unsent.length) return { ok: true, order, items: [] }
      const sentAt = new Date().toISOString()
      const sentIds = new Set(unsent.map((item) => item.lineId))
      const updated: OpenOrder = {
        ...order,
        items: order.items.map((item) => sentIds.has(item.lineId)
          ? {
              ...item,
              stationId: unsent.find((sent) => sent.lineId === item.lineId)?.stationId,
              sentAt,
              updatedAt: sentAt,
              status: 'sent',
            }
          : item),
        updatedAt: sentAt,
      }
      commitDb((prev) => addLog({
        ...prev,
        openOrders: prev.openOrders.map((item) => item.id === order.id ? updated : item),
        orders: order.recordedOrderId
          ? prev.orders.map((item) => item.id === order.recordedOrderId
              ? recordedOrderFromOpenOrder(updated, item, item.number, shift?.id)
              : item)
          : prev.orders,
      }, actorResult.actor, {
        storeId: order.storeId,
        action: 'edited',
        entity: 'order',
        entityId: order.id,
        summary: `Sent ${unsent.length} item${unsent.length === 1 ? '' : 's'} from ${order.tableName} to stations`,
        before: { unsentItems: order.items.filter((item) => item.status === 'draft').length },
        after: { sentItems: unsent.length, sentAt },
      }))
      return {
        ok: true,
        order: updated,
        items: updated.items.filter((item) => sentIds.has(item.lineId)),
      }
    },
    [commitDb, dbRef, requireActor],
  )

  const updateOpenOrderItem = useCallback<AppContextValue['updateOpenOrderItem']>((orderId, lineId, patch) => {
    const current = dbRef.current
    const order = current.openOrders.find((item) => item.id === orderId)
    if (!order) return { ok: false, error: 'Open table order not found.' }
    const actorResult = requireActor(order.storeId)
    if (!actorResult.ok) return actorResult
    const item = order.items.find((candidate) => candidate.lineId === lineId)
    if (!item) return { ok: false, error: 'Table item not found.' }
    if (item.status !== 'draft') return { ok: false, error: 'Only draft items can be edited.' }
    if (patch.note !== undefined && (typeof patch.note !== 'string' || patch.note.trim().length > 240)) {
      return { ok: false, error: 'Item notes must be 240 characters or fewer.' }
    }
    if (patch.qty !== undefined && (!Number.isFinite(patch.qty) || patch.qty < 0)) {
      return { ok: false, error: 'Enter a valid item quantity.' }
    }
    const store = current.stores.find((candidate) => candidate.id === order.storeId)
    if (!store) return { ok: false, error: 'Store not found.' }
    const editedAt = new Date().toISOString()
    let updatedItem: OrderItem | undefined = item
    if (patch.qty === 0) {
      updatedItem = undefined
    } else if (patch.qty !== undefined || patch.note !== undefined) {
      const resolved = resolveOpenOrderItems(current.products, store, [{
        ...item,
        qty: patch.qty ?? item.qty,
        note: patch.note ?? item.note,
      }])
      if (!resolved.ok) return resolved
      updatedItem = {
        ...resolved.items[0],
        lineId,
        stationId: item.stationId,
        status: 'draft',
        addedAt: item.addedAt,
        updatedAt: editedAt,
        addedById: item.addedById,
        addedByName: item.addedByName,
      }
    }
    const items = order.items.flatMap((candidate) =>
      candidate.lineId === lineId ? updatedItem ? [updatedItem] : [] : [candidate],
    )
    const totals = computeTotals(items.filter((candidate) => candidate.status !== 'void'), store.settings, order.discount)
    const updated = { ...order, items, ...totals, updatedAt: editedAt }
    commitDb((prev) => ({
      ...prev,
      openOrders: prev.openOrders.map((candidate) => candidate.id === orderId ? updated : candidate),
      orders: order.recordedOrderId
        ? prev.orders.map((recorded) => recorded.id === order.recordedOrderId
            ? recordedOrderFromOpenOrder(updated, recorded, recorded.number)
            : recorded)
        : prev.orders,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const setOpenOrderItemStatus = useCallback<AppContextValue['setOpenOrderItemStatus']>((orderId, lineId, status: OrderItemStatus) => {
    const order = dbRef.current.openOrders.find((candidate) => candidate.id === orderId)
    if (!order) return { ok: false, error: 'Open table order not found.' }
    const actorResult = requireCapability(order.storeId, 'viewStation')
    if (!actorResult.ok) return actorResult
    if (!['sent', 'preparing', 'ready', 'served'].includes(status)) {
      return { ok: false, error: 'Choose a valid station status.' }
    }
    const item = order.items.find((candidate) => candidate.lineId === lineId)
    if (!item || !item.status || item.status === 'draft' || item.status === 'void' || !item.stationId) {
      return { ok: false, error: 'This item is not on a station ticket.' }
    }
    if (!canTransitionStationItem(item.status, status)) {
      return { ok: false, error: `Cannot move a ${item.status} item to ${status}.` }
    }
    const updatedAt = new Date().toISOString()
    const updated: OpenOrder = {
      ...order,
      items: order.items.map((candidate) => candidate.lineId === lineId
        ? {
            ...candidate,
            status,
            updatedAt,
            ...(status === 'sent' ? { sentAt: updatedAt } : {}),
          }
        : candidate),
      updatedAt,
    }
    commitDb((prev) => ({
      ...prev,
      openOrders: prev.openOrders.map((candidate) => candidate.id === orderId ? updated : candidate),
      orders: order.recordedOrderId
        ? prev.orders.map((recorded) => recorded.id === order.recordedOrderId
            ? recordedOrderFromOpenOrder(updated, recorded, recorded.number)
            : recorded)
        : prev.orders,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const voidSentOrderItem = useCallback<AppContextValue['voidSentOrderItem']>((orderId, lineId, reason) => {
    const order = dbRef.current.openOrders.find((candidate) => candidate.id === orderId)
    if (!order) return { ok: false, error: 'Open table order not found.' }
    const actorResult = requireCapability(order.storeId, 'voidOrders')
    if (!actorResult.ok) return actorResult
    const item = order.items.find((candidate) => candidate.lineId === lineId)
    if (!item || item.status === 'draft' || item.status === 'void') {
      return { ok: false, error: 'Only a sent item can be voided here.' }
    }
    const normalizedReason = reason.trim().slice(0, 240)
    if (!normalizedReason) return { ok: false, error: 'Enter a reason for voiding this sent item.' }
    const voidedItem: OrderItem = {
      ...item,
      status: 'void',
      voidReason: normalizedReason,
      updatedAt: new Date().toISOString(),
    }
    const store = dbRef.current.stores.find((candidate) => candidate.id === order.storeId)
    if (!store) return { ok: false, error: 'Store not found.' }
    const updated: OpenOrder = {
      ...order,
      items: order.items.map((candidate) => candidate.lineId === lineId ? voidedItem : candidate),
      ...computeTotals(order.items.filter((candidate) => candidate.lineId !== lineId && candidate.status !== 'void'), store.settings, order.discount),
      updatedAt: new Date().toISOString(),
    }
    commitDb((prev) => addLog({
      ...prev,
      openOrders: prev.openOrders.map((candidate) => candidate.id === orderId ? updated : candidate),
      orders: order.recordedOrderId
        ? prev.orders.map((recorded) => recorded.id === order.recordedOrderId
            ? recordedOrderFromOpenOrder(updated, recorded, recorded.number)
            : recorded)
        : prev.orders,
    }, actorResult.actor, {
      storeId: order.storeId,
      action: 'voided',
      entity: 'order',
      entityId: orderId,
      summary: `Voided sent ${item.name} at ${order.tableName}`,
      before: { itemId: lineId, status: item.status ?? 'draft' },
      after: { itemId: lineId, status: 'void', reason: normalizedReason },
    }))
    return { ok: true, order: updated, item: voidedItem }
  }, [commitDb, dbRef, requireCapability])

  const payOpenOrder = useCallback<AppContextValue['payOpenOrder']>(
    (orderId, paymentMethod, customerId) => {
      const order = dbRef.current.openOrders.find((item) => item.id === orderId)
      if (!order) return { ok: false, error: 'Open table order not found.' }
      const actorResult = requireActor(order.storeId)
      if (!actorResult.ok) return actorResult
      const paid = createOrder({
        items: order.items.filter((item) => item.status !== 'void'),
        channel: 'dine-in',
        tableId: order.tableId,
        tableName: order.tableName,
        guests: order.guests,
        paymentMethod,
        customerId,
        discount: order.discount,
        note: order.note,
      })
      if (!paid.ok) return paid
      const actor = requireActor(order.storeId)
      if (!actor.ok) return actor
      const paidAt = new Date().toISOString()
      const paymentHistory = [
        ...(order.tableHistory ?? []),
        {
          id: uid('evt'),
          type: 'payment' as const,
          actorId: actor.actor.id,
          actorName: actor.actor.name,
          at: paidAt,
          details: `${paymentMethod} · ${paid.order.total.toFixed(3)} DT`,
        },
        {
          id: uid('evt'),
          type: 'closed' as const,
          actorId: actor.actor.id,
          actorName: actor.actor.name,
          at: paidAt,
        },
      ]
      commitDb((prev) => addLog({
        ...prev,
        openOrders: prev.openOrders.filter((item) => item.id !== order.id),
        orders: [
          ...prev.orders
            .filter((item) => item.id !== order.recordedOrderId && item.id !== paid.order.id)
            .map((item) => item),
          {
            ...paid.order,
            ownerStaffId: order.staffId,
            ownerStaffName: order.staffName,
            tableHistory: paymentHistory,
          },
        ],
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

  const handoverTables = useCallback<AppContextValue['handoverTables']>((storeId, orderIds, targetStaffId) => {
    const actorResult = requireActor(storeId)
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    const current = dbRef.current
    const selected = [...new Set(orderIds)].map((id) =>
      current.openOrders.find((order) => order.id === id && order.storeId === storeId),
    )
    if (!selected.length || selected.some((order) => !order)) {
      return { ok: false, error: 'Select valid open tables from this store.' }
    }
    if (!can(actor, 'manageTables') && !can(actor, 'closeShift')) {
      return { ok: false, error: 'You do not have permission to hand over tables.' }
    }
    if (!can(actor, 'manageTables') && selected.some((order) => order?.staffId !== actor.id)) {
      return { ok: false, error: 'You can only hand over tables you own.' }
    }
    let target: { id: string; name: string } | undefined
    if (targetStaffId) {
      const staff = current.users.find((candidate) =>
        candidate.id === targetStaffId && candidate.storeId === storeId && candidate.active,
      )
      if (!staff || !openShiftForStaff(current, storeId, staff.id)) {
        return { ok: false, error: 'Choose a colleague with an open shift.' }
      }
      target = { id: staff.id, name: staff.name }
    }
    const at = new Date().toISOString()
    const updates = new Map<string, OpenOrder>()
    for (const order of selected) {
      if (order) updates.set(order.id, handoverOpenOrder(order, target, actor, at))
    }
    commitDb((prev) => {
      let next = {
        ...prev,
        openOrders: prev.openOrders.map((order) => updates.get(order.id) ?? order),
      }
      for (const order of selected) {
        if (!order) continue
        const updated = updates.get(order.id)
        if (!updated) continue
        next = addLog(next, actor, {
          storeId,
          action: 'edited',
          entity: 'table',
          entityId: order.id,
          summary: `Handed over ${order.tableName} to ${target?.name ?? 'Unassigned (handover)'}`,
          before: { staffId: order.staffId, staffName: order.staffName },
          after: { staffId: updated.staffId, staffName: updated.staffName },
        })
      }
      return next
    })
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const takeOverTables = useCallback<AppContextValue['takeOverTables']>((orderIds) => {
    const current = dbRef.current
    const first = current.openOrders.find((order) => orderIds.includes(order.id))
    if (!first) return { ok: false, error: 'No open handover tables were selected.' }
    const actorResult = requireActor(first.storeId)
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    if (!openShiftForStaff(current, first.storeId, actor.id)) {
      return { ok: false, error: 'Open your shift before taking over tables.' }
    }
    if (!can(actor, 'takeOverTables')) {
      return { ok: false, error: 'You do not have permission to take over tables.' }
    }
    const selected = [...new Set(orderIds)].map((id) =>
      current.openOrders.find((order) =>
        order.id === id && order.storeId === first.storeId && order.staffId === 'unassigned-handover',
      ),
    )
    if (!selected.length || selected.some((order) => !order)) {
      return { ok: false, error: 'Select unassigned handover tables from this store.' }
    }
    const at = new Date().toISOString()
    const updates = new Map<string, OpenOrder>()
    for (const order of selected) {
      if (order) updates.set(order.id, handoverOpenOrder(
        order,
        { id: actor.id, name: actor.name },
        actor,
        at,
      ))
    }
    commitDb((prev) => addLog({
      ...prev,
      openOrders: prev.openOrders.map((order) => updates.get(order.id) ?? order),
    }, actor, {
      storeId: first.storeId,
      action: 'edited',
      entity: 'table',
      summary: `Took over ${selected.length} handover table${selected.length === 1 ? '' : 's'}`,
      after: { orderIds: [...updates.keys()], staffId: actor.id },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const recordOpenOrder = useCallback<AppContextValue['recordOpenOrder']>((orderId) => {
    const current = dbRef.current
    const order = current.openOrders.find((item) => item.id === orderId)
    if (!order) return { ok: false, error: 'Open table order not found.' }
    const actorResult = requireActor(order.storeId)
    if (!actorResult.ok) return actorResult
    if (!order.items.some((item) => item.status !== 'void')) return { ok: false, error: 'Add items before recording this table order.' }
    const store = current.stores.find((item) => item.id === order.storeId)
    if (!store?.settings.features.tables) return { ok: false, error: 'Tables are disabled for this store.' }
    if (order.tableId) {
      if (!current.tables.some((table) =>
        table.id === order.tableId && table.storeId === order.storeId && table.active,
      )) return { ok: false, error: 'Choose an active table from this store.' }
    } else if (!order.tableName.trim() || order.tableName.length > 60) {
      return { ok: false, error: 'Enter a valid table name.' }
    }
    const guestsError = guestCountError(order.guests, store.settings.guestRequirement)
    if (guestsError) return { ok: false, error: guestsError }
    const shift = openShiftForStaff(current, order.storeId, actorResult.actor.id)
    if (store.settings.requireShiftForOrders && !shift) {
      return { ok: false, error: 'Open your shift before recording table orders.' }
    }
    const previous = order.recordedOrderId
      ? current.orders.find((item) => item.id === order.recordedOrderId)
      : undefined
    if (order.recordedOrderId && !previous) {
      return { ok: false, error: 'The recorded table order could not be found. Save the table order again.' }
    }
    const number = previous?.number ?? order.number
    const recorded = recordedOrderFromOpenOrder(order, previous, number, shift?.id ?? order.shiftId)
    commitDb((prev) => addLog({
      ...prev,
      openOrders: prev.openOrders.map((item) =>
        item.id === order.id ? { ...item, recordedOrderId: recorded.id } : item,
      ),
      orders: previous
        ? prev.orders.map((item) => item.id === previous.id ? recorded : item)
        : [recorded, ...prev.orders],
    }, actorResult.actor, {
      storeId: order.storeId,
      action: previous ? 'edited' : 'created',
      entity: 'order',
      entityId: recorded.id,
      summary: `${previous ? 'Updated' : 'Recorded'} unpaid table order #${recorded.number} at ${order.tableName}`,
      before: previous ? { status: previous.status, total: previous.total } : undefined,
      after: { status: 'recorded', tableName: order.tableName, total: order.total },
    }))
    return { ok: true, order: recorded }
  }, [commitDb, dbRef, requireActor])

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
    const updated = {
      ...order,
      tableId: table.id,
      tableName: table.name,
      sectionId: table.sectionId,
      sectionName: current.sections.find((section) => section.id === table.sectionId)?.name,
      updatedAt: new Date().toISOString(),
      tableHistory: [
        ...(order.tableHistory ?? []),
        {
          id: uid('evt'),
          type: 'moved' as const,
          actorId: actorResult.actor.id,
          actorName: actorResult.actor.name,
          at: new Date().toISOString(),
          details: `${order.tableName} → ${table.name}`,
        },
      ],
    }
    commitDb((prev) => addLog({
      ...prev,
      openOrders: prev.openOrders.map((item) => item.id === order.id ? updated : item),
      orders: order.recordedOrderId
        ? prev.orders.map((item) => item.id === order.recordedOrderId
            ? {
                ...item,
                tableId: table.id,
                tableName: table.name,
                sectionId: table.sectionId,
                sectionName: current.sections.find((section) => section.id === table.sectionId)?.name,
              }
            : item)
        : prev.orders,
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
    const undiscounted = computeTotals(items.filter((item) => item.status !== 'void'), store.settings)
    if (discount > undiscounted.total) return { ok: false, error: 'Combined discounts exceed the new order total.' }
    const recordedOrderId = target.recordedOrderId ?? source.recordedOrderId
    const updated: OpenOrder = {
      ...target,
      recordedOrderId,
      tableHistory: [
        ...(target.tableHistory ?? []),
        ...(source.tableHistory ?? []),
        {
          id: uid('evt'),
          type: 'merged',
          actorId: actorResult.actor.id,
          actorName: actorResult.actor.name,
          at: new Date().toISOString(),
          details: `${source.tableName} → ${target.tableName}`,
        },
      ],
      items,
      ...computeTotals(items.filter((item) => item.status !== 'void'), store.settings, discount),
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
      orders: [
        ...prev.orders
        .filter((item) => item.id !== source.recordedOrderId || item.id === recordedOrderId)
          .map((item) => item.id === recordedOrderId
            ? recordedOrderFromOpenOrder(updated, item, item.number)
            : item),
      ],
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
        candidate.storeId === initial.storeId && candidate.active &&
        (candidate.role === 'admin' || can(candidate, 'approveOverrides')),
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
        candidate.active && (candidate.role === 'admin' || can(candidate, 'approveOverrides')),
      )
      if (!authorizer) return { ok: false, error: 'Manager authorization failed.' }
      commitDb((prev) => addLog({
        ...prev,
        openOrders: prev.openOrders.filter((item) => item.id !== order.id),
        orders: order.recordedOrderId
          ? prev.orders.filter((item) => item.id !== order.recordedOrderId)
          : prev.orders,
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
    recordOpenOrder,
    addItemsToOpenOrder,
    sendToStations,
    updateOpenOrderItem,
    setOpenOrderItemStatus,
    voidSentOrderItem,
    payOpenOrder,
    handoverTables,
    takeOverTables,
    moveOrderToTable,
    mergeTableOrders,
    cancelOpenOrder,
  }
}

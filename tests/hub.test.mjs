import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { createHubServer } from '../hub/src/server.ts'
import { startVirtualPrinter } from '../hub/src/printers/virtual-printer.ts'
import { hashSecret } from '../hub/src/auth.ts'

async function availablePort() {
  const server = createServer()
  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not reserve a local test port.')
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()))
  return address.port
}

test('hub scopes and persists APIs, protects credentials, and prints to the mock TCP device', async () => {
  const original = {
    host: process.env.HUB_HOST, port: process.env.HUB_PORT, data: process.env.HUB_DATA_DIR,
    dist: process.env.HUB_DIST_DIR, virtualPort: process.env.HUB_VIRTUAL_PRINTER_PORT,
  }
  const data = await mkdtemp(join(tmpdir(), '7anouti-hub-test-'))
  const httpPort = await availablePort()
  process.env.HUB_HOST = '127.0.0.1'
  process.env.HUB_PORT = String(httpPort)
  process.env.HUB_DATA_DIR = data
  process.env.HUB_DIST_DIR = resolve('dist')
  process.env.HUB_VIRTUAL_PRINTER_PORT = '0'
  const mock = await startVirtualPrinter(0)
  const mockAddress = mock.address()
  if (!mockAddress || typeof mockAddress === 'string') throw new Error('Could not bind a virtual printer.')
  let runtime
  const sockets = []
  try {
    runtime = await createHubServer()
    const base = `http://127.0.0.1:${httpPort}`
    assert.equal((await fetch(`${base}/health`)).status, 200)
    const qr = await fetch(`${base}/api/status/qr`)
    assert.match(await qr.text(), /<svg/)
    assert.equal((await fetch(`${base}/api/virtual/preview`)).status, 404)
    const boardPage = await fetch(`${base}/kitchen`)
    assert.match(await boardPage.text(), /Pair this screen/)
    const stationPage = await fetch(`${base}/station/kitchen`)
    assert.match(await stationPage.text(), /Station board/)
    const deniedOrigin = await fetch(`${base}/health`, { headers: { Origin: 'https://outside.example' } })
    assert.equal(deniedOrigin.status, 403)
    const oversized = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeCode: 'test-cafe', username: 'owner', secret: 'x'.repeat(1_100_000) }),
    })
    assert.equal(oversized.status, 413)
    const setup = await fetch(`${base}/api/auth/setup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeName: 'Test Cafe', storeCode: 'test-cafe', username: 'owner', password: 'a-secure-password', pin: '8426' }),
    })
    assert.equal(setup.status, 201)
    const owner = await setup.json()
    const auth = { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' }
    const snapshot = await fetch(`${base}/api/sync/snapshot`, { headers: auth })
    const initialData = await snapshot.json()
    assert.equal(initialData.storeId, owner.actor.storeId)
    assert.equal(initialData.collections.stores[0].id, owner.actor.storeId)
    assert.equal(initialData.collections.stores[0].slug, 'test-cafe')
    assert.equal(initialData.collections.users[0].email, 'owner@local.invalid')
    assert.equal(initialData.collections.users[0].password, undefined)
    assert.equal(initialData.collections.users[0].pin, undefined)
    const staffUser = {
      id: 'cashier', storeId: owner.actor.storeId, name: 'Cashier', username: 'cashier',
      password: hashSecret('cashier-password'), pin: hashSecret('2266'), role: 'staff',
      active: true, permissions: { register: false, openShift: true, closeShift: false },
    }
    const activeManager = {
      id: 'active-manager', storeId: owner.actor.storeId, name: 'Active manager',
      password: hashSecret('manager-password'), pin: hashSecret('4477'), role: 'manager',
      active: true, permissions: { approveOverrides: true, voidOrders: true, overrideStock: true },
    }
    const inactiveManager = {
      id: 'inactive-manager', storeId: owner.actor.storeId, name: 'Inactive manager',
      password: hashSecret('inactive-manager-password'), pin: hashSecret('6633'), role: 'manager',
      active: false, permissions: { approveOverrides: true, voidOrders: true, overrideStock: true },
    }
    const wrongPin = await fetch(`${base}/api/auth/verify-pin`, {
      method: 'POST', headers: auth, body: JSON.stringify({ pin: '1234' }),
    })
    assert.equal((await wrongPin.json()).verified, false)
    const correctPin = await fetch(`${base}/api/auth/verify-pin`, {
      method: 'POST', headers: auth, body: JSON.stringify({ pin: '8426' }),
    })
    assert.equal((await correctPin.json()).verified, true)
    const update = {
      opId: 'sync-one', deviceId: 'phone-one', storeId: owner.actor.storeId, baseSeq: 1,
      ops: [
        { kind: 'put', collection: 'users', id: staffUser.id, document: staffUser },
        { kind: 'put', collection: 'users', id: activeManager.id, document: activeManager },
        { kind: 'put', collection: 'users', id: inactiveManager.id, document: inactiveManager },
        { kind: 'put', collection: 'stores', id: owner.actor.storeId, document: {
          ...initialData.collections.stores[0],
          settings: {
            ...initialData.collections.stores[0].settings,
            tableMode: 'tables_only',
            features: { ...initialData.collections.stores[0].settings.features, tables: true },
          },
        } },
        { kind: 'put', collection: 'printers', id: 'mock-printer', document: {
          id: 'mock-printer', storeId: owner.actor.storeId, name: 'Virtual', connection: 'hub-tcp',
          host: '127.0.0.1', port: mockAddress.port, baudRate: 9600, paperWidth: 58,
          codepage: 'cp1252', cutMode: 'none', copies: 1, enabled: true,
        } },
        { kind: 'put', collection: 'stations', id: 'kitchen', document: {
          id: 'kitchen', storeId: owner.actor.storeId, name: 'Kitchen', active: true, screen: true,
        } },
        { kind: 'put', collection: 'stations', id: 'bar', document: {
          id: 'bar', storeId: owner.actor.storeId, name: 'Bar', active: true, screen: true,
        } },
        { kind: 'put', collection: 'products', id: 'soup', document: {
          id: 'soup', storeId: owner.actor.storeId, categoryId: 'food', name: 'Soup', price: 5,
          active: true, soldByWeight: false, variants: [], modifiers: [], stationId: 'kitchen',
        } },
        { kind: 'put', collection: 'products', id: 'tea', document: {
          id: 'tea', storeId: owner.actor.storeId, categoryId: 'drinks', name: 'Tea', price: 3,
          active: true, soldByWeight: false, variants: [], modifiers: [], stationId: 'bar',
        } },
        { kind: 'put', collection: 'tables', id: 'table-1', document: {
          id: 'table-1', storeId: owner.actor.storeId, name: 'T1', active: true,
        } },
        { kind: 'put', collection: 'tables', id: 'table-2', document: {
          id: 'table-2', storeId: owner.actor.storeId, name: 'T2', active: true,
        } },
        { kind: 'put', collection: 'shifts', id: 'shift-one', document: {
          id: 'shift-one', storeId: owner.actor.storeId, userId: staffUser.id,
          date: '2026-11-15', startTime: '09:00', endTime: '17:00',
          createdBy: owner.actor.userId, createdAt: new Date().toISOString(),
        } },
        { kind: 'put', collection: 'registerSessions', id: 'owner-register', document: {
          id: 'owner-register', storeId: owner.actor.storeId, status: 'open',
          openedAt: new Date().toISOString(), openedById: owner.actor.userId,
          openedByName: 'Owner', staffId: owner.actor.userId, openingCash: 0,
        } },
        { kind: 'put', collection: 'stationDevices', id: 'kitchen-device', document: {
          id: 'kitchen-device', storeId: owner.actor.storeId, name: 'Kitchen screen',
          stationIds: ['kitchen'], active: true, pairingCode: '123456',
          pairingCodeExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        } },
      ],
    }
    const synced = await fetch(`${base}/api/sync`, { method: 'POST', headers: auth, body: JSON.stringify(update) })
    assert.equal(synced.status, 200, await synced.text())
    const invalidYieldSettings = await fetch(`${base}/api/sync`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        opId: 'invalid-yield-settings',
        deviceId: 'owner-device',
        storeId: owner.actor.storeId,
        baseSeq: 1,
        ops: [{
          kind: 'put',
          collection: 'stores',
          id: owner.actor.storeId,
          document: {
            ...update.ops.find((operation) => operation.collection === 'stores').document,
            settings: {
              ...update.ops.find((operation) => operation.collection === 'stores').document.settings,
              inventoryYieldTracking: {
                enabled: true,
                trackers: [{
                  inventoryItemId: 'missing-inventory',
                  referenceQuantity: 1000,
                  servingsMin: 5,
                  servingsMax: 10,
                  productIds: ['tea'],
                  categoryIds: [],
                }],
              },
            },
          },
        }],
      }),
    })
    assert.equal(invalidYieldSettings.status, 400)
    assert.match((await invalidYieldSettings.json()).error, /active inventory/i)
    const verifyAuthorizationPin = async (pin, purpose) => fetch(
      `${base}/api/auth/verify-authorization-pin`,
      { method: 'POST', headers: auth, body: JSON.stringify({ pin, storeId: owner.actor.storeId, purpose }) },
    )
    for (const purpose of ['void-order', 'cancel-table', 'override-stock']) {
      const verified = await verifyAuthorizationPin('4477', purpose)
      const result = await verified.json()
      assert.equal(result.verified, true, `${purpose} accepts active manager PIN`)
      assert.equal(result.confirmer.id, activeManager.id)
    }
    const inactivePin = await (await verifyAuthorizationPin('6633', 'void-order')).json()
    assert.equal(inactivePin.verified, false, 'inactive manager PIN cannot authorize')
    const unauthorizedPin = await (await verifyAuthorizationPin('2266', 'void-order')).json()
    assert.equal(unauthorizedPin.verified, false, 'staff PIN without void permission cannot authorize')
    const orderUpdate = {
      opId: 'sync-order-one', deviceId: 'phone-one', storeId: owner.actor.storeId, baseSeq: 2,
      ops: [{ kind: 'put', collection: 'openOrders', id: 'order-one', document: {
        id: 'order-one', storeId: owner.actor.storeId, number: 12, shiftId: 'shift-one', tableId: 'table-1',
        tableName: 'T1', status: 'open', discount: 0, items: [
          { lineId: 'kitchen-item', productId: 'soup', stationId: 'bar', status: 'sent', name: 'Forged soup', price: 0, qty: 1 },
          { lineId: 'bar-item', productId: 'tea', stationId: 'kitchen', status: 'sent', name: 'Forged tea', price: 0, qty: 1 },
        ],
      } }],
    }
    const orderSynced = await fetch(`${base}/api/sync`, { method: 'POST', headers: auth, body: JSON.stringify(orderUpdate) })
    assert.equal(orderSynced.status, 200)
    const numberedOrder = (await (await fetch(`${base}/api/sync/snapshot`, { headers: auth })).json())
      .collections.openOrders.find((order) => order.id === 'order-one')
    assert.ok(numberedOrder.number > 0)
    assert.notEqual(numberedOrder.number, 12, 'the hub replaces a client-supplied number')
    const checkoutSync = async (id, opId) => fetch(`${base}/api/sync`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        opId,
        deviceId: 'phone-one',
        storeId: owner.actor.storeId,
        baseSeq: 3,
        ops: [{ kind: 'put', collection: 'orders', id, document: {
          id, storeId: owner.actor.storeId, number: 0, status: 'completed',
          channel: 'takeaway', paymentMethod: 'cash', discount: 0,
          clientOrderId: 'checkout-idempotency-test',
          items: [{ lineId: `${id}-line`, productId: 'tea', qty: 1 }],
        } }],
      }),
    })
    const firstCheckout = await checkoutSync('checkout-first', 'checkout-first-op')
    assert.equal(firstCheckout.status, 200, await firstCheckout.text())
    const retriedCheckout = await checkoutSync('checkout-retry', 'checkout-retry-op')
    assert.equal(retriedCheckout.status, 200, await retriedCheckout.text())
    const checkoutSnapshot = await (await fetch(`${base}/api/sync/snapshot`, { headers: auth })).json()
    assert.equal(checkoutSnapshot.collections.orders.length, 1)
    assert.equal(checkoutSnapshot.collections.orders[0].id, 'checkout-first')
    const duplicateNumber = await fetch(`${base}/api/sync`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        opId: 'duplicate-order-number',
        deviceId: 'phone-two',
        storeId: owner.actor.storeId,
        baseSeq: 4,
        ops: [{ kind: 'put', collection: 'openOrders', id: 'number-collision', document: {
          id: 'number-collision', storeId: owner.actor.storeId, number: numberedOrder.number,
          tableId: 'table-2', tableName: 'T2', status: 'open', discount: 0,
          items: [{ lineId: 'number-collision-line', productId: 'tea', qty: 1 }],
        } }],
      }),
    })
    assert.equal(duplicateNumber.status, 400)
    assert.match((await duplicateNumber.json()).error, /number is already in use/i)
    const duplicate = await fetch(`${base}/api/sync`, { method: 'POST', headers: auth, body: JSON.stringify(orderUpdate) })
    assert.equal((await duplicate.json()).duplicate, true)
    const simultaneousTableOrder = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: auth, body: JSON.stringify({
        opId: 'sync-order-two', deviceId: 'phone-two', storeId: owner.actor.storeId, baseSeq: 2,
        ops: [{ kind: 'put', collection: 'openOrders', id: 'order-two', document: {
          id: 'order-two', storeId: owner.actor.storeId, number: 13, shiftId: 'shift-one', tableId: 'table-1',
          tableName: 'T1', status: 'open', discount: 0,
          items: [{ lineId: 'phone-two-item', productId: 'tea', status: 'sent', qty: 1 }],
        } }],
      }),
    })
    assert.equal(simultaneousTableOrder.status, 200)
    const mergedSnapshot = await (await fetch(`${base}/api/sync/snapshot`, { headers: auth })).json()
    assert.equal(mergedSnapshot.collections.openOrders.length, 1)
    assert.deepEqual(
      mergedSnapshot.collections.openOrders[0].items.map((item) => item.lineId).sort(),
      ['bar-item', 'kitchen-item', 'phone-two-item'],
    )
    assert.equal(mergedSnapshot.collections.openOrders[0].staffId, owner.actor.userId)
    assert.equal(mergedSnapshot.collections.openOrders[0].shiftId, 'shift-one')
    const firstMenuEdit = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: auth, body: JSON.stringify({
        opId: 'menu-edit-one', deviceId: 'phone-one', storeId: owner.actor.storeId, baseSeq: 4,
        ops: [{ kind: 'put', collection: 'products', id: 'tea', document: {
          ...update.ops.find((op) => op.id === 'tea').document, price: 4,
        } }],
      }),
    })
    assert.equal(firstMenuEdit.status, 200)
    const staleMenuEdit = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: auth, body: JSON.stringify({
        opId: 'menu-edit-two', deviceId: 'phone-two', storeId: owner.actor.storeId, baseSeq: 4,
        ops: [{ kind: 'put', collection: 'products', id: 'tea', document: {
          ...update.ops.find((op) => op.id === 'tea').document, price: 5,
        } }],
      }),
    })
    assert.deepEqual((await staleMenuEdit.json()).conflicts.map((item) => item.label), ['Tea'])
    const paired = await fetch(`${base}/api/station/pair`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeCode: 'test-cafe', pairingCode: '123456' }),
    })
    assert.equal(paired.status, 200)
    const device = await paired.json()
    const deviceHeaders = { Authorization: `Bearer ${device.token}`, 'X-Device-Id': device.deviceId }
    const ownerSocket = new WebSocket(`ws://127.0.0.1:${httpPort}/ws`)
    const deviceSocket = new WebSocket(`ws://127.0.0.1:${httpPort}/ws`)
    sockets.push(ownerSocket, deviceSocket)
    const connectSocket = async (socket, credentials) => {
      if (socket.readyState !== WebSocket.OPEN) {
        await new Promise((resolveOpen, reject) => {
          const timer = setTimeout(() => reject(new Error(`WebSocket did not open; state=${socket.readyState}.`)), 5000)
          socket.addEventListener('open', () => { clearTimeout(timer); resolveOpen() }, { once: true })
          socket.addEventListener('error', (error) => { clearTimeout(timer); reject(error) }, { once: true })
        })
      }
      socket.send(JSON.stringify({ type: 'auth', ...credentials }))
      const event = await new Promise((resolveMessage, reject) => {
        const timer = setTimeout(() => reject(new Error('WebSocket authentication timed out.')), 5000)
        socket.addEventListener('message', (message) => { clearTimeout(timer); resolveMessage(JSON.parse(message.data)) }, { once: true })
        socket.addEventListener('error', (error) => { clearTimeout(timer); reject(error) }, { once: true })
      })
      assert.equal(event.type, 'connected')
    }
    await connectSocket(ownerSocket, { token: owner.token })
    await connectSocket(deviceSocket, { token: device.token, deviceId: device.deviceId })
    const board = await fetch(`${base}/api/stations`, { headers: deviceHeaders })
    const boardData = await board.json()
    assert.equal(boardData.stations.length, 1)
    assert.equal(boardData.orders[0].items.length, 1)
    assert.equal(boardData.orders[0].items[0].id, 'kitchen-item')
    assert.equal(boardData.orders[0].items[0].name, 'Soup')
    assert.equal(boardData.orders[0].items[0].price, 5)
    const stationUpdate = new Promise((resolveMessage, reject) => {
      ownerSocket.addEventListener('message', (message) => resolveMessage(JSON.parse(message.data)), { once: true })
      ownerSocket.addEventListener('error', reject, { once: true })
    })
    deviceSocket.send(JSON.stringify({
      type: 'station-status', orderId: 'order-one', itemId: 'kitchen-item', stationId: 'kitchen', status: 'preparing',
    }))
    const liveUpdate = await stationUpdate
    assert.equal(liveUpdate.type, 'station-status')
    assert.equal(liveUpdate.status, 'preparing')
    const staffLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeCode: 'test-cafe', username: 'cashier', secret: 'cashier-password' }),
    })
    const staff = await staffLogin.json()
    const cashierShift = {
      id: 'cashier-shift', storeId: owner.actor.storeId, userId: staffUser.id,
      date: '2026-11-16', startTime: '09:00', endTime: '17:00',
      createdBy: owner.actor.userId, createdAt: new Date().toISOString(),
    }
    const addSchedule = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: auth, body: JSON.stringify({
        opId: 'schedule-one', deviceId: 'owner-device', storeId: owner.actor.storeId, baseSeq: 0,
        ops: [{ kind: 'put', collection: 'shifts', id: cashierShift.id, document: cashierShift }],
      }),
    })
    assert.equal(addSchedule.status, 200)
    const forbiddenBackup = await fetch(`${base}/api/backup`, {
      method: 'POST', headers: { Authorization: `Bearer ${staff.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: owner.actor.storeId }),
    })
    assert.equal(forbiddenBackup.status, 403)
    const staffAuth = { Authorization: `Bearer ${staff.token}`, 'Content-Type': 'application/json' }
    const staffSnapshot = await (await fetch(`${base}/api/sync/snapshot`, { headers: staffAuth })).json()
    assert.equal(staffSnapshot.collections.stores[0].id, owner.actor.storeId)
    assert.equal(staffSnapshot.collections.registerSessions.length, 0)
    assert.equal(staffSnapshot.collections.shifts, undefined)
    const deleteSchedule = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: staffAuth, body: JSON.stringify({
        opId: 'staff-delete-schedule', deviceId: 'cashier-device', storeId: owner.actor.storeId, baseSeq: 0,
        ops: [{ kind: 'delete', collection: 'shifts', id: cashierShift.id }],
      }),
    })
    assert.equal(deleteSchedule.status, 403)
    const forgedRegister = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: staffAuth, body: JSON.stringify({
        opId: 'staff-forge-register', deviceId: 'cashier-device', storeId: owner.actor.storeId, baseSeq: 0,
        ops: [{ kind: 'put', collection: 'registerSessions', id: 'forged-register', document: {
          id: 'forged-register', storeId: owner.actor.storeId, status: 'open',
          openedAt: new Date().toISOString(), openedById: owner.actor.userId,
          openedByName: 'Owner', staffId: owner.actor.userId, openingCash: 0,
        } }],
      }),
    })
    assert.equal(forgedRegister.status, 403)
    const cashierOpenedAt = new Date().toISOString()
    const openOwnRegister = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: staffAuth, body: JSON.stringify({
        opId: 'staff-open-register', deviceId: 'cashier-device', storeId: owner.actor.storeId, baseSeq: 0,
        ops: [{ kind: 'put', collection: 'registerSessions', id: 'cashier-register', document: {
          id: 'cashier-register', storeId: owner.actor.storeId, status: 'open',
          openedAt: cashierOpenedAt, openedById: staffUser.id,
          openedByName: staffUser.name, staffId: staffUser.id, openingCash: 0,
        } }],
      }),
    })
    assert.equal(openOwnRegister.status, 200)
    const closeOwnRegister = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: staffAuth, body: JSON.stringify({
        opId: 'staff-close-register', deviceId: 'cashier-device', storeId: owner.actor.storeId, baseSeq: 0,
        ops: [{ kind: 'put', collection: 'registerSessions', id: 'cashier-register', document: {
          id: 'cashier-register', storeId: owner.actor.storeId, status: 'closed',
          openedAt: cashierOpenedAt, openedById: staffUser.id,
          openedByName: staffUser.name, staffId: staffUser.id, openingCash: 0,
          closedAt: new Date().toISOString(), closedById: staffUser.id, countedCash: 0, difference: 0,
        } }],
      }),
    })
    assert.equal(closeOwnRegister.status, 403)
    const deleteRegister = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: staffAuth, body: JSON.stringify({
        opId: 'staff-delete-register', deviceId: 'cashier-device', storeId: owner.actor.storeId, baseSeq: 0,
        ops: [{ kind: 'delete', collection: 'registerSessions', id: 'owner-register' }],
      }),
    })
    assert.equal(deleteRegister.status, 403)
    for (const status of ['preparing', 'ready', 'bumped']) {
      if (status === 'preparing') continue
      const changed = await fetch(`${base}/api/station/status`, {
        method: 'POST', headers: { ...deviceHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'order-one', itemId: 'kitchen-item', stationId: 'kitchen', status }),
      })
      assert.equal(changed.status, 200)
    }
    const bumpedBoard = await fetch(`${base}/api/stations`, { headers: deviceHeaders })
    assert.equal((await bumpedBoard.json()).orders[0].items[0].boardStatus, 'bumped')
    const teaDocument = update.ops.find((op) => op.id === 'tea').document
    const zeroStock = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: auth, body: JSON.stringify({
        opId: 'tea-positive-stock', deviceId: 'owner-device', storeId: owner.actor.storeId, baseSeq: 0,
        ops: [{ kind: 'put', collection: 'products', id: 'tea', document: {
          ...teaDocument, trackStock: true, stock: 1,
        } }],
      }),
    })
    assert.equal(zeroStock.status, 200)
    const excessTrackedStock = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: auth, body: JSON.stringify({
        opId: 'tea-excess-stock', deviceId: 'owner-device', storeId: owner.actor.storeId, baseSeq: 0,
        ops: [{ kind: 'put', collection: 'openOrders', id: 'excess-stock-order', document: {
          id: 'excess-stock-order', storeId: owner.actor.storeId, number: 76, status: 'open', discount: 0,
          items: [{ lineId: 'excess-tea', productId: 'tea', name: 'Tea', price: 1, qty: 2, status: 'draft' }],
        } }],
      }),
    })
    assert.equal(excessTrackedStock.status, 400)
    assert.match((await excessTrackedStock.json()).error, /Tea.*left in stock/i)
    const teaZeroAgain = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: auth, body: JSON.stringify({
        opId: 'tea-zero-stock', deviceId: 'owner-device', storeId: owner.actor.storeId, baseSeq: 0,
        ops: [{ kind: 'put', collection: 'products', id: 'tea', document: {
          ...teaDocument, trackStock: true, stock: 0,
        } }],
      }),
    })
    assert.equal(teaZeroAgain.status, 200)
    const manual86 = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: auth, body: JSON.stringify({
        opId: 'soup-manual-86', deviceId: 'owner-device', storeId: owner.actor.storeId, baseSeq: 0,
        ops: [{ kind: 'put', collection: 'products', id: 'soup', document: {
          ...update.ops.find((op) => op.id === 'soup').document,
          eightySix: {
            active: true, at: new Date().toISOString(), byId: owner.actor.userId,
            reason: 'Machine down', returnMode: 'manual',
          },
        } }],
      }),
    })
    assert.equal(manual86.status, 200)
    const boardCount = await fetch(`${base}/api/stations`, { headers: deviceHeaders })
    assert.ok((await boardCount.json()).eightySixCount >= 2)
    const availabilitySnapshot = await (await fetch(`${base}/api/sync/snapshot`, { headers: auth })).json()
    let availabilitySeq = availabilitySnapshot.seq
    const sentItemsStillAccepted = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: auth, body: JSON.stringify({
        opId: 'existing-sent-after-86', deviceId: 'owner-device', storeId: owner.actor.storeId, baseSeq: availabilitySeq,
        ops: [{ kind: 'put', collection: 'openOrders', id: 'order-one', document: {
          id: 'order-one', storeId: owner.actor.storeId, number: 12, shiftId: 'shift-one',
          tableId: 'table-1', tableName: 'T1', status: 'open', discount: 0, note: 'Existing sent items',
          items: [
            { lineId: 'kitchen-item', productId: 'soup', status: 'sent', qty: 1 },
            { lineId: 'bar-item', productId: 'tea', status: 'sent', qty: 1 },
          ],
        } }],
      }),
    })
    assert.equal(sentItemsStillAccepted.status, 200)
    availabilitySeq = (await (await fetch(`${base}/api/sync/snapshot`, { headers: auth })).json()).seq
    for (const [productId, lineId, name, errorText] of [
      ['tea', 'new-tea', 'Tea', 'Out of stock'],
      ['soup', 'new-soup', 'Soup', "Machine down"],
    ]) {
      const rejected = await fetch(`${base}/api/sync`, {
        method: 'POST', headers: auth, body: JSON.stringify({
          opId: `add-unavailable-${productId}`, deviceId: 'owner-device', storeId: owner.actor.storeId, baseSeq: availabilitySeq,
          ops: [{ kind: 'put', collection: 'openOrders', id: `new-order-${productId}`, document: {
            id: `new-order-${productId}`, storeId: owner.actor.storeId, number: productId === 'tea' ? 77 : 78,
            status: 'open', discount: 0,
            items: [{ lineId, productId, name, price: 1, qty: 1, status: 'draft' }],
          } }],
        }),
      })
      assert.equal(rejected.status, 400)
      assert.match((await rejected.json()).error, new RegExp(`${name}.*${errorText}`))
    }
    const crossStore = await fetch(`${base}/api/sync`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ ...update, opId: 'sync-two', storeId: 'other-store' }),
    })
    assert.equal(crossStore.status, 403)
    const queued = await fetch(`${base}/api/print`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({
        storeId: owner.actor.storeId, printerId: 'mock-printer',
        payload: [{ text: 'Hub test' }], copies: 1, opId: 'print-once',
      }),
    })
    assert.equal(queued.status, 202)
    const queuedResult = await queued.json()
    const duplicatePrint = await fetch(`${base}/api/print`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({
        storeId: owner.actor.storeId, printerId: 'mock-printer',
        payload: [{ text: 'Hub test' }], copies: 1, opId: 'print-once',
      }),
    })
    assert.equal((await duplicatePrint.json()).job.id, queuedResult.job.id)
    let jobs = []
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
      jobs = (await (await fetch(`${base}/api/print/jobs`, { headers: auth })).json()).jobs
      if (jobs[0]?.status === 'printed') break
    }
    assert.equal(jobs[0]?.status, 'printed')
    const backup = await fetch(`${base}/api/backup`, { method: 'POST', headers: auth, body: JSON.stringify({ storeId: owner.actor.storeId }) })
    assert.equal(backup.status, 201)
    const backupHealth = await fetch(`${base}/api/backup/health`, { headers: auth })
    assert.equal(backupHealth.status, 200)
    assert.ok(Date.parse((await backupHealth.json()).lastBackupAt))
    const backupName = (await backup.json()).filename.split(/[\\/]/).pop()
    const restore = await fetch(`${base}/api/restore`, {
      method: 'POST', headers: auth, body: JSON.stringify({ storeId: owner.actor.storeId, filename: backupName }),
    })
    assert.equal(restore.status, 200)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeCode: 'test-cafe', username: 'owner', secret: 'wrong-password' }),
      })
    }
    const locked = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeCode: 'test-cafe', username: 'owner', secret: 'wrong-password' }),
    })
    assert.equal(locked.status, 429)
  } finally {
    await Promise.all(sockets.map((socket) => new Promise((resolveClose) => {
      socket.addEventListener('close', resolveClose, { once: true })
      socket.close()
      setTimeout(resolveClose, 1000)
    })))
    if (runtime) await runtime.close()
    await new Promise((resolveClose) => mock.close(() => resolveClose()))
    await rm(data, { recursive: true, force: true })
    for (const [key, value] of Object.entries({
      HUB_HOST: original.host, HUB_PORT: original.port, HUB_DATA_DIR: original.data,
      HUB_DIST_DIR: original.dist, HUB_VIRTUAL_PRINTER_PORT: original.virtualPort,
    })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

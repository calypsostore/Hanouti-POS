import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeHubSnapshot } from '../src/shared/sync.ts'

test('hub snapshots clear locally cached collections omitted by the actor permissions', () => {
  const cached = Object.fromEntries([
    'stores', 'users', 'stations', 'stationDevices', 'printers', 'printRoutes', 'printJobs',
    'categories', 'sections', 'tables', 'inventoryItems', 'stockMovements', 'suppliers',
    'purchases', 'purchasePayments', 'products', 'customers', 'orders', 'openOrders',
    'ledger', 'expenses', 'attendance', 'advances', 'payrolls', 'shifts',
    'registerSessions', 'auditLogs',
  ].map((collection) => [collection, []]))
  const actor = { id: 'staff-1', storeId: 'store-1', name: 'Staff', role: 'staff' }
  const otherUser = { id: 'staff-2', storeId: 'store-1', name: 'Other staff', role: 'staff' }
  cached.users = [actor, otherUser]
  cached.shifts = [{
    id: 'private-shift',
    storeId: actor.storeId,
    userId: otherUser.id,
    date: '2026-11-15',
    startTime: '09:00',
    endTime: '17:00',
    createdBy: otherUser.id,
    createdAt: '2026-11-15T00:00:00.000Z',
  }]
  cached.registerSessions = [{
    id: 'private-register',
    storeId: actor.storeId,
    status: 'open',
    openedAt: '2026-11-15T00:00:00.000Z',
    openedById: otherUser.id,
    openedByName: otherUser.name,
    staffId: otherUser.id,
    openingCash: 0,
  }]

  const database = mergeHubSnapshot(cached, {
    storeId: actor.storeId,
    seq: 1,
    collections: {
      users: [{ id: actor.id, storeId: actor.storeId, name: actor.name, role: actor.role }],
      registerSessions: [],
    },
  })

  assert.deepEqual(database.shifts, [])
  assert.deepEqual(database.registerSessions, [])
  assert.deepEqual(database.users.map((user) => user.id), [actor.id])
})

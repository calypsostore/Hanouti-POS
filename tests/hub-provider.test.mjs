import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeHubSnapshot } from '../src/shared/sync.ts'
import { detectDataProvider, HubProvider } from '../src/store/providers/DataProvider.ts'

test('standalone HTML fallback does not get mistaken for a shop hub', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => 'text/html; charset=utf-8' },
    json: async () => { throw new Error('HTML cannot be parsed as JSON.') },
  })

  try {
    const provider = await detectDataProvider(() => {}, {})
    assert.equal(provider.mode, 'local')
  } finally {
    globalThis.fetch = originalFetch
  }
})

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

test('hub provider records bounded connection activity locally', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const storage = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  })
  try {
    const provider = new HubProvider(() => {}, {})
    provider.setConnection('connected')
    for (let index = 0; index < 54; index += 1) {
      provider.setConnection(index % 2 ? 'connected' : 'offline')
    }
    const status = provider.status()
    assert.equal(status.connection, 'connected')
    assert.equal(status.activityLog.length, 50)
    assert.match(status.activityLog[0]?.message ?? '', /connected/)
    assert.ok(storage.has('7anouti.hub.activity.v1'))
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else delete globalThis.localStorage
  }
})

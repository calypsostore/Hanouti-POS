import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidPairingCode, scopeOrdersToDeviceStations, stationIdsForDevice } from '../src/lib/stationDevices.ts'

const store = { id: 'store-1', slug: 'cafe-yasmine' }
const device = {
  id: 'device-1',
  storeId: store.id,
  name: 'Kitchen tablet',
  stationIds: ['kitchen', 'inactive', 'other-store'],
  pairingCode: '042817',
  pairingCodeExpiresAt: '2026-11-15T10:10:00.000Z',
  active: true,
}
const stations = [
  { id: 'kitchen', storeId: store.id, active: true, screen: true },
  { id: 'inactive', storeId: store.id, active: false, screen: true },
  { id: 'other-store', storeId: 'store-2', active: true, screen: true },
  { id: 'bar', storeId: store.id, active: true, screen: true },
]

test('validates pairing code, store and strict expiry', () => {
  const now = Date.parse('2026-11-15T10:09:59.999Z')
  assert.equal(isValidPairingCode(device, store, store.slug, '042817', now), true)
  assert.equal(isValidPairingCode(device, store, store.slug, '042817', now + 1), false)
  assert.equal(isValidPairingCode(device, store, 'another-store', '042817', now), false)
  assert.equal(isValidPairingCode(device, { ...store, id: 'store-2' }, store.slug, '042817', now), false)
  assert.equal(isValidPairingCode(device, store, store.slug, '42817', now), false)
  assert.equal(isValidPairingCode({ ...device, pairedAt: '2026-11-15T10:00:00.000Z' }, store, store.slug, '042817', now), false)
})

test('limits a device to its own active stations and live tickets', () => {
  assert.deepEqual(stationIdsForDevice(device, stations), ['kitchen'])
  const orders = [
    {
      id: 'order-1',
      storeId: store.id,
      items: [
        { lineId: 'allowed', stationId: 'kitchen', status: 'sent' },
        { lineId: 'other-station', stationId: 'bar', status: 'ready' },
        { lineId: 'draft', stationId: 'kitchen', status: 'draft' },
        { lineId: 'served', stationId: 'kitchen', status: 'served' },
        { lineId: 'inactive-station', stationId: 'inactive', status: 'ready' },
      ],
    },
    { id: 'foreign-order', storeId: 'store-2', items: [{ lineId: 'foreign', stationId: 'kitchen', status: 'sent' }] },
  ]
  const scoped = scopeOrdersToDeviceStations(orders, store.id, stationIdsForDevice(device, stations))
  assert.deepEqual(scoped.map((order) => [order.id, order.items.map((item) => item.lineId)]), [
    ['order-1', ['allowed']],
  ])
})

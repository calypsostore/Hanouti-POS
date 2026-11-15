import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePrintPrinter } from '../src/lib/printRouting.ts'

const printers = [
  { id: 'front', storeId: 'shop', name: 'Front', connection: 'browser-print', enabled: true },
  { id: 'kitchen', storeId: 'shop', name: 'Kitchen', connection: 'browser-print', enabled: true },
  { id: 'disabled', storeId: 'shop', name: 'Disabled', connection: 'browser-print', enabled: false },
  { id: 'other-store', storeId: 'other', name: 'Other', connection: 'browser-print', enabled: true },
]

test('prefers an exact station route, then station link, then a matching generic route', () => {
  const database = {
    printers,
    stations: [{ id: 'kitchen-station', storeId: 'shop', printerId: 'kitchen' }],
    printRoutes: [
      { id: 'receipt', storeId: 'shop', type: 'receipt', printerId: 'front' },
      { id: 'ticket', storeId: 'shop', type: 'kitchen', stationId: 'kitchen-station', printerId: 'front' },
    ],
  }
  assert.equal(resolvePrintPrinter(database, 'shop', 'receipt')?.id, 'front')
  assert.equal(resolvePrintPrinter(database, 'shop', 'kitchen', 'kitchen-station')?.id, 'front')

  const withoutSpecificRoute = {
    ...database,
    printRoutes: [{ id: 'generic-kitchen', storeId: 'shop', type: 'kitchen', printerId: 'front' }],
  }
  assert.equal(resolvePrintPrinter(withoutSpecificRoute, 'shop', 'kitchen', 'kitchen-station')?.id, 'kitchen')
})

test('does not send a receipt to a station-only printer or use another store printer', () => {
  const database = {
    printers,
    stations: [{ id: 'kitchen-station', storeId: 'shop', printerId: 'kitchen' }],
    printRoutes: [],
  }
  assert.equal(resolvePrintPrinter(database, 'shop', 'receipt')?.id, 'front')
  assert.equal(resolvePrintPrinter(database, 'other', 'receipt')?.id, 'other-store')
})

test('disabled routed printers do not silently fall through to a different device', () => {
  const database = {
    printers,
    stations: [],
    printRoutes: [{ id: 'receipt', storeId: 'shop', type: 'receipt', printerId: 'disabled' }],
  }
  assert.equal(resolvePrintPrinter(database, 'shop', 'receipt'), undefined)
})

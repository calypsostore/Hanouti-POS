import assert from 'node:assert/strict'
import test from 'node:test'
import { dineInTableError, guestCountError } from '../src/lib/tableService.ts'

test('enforces a required guest count and accepts valid integer counts', () => {
  assert.equal(guestCountError(undefined, 'required'), 'Enter the number of guests.')
  assert.equal(guestCountError(1, 'required'), undefined)
  assert.equal(guestCountError(50, 'required'), undefined)
})

test('allows an omitted optional count but rejects invalid supplied counts', () => {
  assert.equal(guestCountError(undefined, 'optional'), undefined)
  assert.equal(guestCountError(1.5, 'optional'), 'Guests must be a whole number from 1 to 50.')
  assert.equal(guestCountError(51, 'optional'), 'Guests must be a whole number from 1 to 50.')
})

test('does not request or validate guest counts when guest tracking is off', () => {
  assert.equal(guestCountError(undefined, 'off'), undefined)
  assert.equal(guestCountError(0, 'off'), undefined)
})

test('dine-in requires enabled table service and an active available table', () => {
  const settings = { features: { tables: true }, tableMode: 'tables_only' }
  const tables = [
    { id: 'table-1', storeId: 'store-1', active: true },
    { id: 'table-2', storeId: 'store-1', active: false },
  ]
  const openOrders = [{
    id: 'order-1', storeId: 'store-1', tableId: 'table-1', tableName: 'Table 1',
  }]

  assert.equal(dineInTableError(
    { ...settings, features: { tables: false } }, tables, openOrders,
    { storeId: 'store-1', tableId: 'table-2' },
  ), 'Table service is disabled for this store.')
  assert.equal(dineInTableError(settings, tables, openOrders, { storeId: 'store-1' }), 'Choose an active table from this store.')
  assert.equal(dineInTableError(settings, tables, openOrders, { storeId: 'store-1', tableId: 'table-2' }), 'Choose an active table from this store.')
  assert.equal(dineInTableError(settings, tables, openOrders, { storeId: 'store-1', tableId: 'table-1' }), 'This table already has an open order.')
  assert.equal(dineInTableError(settings, tables, openOrders, {
    storeId: 'store-1', tableId: 'table-1', excludeOpenOrderId: 'order-1',
  }), undefined)
  assert.equal(dineInTableError(settings, tables, openOrders, {
    storeId: 'another-store', tableId: 'table-1',
  }), 'Choose an active table from this store.')
})

test('manual dine-in names are unique while their table order remains open', () => {
  const settings = { features: { tables: true }, tableMode: 'manual' }
  const openOrders = [{
    id: 'order-1', storeId: 'store-1', tableName: 'Window',
  }]

  assert.equal(dineInTableError(settings, [], openOrders, { storeId: 'store-1' }), 'Enter a table name up to 60 characters.')
  assert.equal(dineInTableError(settings, [], openOrders, { storeId: 'store-1', tableName: '  ' }), 'Enter a table name up to 60 characters.')
  assert.equal(dineInTableError(settings, [], openOrders, { storeId: 'store-1', tableName: 'window' }), 'This table already has an open order.')
  assert.equal(dineInTableError(settings, [], openOrders, { storeId: 'store-1', tableName: 'Window 2' }), undefined)
})

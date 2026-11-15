import assert from 'node:assert/strict'
import test from 'node:test'
import {
  expectedShiftCash,
  handoverOpenOrder,
  isCashDifferenceWithinTolerance,
  orderPaidBy,
  shiftCashDifference,
} from '../src/lib/shiftCash.ts'

test('expected cash includes the float and cash-only activity', () => {
  assert.equal(expectedShiftCash(100, 45, 12, 3, 5), 149)
})

test('cash difference sign identifies shortage and overage and honors tolerance', () => {
  assert.equal(shiftCashDifference(95, 100), -5)
  assert.equal(shiftCashDifference(105, 100), 5)
  assert.equal(isCashDifferenceWithinTolerance(-0.005, 0.005), true)
  assert.equal(isCashDifferenceWithinTolerance(-0.006, 0.005), false)
})

test('payer attribution falls back to original staff for existing orders', () => {
  assert.equal(orderPaidBy({ staffId: 'owner' }), 'owner')
  assert.equal(orderPaidBy({ staffId: 'owner', paidById: 'cashier' }), 'cashier')
})

test('handover changes table ownership and appends the actor to its history', () => {
  const order = {
    id: 'table-1',
    staffId: 'owner',
    staffName: 'Owner',
    tableHistory: [],
    updatedAt: '2026-01-01T10:00:00.000Z',
  }
  const handedOver = handoverOpenOrder(order, undefined, { id: 'owner', name: 'Owner' }, '2026-01-01T11:00:00.000Z')
  assert.equal(handedOver.staffId, 'unassigned-handover')
  assert.equal(handedOver.staffName, 'Unassigned (handover)')
  assert.equal(handedOver.tableHistory[0].actorId, 'owner')
  assert.equal(handedOver.tableHistory[0].type, 'transferred')
})

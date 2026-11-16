import assert from 'node:assert/strict'
import test from 'node:test'
import { can } from '../src/lib/permissions.ts'
import { staffConsumptionDiscount, staffConsumptionError } from '../src/lib/staffConsumption.ts'
import { validateOrderDocument } from '../hub/src/orderValidation.ts'

const settings = {
  enabled: true,
  pricing: 'discount',
  discountPercent: 20,
  allowances: [{ productId: 'espresso', maxPerShift: 2 }],
}

const line = (productId = 'espresso', qty = 1) => ({
  productId,
  price: 10,
  qty,
  modifiers: [],
})

test('staff consumption enforces enabled policy, open shift, allowed items, and remaining shift limit', () => {
  assert.match(staffConsumptionError([line()], { ...settings, enabled: false }, [], 'shift-1', 'staff-1'), /disabled/)
  assert.match(staffConsumptionError([line()], settings, [], undefined, 'staff-1'), /Open your shift/)
  assert.match(staffConsumptionError([line('cake')], settings, [], 'shift-1', 'staff-1'), /not allowed/)

  const previous = [{
    staffConsumption: true,
    status: 'completed',
    shiftId: 'shift-1',
    staffId: 'staff-1',
    items: [line()],
  }]
  assert.equal(staffConsumptionError([line()], settings, previous, 'shift-1', 'staff-1'), undefined)
  assert.match(staffConsumptionError([line('espresso', 2)], settings, previous, 'shift-1', 'staff-1'), /Shift limit reached/)
})

test('staff pricing calculates discounts and full/free checkout amounts', () => {
  const pricingSettings = { serviceCharge: 0, taxRate: 0, taxInclusive: false }
  assert.equal(staffConsumptionDiscount([line()], pricingSettings, settings), 2)
  assert.equal(staffConsumptionDiscount([line()], pricingSettings, { ...settings, pricing: 'free' }), 10)
  assert.equal(staffConsumptionDiscount([line()], pricingSettings, { ...settings, pricing: 'full_price' }), 0)
})

test('staff item checkout requires its explicit staff permission', () => {
  const user = { role: 'staff', stationOnly: false, permissions: { useStaffAllowances: true } }
  assert.equal(can(user, 'useStaffAllowances'), true)
  assert.equal(can({ ...user, permissions: { useStaffAllowances: false } }, 'useStaffAllowances'), false)
  assert.equal(can({ ...user, stationOnly: true }, 'useStaffAllowances'), false)
})

test('hub independently rejects staff item orders without that permission', () => {
  const state = {
    storeId: 'store-1',
    collections: {
      stores: { 'store-1': { id: 'store-1', settings: {} } },
      users: { 'staff-1': { id: 'staff-1', permissions: { useStaffAllowances: false } } },
    },
  }
  const actor = {
    storeId: 'store-1',
    userId: 'staff-1',
    role: 'staff',
    permissions: { useStaffAllowances: false },
    stationOnly: false,
  }

  assert.throws(
    () => validateOrderDocument({ id: 'staff-order', staffConsumption: true }, 'orders', state, actor),
    /Permission denied: useStaffAllowances is required/,
  )
})

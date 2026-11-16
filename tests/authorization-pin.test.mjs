import test from 'node:test'
import assert from 'node:assert/strict'
import { findPinConfirmer } from '../src/lib/authorizationPin.ts'
import { hashSecret } from '../src/lib/hash.ts'

test('authorization PINs require an active same-store user with purpose permission', async () => {
  const activeManagerPin = await hashSecret('4477')
  const inactiveManagerPin = await hashSecret('6633')
  const users = [
    {
      id: 'manager', name: 'Active manager', storeId: 'store-1', role: 'manager',
      active: true, stationOnly: false, pin: activeManagerPin,
      permissions: { approveOverrides: true, voidOrders: true, overrideStock: true },
    },
    {
      id: 'inactive', name: 'Inactive manager', storeId: 'store-1', role: 'manager',
      active: false, stationOnly: false, pin: inactiveManagerPin,
      permissions: { approveOverrides: true, voidOrders: true, overrideStock: true },
    },
    {
      id: 'staff', name: 'Staff', storeId: 'store-1', role: 'staff',
      active: true, stationOnly: false, pin: activeManagerPin,
      permissions: { approveOverrides: false, voidOrders: false, overrideStock: false },
    },
    {
      id: 'other-store', name: 'Other store', storeId: 'store-2', role: 'admin',
      active: true, stationOnly: false, pin: activeManagerPin, permissions: {},
    },
  ]
  const rules = { stockOverrideRoles: { admin: true, manager: true, staff: false } }

  assert.deepEqual(
    await findPinConfirmer(users, 'store-1', '4477', 'cancel-table', rules),
    { id: 'manager', name: 'Active manager' },
  )
  assert.deepEqual(
    await findPinConfirmer(users, 'store-1', '4477', 'void-order', rules),
    { id: 'manager', name: 'Active manager' },
  )
  assert.deepEqual(
    await findPinConfirmer(users, 'store-1', '4477', 'override-stock', rules),
    { id: 'manager', name: 'Active manager' },
  )
  assert.equal(await findPinConfirmer(users, 'store-1', '6633', 'void-order', rules), undefined)
  assert.equal(await findPinConfirmer(users, 'store-1', '4477', 'override-stock', {
    stockOverrideRoles: { admin: true, manager: false, staff: false },
  }), undefined)
  assert.equal(await findPinConfirmer(users, 'store-1', '44', 'cancel-table', rules), undefined)
})

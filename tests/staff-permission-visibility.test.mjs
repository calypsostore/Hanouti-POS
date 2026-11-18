import assert from 'node:assert/strict'
import test from 'node:test'
import { isQuickStaffPermissionVisible } from '../src/lib/staffPermissionVisibility.ts'

test('Quick staff editing hides cashier-only permissions but retains staff items', () => {
  for (const permission of [
    'discount',
    'manageInventory',
    'recordPurchases',
    'viewCosts',
    'manageTables',
    'manageSections',
    'takeOverTables',
  ]) {
    assert.equal(isQuickStaffPermissionVisible(permission, true), false, permission)
  }

  assert.equal(isQuickStaffPermissionVisible('manageStaffAllowances', true), true)
  assert.equal(isQuickStaffPermissionVisible('useStaffAllowances', true), true)
  assert.equal(isQuickStaffPermissionVisible('manage86', true), true)
  assert.equal(isQuickStaffPermissionVisible('viewStation', false), false)
  assert.equal(isQuickStaffPermissionVisible('viewStation', true), true)
})

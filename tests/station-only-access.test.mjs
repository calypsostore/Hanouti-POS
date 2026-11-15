import test from 'node:test'
import assert from 'node:assert/strict'
import { can } from '../src/lib/permissions.ts'
import { shouldTrackAttendance } from '../src/lib/staff.ts'

const permissions = {
  discount: true,
  credit: true,
  settle: true,
  reports: true,
  register: true,
  supervisor: true,
  manageInventory: true,
  recordPurchases: true,
  viewCosts: true,
  manageStaffAllowances: true,
  approveOverrides: true,
  viewReports: true,
  manageProducts: true,
  voidOrders: true,
  manageStaff: true,
  manageSettings: true,
  managePayroll: true,
  manageTables: true,
  manageSections: true,
  viewStation: true,
  openShift: true,
  closeShift: true,
}
const user = {
  id: 'cook-1',
  storeId: 'store-1',
  role: 'staff',
  stationOnly: true,
  attendanceEnabled: false,
  permissions,
}

test('station-only preset denies all capabilities except station viewing', () => {
  assert.equal(can(user, 'viewStation'), true)
  for (const capability of [
    'manageInventory', 'recordPurchases', 'viewCosts', 'manageStaffAllowances',
    'approveOverrides', 'viewReports', 'manageProducts', 'voidOrders',
    'manageStaff', 'manageSettings', 'managePayroll', 'manageTables',
    'manageSections', 'openShift', 'closeShift',
  ]) assert.equal(can(user, capability), false, `${capability} must be denied`)
})

test('station-only attendance stays off unless explicitly enabled', () => {
  assert.equal(shouldTrackAttendance(user), false)
  assert.equal(shouldTrackAttendance({ ...user, attendanceEnabled: true }), true)
})

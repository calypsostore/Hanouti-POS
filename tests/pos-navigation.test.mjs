import assert from 'node:assert/strict'
import test from 'node:test'
import { cashierSidebarPaths, quickSidebarPaths } from '../src/lib/posNavigation.ts'
import { defaultPermissions, normalizeUser } from '../src/lib/defaults.ts'
import { can, MANAGER_DEFAULT_PERMISSIONS } from '../src/lib/permissions.ts'

const userFor = (role, permissions = {}) => ({ role, permissions })

const storeFor = (posMode) => ({
  settings: {
    posMode,
    allowCredit: false,
    features: {
      tables: true,
      kitchenScreen: true,
    },
  },
})

test('Quick admin sidebar includes Overview and Products', () => {
  const paths = quickSidebarPaths(storeFor('quick'), userFor('admin'))
  assert.ok(paths.includes('/admin'))
  assert.ok(paths.includes('/admin/products'))
})

test('Cashier admin and manager sidebar paths include enabled features', () => {
  const paths = cashierSidebarPaths(storeFor('cashier'), userFor('admin'))
  assert.deepEqual(paths.sort(), [
    '/admin/customers',
    '/admin/inventory',
    '/admin/purchases',
    '/kitchen',
    '/pos/floor',
  ])

  const managerPaths = cashierSidebarPaths(storeFor('cashier'), userFor('manager', {
    viewStation: true,
    recordPurchases: true,
    manageInventory: true,
  }))
  assert.deepEqual(managerPaths.sort(), paths.sort())
})

test('Cashier staff paths include enabled features allowed by staff permissions', () => {
  const paths = cashierSidebarPaths(storeFor('cashier'), userFor('staff', {
    viewStation: true,
    recordPurchases: true,
  }))
  assert.deepEqual(paths.sort(), [
    '/admin/customers',
    '/admin/purchases',
    '/kitchen',
    '/pos/floor',
  ])
})

test('Quick staff defaults expose only POS, Orders, and their own shift', () => {
  const permissions = defaultPermissions('staff')
  const paths = quickSidebarPaths(storeFor('quick'), userFor('staff', permissions))

  assert.deepEqual(paths, ['/pos', '/admin/orders', '/admin/register'])
  assert.equal(can(userFor('staff', permissions), 'viewExpenses'), false)
  assert.equal(permissions.viewExpenses, false)
  assert.equal(permissions.addExpenses, false)
  assert.equal(permissions.editExpenses, false)
})

test('Quick expense visibility requires the explicit permission for staff and managers', () => {
  const store = storeFor('quick')
  const staff = userFor('staff', { viewOrders: true, viewExpenses: true })
  const manager = userFor('manager', {
    viewOrders: true,
    viewExpenses: false,
    viewReports: false,
    manageProducts: false,
    manageStaff: false,
    manageSettings: false,
    openShift: false,
    closeShift: false,
  })

  assert.ok(quickSidebarPaths(store, staff).includes('/admin/expenses'))
  assert.ok(!quickSidebarPaths(store, manager).includes('/admin/expenses'))
  assert.ok(!quickSidebarPaths(store, manager).includes('/admin/reports'))
  assert.ok(!quickSidebarPaths(store, manager).includes('/admin/settings'))
  assert.equal(MANAGER_DEFAULT_PERMISSIONS.viewExpenses, false)
})

test('legacy staff and manager records normalize Quick expense permissions to off', () => {
  const legacyUser = (role) => normalizeUser({
    id: `legacy-${role}`,
    storeId: 'store-1',
    name: role,
    password: '',
    pin: '',
    role,
    active: true,
    salaryType: 'none',
    salaryAmount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    permissions: {
      discount: false,
      credit: false,
      settle: false,
      reports: false,
      register: false,
      supervisor: false,
    },
  })
  const staff = legacyUser('staff')
  const manager = legacyUser('manager')

  for (const user of [staff, manager]) {
    assert.equal(user.permissions.viewExpenses, false)
    assert.equal(user.permissions.addExpenses, false)
    assert.equal(user.permissions.editExpenses, false)
  }
  assert.equal(staff.permissions.viewOrders, true)
})

test('Quick reports, products, team, settings, and register paths follow capabilities', () => {
  const manager = userFor('manager', {
    viewOrders: true,
    viewReports: true,
    manageProducts: true,
    manageStaff: true,
    manageSettings: true,
    openShift: false,
    closeShift: true,
  })
  const paths = quickSidebarPaths(storeFor('quick'), manager)

  assert.ok(paths.includes('/admin/reports'))
  assert.ok(paths.includes('/admin/logs'))
  assert.ok(paths.includes('/admin/products'))
  assert.ok(paths.includes('/admin/staff'))
  assert.ok(paths.includes('/admin/settings'))
  assert.ok(paths.includes('/admin/register'))
})

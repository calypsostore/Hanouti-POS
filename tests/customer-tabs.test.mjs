import assert from 'node:assert/strict'
import test from 'node:test'
import { canViewCustomerTabs, quickTabLimitError } from '../src/lib/customerTabs.ts'
import { defaultPermissions, normalizeUser } from '../src/lib/defaults.ts'
import { quickSidebarPaths } from '../src/lib/posNavigation.ts'
import { visibleSettingsTabs } from '../src/lib/settingsTabs.ts'
import { replaceStore } from '../src/lib/storeSettings.ts'

const settingsFor = (posMode, allowCredit = true, features = {}) => ({
  posMode,
  allowCredit,
  features: { tables: true, kitchenScreen: false, ...features },
})

const userFor = (role, permissions = defaultPermissions(role), tabCreditLimit = 0) => normalizeUser({
  id: `user-${role}`,
  storeId: 'store-1',
  name: role,
  password: '',
  pin: '',
  role,
  active: true,
  salaryType: 'none',
  salaryAmount: 0,
  tabCreditLimit,
  createdAt: '2026-01-01T00:00:00.000Z',
  permissions,
})

test('settings tabs expose only the Quick set and retain Cashier settings', () => {
  const admin = userFor('admin')
  const quick = visibleSettingsTabs(settingsFor('quick'), admin)
  assert.deepEqual(quick, [
    'profile', 'branding', 'register', 'permissions', 'devices', 'automation', 'connectivity', 'data',
  ])
  const cashier = visibleSettingsTabs(settingsFor('cashier'), admin)
  assert.ok(cashier.includes('receipt'))
  assert.ok(cashier.includes('tables'))
  assert.ok(cashier.includes('stations'))
  assert.ok(cashier.includes('service'))
  assert.ok(cashier.includes('automation'))
})

test('Quick sidebar paths keep permitted tabs and omit cashier-only product areas', () => {
  const store = { id: 'store-1', settings: settingsFor('quick', true, { kitchenScreen: true }) }
  const staff = userFor('staff', {
    ...defaultPermissions('staff'),
    viewTabs: true,
    viewStation: true,
    openShift: true,
  })
  const paths = quickSidebarPaths(store, staff)
  assert.deepEqual(paths, [
    '/staff', '/pos', '/admin/orders', '/kitchen', '/admin/customers', '/admin/register',
  ])
  for (const hidden of ['/admin/inventory', '/admin/purchases', '/admin/payroll', '/pos/floor']) {
    assert.equal(paths.includes(hidden), false)
  }
  assert.equal(quickSidebarPaths(store, userFor('staff')).includes('/admin/customers'), false)
})

test('customer route access follows Quick tab permissions while preserving Cashier access', () => {
  const quick = { id: 'store-1', settings: settingsFor('quick') }
  const cashier = { id: 'store-1', settings: settingsFor('cashier') }
  assert.equal(canViewCustomerTabs(quick, userFor('staff')), false)
  assert.equal(canViewCustomerTabs(quick, userFor('staff', {
    ...defaultPermissions('staff'),
    viewTabs: true,
  })), true)
  assert.equal(canViewCustomerTabs(cashier, userFor('staff')), true)
  assert.equal(canViewCustomerTabs(quick, userFor('admin')), true)
})

test('new tab capabilities default off for staff and managers and on for admins', () => {
  const capabilities = ['manageCustomers', 'viewTabs', 'settleTabs', 'addToTabs']
  const staff = defaultPermissions('staff')
  const manager = defaultPermissions('manager')
  const admin = defaultPermissions('admin')
  for (const capability of capabilities) {
    assert.equal(staff[capability], false)
    assert.equal(manager[capability], false)
    assert.equal(admin[capability], true)
  }
  assert.equal(userFor('staff', defaultPermissions('staff'), -1).tabCreditLimit, 0)
})

test('staff tab-credit limits block excess charges and admins can override', () => {
  const staff = userFor('staff', defaultPermissions('staff'), 50)
  assert.equal(quickTabLimitError(staff, 20, 30), undefined)
  assert.match(quickTabLimitError(staff, 20, 30.001), /exceeds your tab limit/)
  assert.equal(quickTabLimitError(userFor('admin'), 1000, 1000), undefined)
})

test('switching POS mode replaces settings without deleting hidden store data', () => {
  const store = { id: 'store-1', settings: settingsFor('cashier') }
  const hidden = {
    orders: [{ id: 'order-1' }],
    customers: [{ id: 'customer-1' }],
    ledger: [{ id: 'ledger-1' }],
    products: [{ id: 'product-1' }],
    inventoryItems: [{ id: 'inventory-1' }],
  }
  const database = { stores: [store], ...hidden }
  const switched = replaceStore(database, {
    ...store,
    settings: { ...store.settings, posMode: 'quick' },
  })
  assert.equal(switched.stores[0].settings.posMode, 'quick')
  for (const collection of Object.keys(hidden)) {
    assert.strictEqual(switched[collection], database[collection])
  }
})

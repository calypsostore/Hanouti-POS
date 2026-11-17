import assert from 'node:assert/strict'
import test from 'node:test'
import { cashierSidebarPaths, quickSidebarPaths } from '../src/lib/posNavigation.ts'

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

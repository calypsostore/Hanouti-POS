import assert from 'node:assert/strict'
import test from 'node:test'
import { isCashier, isQuick, modeFeatures } from '../src/lib/posMode.ts'

const storeFor = (posMode, features = {}) => ({
  settings: {
    posMode,
    features: { tables: true, kitchenScreen: false, ...features },
  },
})

test('mode helpers preserve quick and cashier mode values', () => {
  assert.equal(isQuick(storeFor('quick')), true)
  assert.equal(isCashier(storeFor('quick')), false)
  assert.equal(isQuick(storeFor('cashier')), false)
  assert.equal(isCashier(storeFor('cashier')), true)
})

test('Quick capabilities omit cashier-only features and keep admin-enabled kitchen stations', () => {
  const quickFeatures = modeFeatures(storeFor('quick', { kitchenScreen: true }))
  assert.equal(quickFeatures.payments, false)
  assert.equal(quickFeatures.changeCalc, false)
  assert.equal(quickFeatures.receiptPrinting, false)
  assert.equal(quickFeatures.cashReconciliation, true)
  assert.equal(quickFeatures.payroll, true)
  assert.equal(quickFeatures.tablesFloor, false)
  assert.equal(quickFeatures.kitchenStations, true)
  assert.equal(modeFeatures(storeFor('cashier')).payments, true)
  assert.equal(modeFeatures(storeFor('cashier')).payroll, true)
})

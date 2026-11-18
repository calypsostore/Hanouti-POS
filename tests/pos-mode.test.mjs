import assert from 'node:assert/strict'
import test from 'node:test'
import { isCashier, isQuick, modeFeatures, normalizeCashierModeSettings } from '../src/lib/posMode.ts'

const storeFor = (posMode, features = {}, cashierModeEnabled = posMode === 'cashier') => ({
  settings: {
    posMode,
    cashierModeEnabled,
    features: { tables: true, kitchenScreen: false, ...features },
  },
})

test('mode helpers preserve quick and cashier mode values', () => {
  assert.equal(isQuick(storeFor('quick')), true)
  assert.equal(isCashier(storeFor('quick')), false)
  assert.equal(isQuick(storeFor('cashier')), false)
  assert.equal(isCashier(storeFor('cashier')), true)
})

test('disabled cashier availability forces Quick capabilities even if cashier was selected', () => {
  const store = storeFor('cashier', {}, false)
  assert.equal(isQuick(store), true)
  assert.equal(isCashier(store), false)
  assert.equal(modeFeatures(store).payments, false)
})

test('cashier settings normalize to Quick unless availability is explicitly enabled', () => {
  assert.deepEqual(normalizeCashierModeSettings('cashier', undefined), {
    posMode: 'quick',
    cashierModeEnabled: false,
  })
  assert.deepEqual(normalizeCashierModeSettings('cashier', true), {
    posMode: 'cashier',
    cashierModeEnabled: true,
  })
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

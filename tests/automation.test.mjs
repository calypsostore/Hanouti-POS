import test from 'node:test'
import assert from 'node:assert/strict'
import {
  automaticPrintRetryLimit,
  backupHealthIsStale,
  filterPosProducts,
  inactivityAction,
  printerOfflineAlertDue,
  shiftReminderDue,
  shouldAutoPrintReceipt,
  validAutomationSettings,
} from '../src/lib/automation.ts'

const validSettings = {
  drawerKickOnCash: true,
  autoLockMinutes: 5,
  autoLogoutMinutes: 720,
  shiftReminders: true,
  shiftReminderHours: 8,
  maxShiftHours: 12,
  cashDifferenceTolerance: 0,
  warnAboutOpenTablesAtShiftClose: true,
  lowStockAlerts: true,
  hideOutOfStock: false,
  retryPrintJobs: true,
  fallbackPrintJobs: true,
  printerRetryLimit: 5,
  autoReconnectPrinters: true,
  printerOfflineAlerts: true,
  printerOfflineAlertMinutes: 5,
  backupHealthAlerts: true,
}

test('inactivity locks before the longer logout limit and zero disables a limit', () => {
  assert.equal(inactivityAction(4 * 60_000, 5, 720), null)
  assert.equal(inactivityAction(5 * 60_000, 5, 720), 'lock')
  assert.equal(inactivityAction(720 * 60_000, 5, 720), 'logout')
  assert.equal(inactivityAction(10 * 60_000, 0, 0), null)
  assert.equal(inactivityAction(3 * 60_000, 5, 3), null)
})

test('receipt printing only happens automatically for the auto device policy', () => {
  assert.equal(shouldAutoPrintReceipt('auto'), true)
  assert.equal(shouldAutoPrintReceipt('ask'), false)
  assert.equal(shouldAutoPrintReceipt('never'), false)
})

test('shift reminder becomes due only after the configured elapsed hours', () => {
  const now = new Date('2026-01-01T10:00:00.000Z')
  assert.equal(shiftReminderDue('2026-01-01T02:00:00.000Z', 8, now), true)
  assert.equal(shiftReminderDue('2026-01-01T02:01:00.000Z', 8, now), false)
  assert.equal(shiftReminderDue('invalid', 1, now), false)
})

test('printer retry limits and offline alerts remain bounded and time-based', () => {
  assert.equal(automaticPrintRetryLimit({ retryPrintJobs: false, printerRetryLimit: 9 }), 1)
  assert.equal(automaticPrintRetryLimit({ retryPrintJobs: true, printerRetryLimit: 4 }), 4)
  assert.equal(automaticPrintRetryLimit({ printerRetryLimit: 99 }), 5)
  const now = new Date('2026-01-01T10:00:00.000Z')
  assert.equal(printerOfflineAlertDue('2026-01-01T09:55:00.000Z', 5, now), true)
  assert.equal(printerOfflineAlertDue(undefined, 5, now), false)
})

test('backup health treats missing, invalid and older-than-48-hour backups as stale', () => {
  const now = new Date('2026-01-03T00:00:00.000Z')
  assert.equal(backupHealthIsStale('2026-01-01T00:00:00.000Z', now), false)
  assert.equal(backupHealthIsStale('2025-12-31T23:59:59.000Z', now), true)
  assert.equal(backupHealthIsStale(null, now), true)
})

test('automation settings reject invalid bounds and logout before lock', () => {
  assert.equal(validAutomationSettings(validSettings), true)
  assert.equal(validAutomationSettings({ ...validSettings, autoLogoutMinutes: 5 }), false)
  assert.equal(validAutomationSettings({ ...validSettings, printerRetryLimit: 11 }), false)
})

test('out-of-stock filtering respects tracked variants and can be disabled', () => {
  const products = [
    { id: 'plain', trackStock: true, stock: 0 },
    { id: 'available', trackStock: true, stock: 1 },
    { id: 'variant', variants: [{ trackStock: true, stock: 0 }, { trackStock: true, stock: 2 }] },
    { id: 'mixed', variants: [{ trackStock: true, stock: 0 }, { trackStock: false, stock: 0 }] },
  ]
  assert.deepEqual(filterPosProducts(products, true).map((product) => product.id), ['available', 'variant', 'mixed'])
  assert.equal(filterPosProducts(products, false).length, products.length)
})

test('new untracked products remain visible and ingredient recipes respect hide-out-of-stock', () => {
  const product = {
    id: 'new-item',
    trackStock: false,
    stock: 0,
    recipe: [{ inventoryItemId: 'beans', qtyPerUnit: 2 }],
    variants: [],
  }
  const availableIngredients = [{ id: 'beans', onHand: 2 }]
  const emptyIngredients = [{ id: 'beans', onHand: 0 }]
  const availability = { enabled: true, autoEightySixAtZero: true }

  assert.deepEqual(filterPosProducts([product], true, availability), [product])
  assert.deepEqual(
    filterPosProducts([product], true, availability, emptyIngredients, true),
    [],
  )
  assert.deepEqual(
    filterPosProducts([product], true, availability, availableIngredients, true),
    [product],
  )
})

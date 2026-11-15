import test from 'node:test'
import assert from 'node:assert/strict'
import { isUnavailable } from '../src/lib/availability.ts'

const settings = {
  enabled: true,
  autoEightySixAtZero: true,
  autoReturnOnRestock: true,
  requireReason: true,
  reasons: [],
  defaultReturnMode: 'manual',
  resetManualAtDayStart: false,
  resetManualAtFirstShift: false,
  displayStyle: 'big_red_x',
  showListButton: true,
}
const product = {
  id: 'coffee',
  storeId: 'store',
  name: 'Coffee',
  trackStock: false,
  stock: 0,
  inventoryItemId: 'beans',
}

test('manual 86 includes the configured reason and remains unavailable', () => {
  const result = isUnavailable({
    ...product,
    eightySix: { active: true, at: '2026-01-01T10:00:00Z', byId: 'staff', reason: 'Machine down', returnMode: 'manual' },
  }, undefined, settings, { id: 'beans', onHand: 5 })
  assert.equal(result.unavailable, true)
  assert.equal(result.source, 'manual')
  assert.equal(result.reason, 'Machine down')
  assert.equal(result.byId, 'staff')
})

test('tracked zero stock auto-86s while positive stock is available', () => {
  assert.equal(isUnavailable({ ...product, inventoryItemId: undefined, trackStock: true }, undefined, settings).source, 'stock')
  assert.equal(isUnavailable({ ...product, inventoryItemId: undefined, trackStock: true, stock: 2 }, undefined, settings).unavailable, false)
})

test('linked inventory at zero is unavailable', () => {
  const result = isUnavailable(product, undefined, settings, { id: 'beans', onHand: 0 })
  assert.equal(result.unavailable, true)
  assert.equal(result.source, 'inventory')
})

test('manual on-restock 86 returns when stock is restored', () => {
  const item = {
    ...product,
    trackStock: true,
    stock: 0,
    inventoryItemId: undefined,
    eightySix: { active: true, at: '2026-01-01T10:00:00Z', byId: 'staff', returnMode: 'on_restock' },
  }
  assert.equal(isUnavailable(item, undefined, settings).source, 'manual')
  assert.equal(isUnavailable({ ...item, stock: 1 }, undefined, settings).unavailable, false)
})

test('at-time return is available after its return timestamp', () => {
  const result = isUnavailable({
    ...product,
    inventoryItemId: undefined,
    eightySix: { active: true, at: '2026-01-01T10:00:00Z', byId: 'staff', returnMode: 'at_time', backAt: '2026-01-01T11:00:00Z' },
  }, undefined, settings, undefined, new Date('2026-01-01T11:00:00Z'))
  assert.equal(result.unavailable, false)
})

test('variant 86 applies to that variant, without 86ing other variants', () => {
  const variant = { id: 'large', name: 'Large', trackStock: false, stock: 0, eightySix: { active: true, at: '2026-01-01T10:00:00Z', byId: 'manager', returnMode: 'manual' } }
  assert.equal(isUnavailable(product, variant, settings, { id: 'beans', onHand: 5 }).source, 'manual')
  assert.equal(isUnavailable(product, { ...variant, id: 'small', eightySix: undefined }, settings, { id: 'beans', onHand: 5 }).unavailable, false)
})

test('manual 86 does not auto-return when stock rises', () => {
  const result = isUnavailable({
    ...product,
    trackStock: true,
    stock: 10,
    inventoryItemId: undefined,
    eightySix: { active: true, at: '2026-01-01T10:00:00Z', byId: 'staff', returnMode: 'manual' },
  }, undefined, settings)
  assert.equal(result.source, 'manual')
})

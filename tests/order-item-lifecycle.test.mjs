import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransitionStationItem } from '../src/lib/orderItemLifecycle.ts'

test('station item lifecycle supports bump and recall without editing draft or void items', () => {
  assert.equal(canTransitionStationItem('sent', 'preparing'), true)
  assert.equal(canTransitionStationItem('preparing', 'ready'), true)
  assert.equal(canTransitionStationItem('ready', 'served'), true)
  assert.equal(canTransitionStationItem('ready', 'preparing'), true)
  assert.equal(canTransitionStationItem('draft', 'ready'), false)
  assert.equal(canTransitionStationItem('void', 'sent'), false)
  assert.equal(canTransitionStationItem(undefined, 'preparing'), false)
})

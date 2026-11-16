import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransitionStationItem, isNoteOnlyStationUpdate } from '../src/lib/orderItemLifecycle.ts'

test('station item lifecycle supports bump and recall without editing draft or void items', () => {
  assert.equal(canTransitionStationItem('sent', 'preparing'), true)
  assert.equal(canTransitionStationItem('preparing', 'ready'), true)
  assert.equal(canTransitionStationItem('ready', 'served'), true)
  assert.equal(canTransitionStationItem('ready', 'preparing'), true)
  assert.equal(canTransitionStationItem('draft', 'ready'), false)
  assert.equal(canTransitionStationItem('void', 'sent'), false)
  assert.equal(canTransitionStationItem(undefined, 'preparing'), false)
})

test('sent, preparing, and ready items allow note-only updates but not quantity or price changes', () => {
  for (const status of ['sent', 'preparing', 'ready']) {
    assert.equal(isNoteOnlyStationUpdate(status, { note: 'No ice' }), true)
    assert.equal(isNoteOnlyStationUpdate(status, { note: 'No ice', qty: 2 }), false)
    assert.equal(isNoteOnlyStationUpdate(status, { note: 'No ice', useCurrentPrice: true }), false)
  }
  assert.equal(isNoteOnlyStationUpdate('served', { note: 'No ice' }), false)
  assert.equal(isNoteOnlyStationUpdate('draft', { note: 'No ice' }), false)
})

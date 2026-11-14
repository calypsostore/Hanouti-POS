import assert from 'node:assert/strict'
import test from 'node:test'
import { guestCountError } from '../src/lib/tableService.ts'

test('enforces a required guest count and accepts valid integer counts', () => {
  assert.equal(guestCountError(undefined, 'required'), 'Enter the number of guests.')
  assert.equal(guestCountError(1, 'required'), undefined)
  assert.equal(guestCountError(50, 'required'), undefined)
})

test('allows an omitted optional count but rejects invalid supplied counts', () => {
  assert.equal(guestCountError(undefined, 'optional'), undefined)
  assert.equal(guestCountError(1.5, 'optional'), 'Guests must be a whole number from 1 to 50.')
  assert.equal(guestCountError(51, 'optional'), 'Guests must be a whole number from 1 to 50.')
})

test('does not request or validate guest counts when guest tracking is off', () => {
  assert.equal(guestCountError(undefined, 'off'), undefined)
  assert.equal(guestCountError(0, 'off'), undefined)
})

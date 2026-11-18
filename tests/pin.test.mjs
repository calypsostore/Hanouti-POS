import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidPin, normalizePin, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../src/shared/pin.ts'

test('shared PIN validation accepts 4 to 6 alphanumeric characters case-insensitively', () => {
  assert.equal(isValidPin('1234'), true)
  assert.equal(isValidPin('aBcD12'), true)
  assert.equal(normalizePin('aBcD12'), 'ABCD12')
  assert.equal(isValidPin('123'), false)
  assert.equal(isValidPin('1234567'), false)
  assert.equal(isValidPin('12-a'), false)
  assert.equal(PIN_MIN_LENGTH, 4)
  assert.equal(PIN_MAX_LENGTH, 6)
})

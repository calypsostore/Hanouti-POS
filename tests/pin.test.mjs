import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidPin, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../src/shared/pin.ts'

test('shared PIN validation accepts only 4 to 12 digits', () => {
  assert.equal(isValidPin('1234'), true)
  assert.equal(isValidPin('123456789012'), true)
  assert.equal(isValidPin('123'), false)
  assert.equal(isValidPin('1234567890123'), false)
  assert.equal(isValidPin('12a4'), false)
  assert.equal(PIN_MIN_LENGTH, 4)
  assert.equal(PIN_MAX_LENGTH, 12)
})

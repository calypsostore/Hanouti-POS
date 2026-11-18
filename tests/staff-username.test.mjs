import test from 'node:test'
import assert from 'node:assert/strict'
import { isUsernameForStore, isValidUsername, suggestStaffUsername } from '../src/lib/staff.ts'

test('generated staff usernames include the store code and remain globally distinct', () => {
  const first = suggestStaffUsername('Amina Ben Salah', 'cafe-yasmine', [])
  const anotherStore = suggestStaffUsername('Amina Ben Salah', 'cafe-sami', [])

  assert.equal(first, 'amina.cafe-yasmine')
  assert.equal(anotherStore, 'amina.cafe-sami')
  assert.equal(isUsernameForStore(first, 'cafe-yasmine'), true)
  assert.equal(isUsernameForStore(first, 'cafe-sami'), false)
  assert.equal(isValidUsername(first), true)
})

test('same-store duplicate usernames get a suffix before the store code', () => {
  const users = [{ id: 'existing', username: 'amina.cafe-yasmine' }]
  const generated = suggestStaffUsername('Amina Ben Salah', 'cafe-yasmine', users)

  assert.equal(generated, 'amina2.cafe-yasmine')
  assert.equal(isUsernameForStore(generated, 'cafe-yasmine'), true)
})

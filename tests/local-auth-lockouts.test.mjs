import test from 'node:test'
import assert from 'node:assert/strict'
import {
  lockoutSeconds,
  parseLoginFailures,
  recordLoginFailure,
  serializeLoginFailures,
} from '../src/lib/localAuthLockouts.ts'

test('local password and PIN lockouts survive reloads and expire after 30 seconds', () => {
  const now = 1_000_000
  const failures = new Map()
  for (const key of ['email:owner@example.test', 'pin:cashier']) {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      assert.equal(recordLoginFailure(failures, key, now), attempt)
    }
  }
  assert.equal(lockoutSeconds(failures.get('email:owner@example.test'), now), 30)

  const restored = parseLoginFailures(serializeLoginFailures(failures, now), now + 5_000)
  assert.equal(lockoutSeconds(restored.get('email:owner@example.test'), now + 5_000), 25)
  assert.equal(lockoutSeconds(restored.get('pin:cashier'), now + 5_000), 25)
  assert.equal(parseLoginFailures(serializeLoginFailures(restored, now + 31_000), now + 31_000).size, 0)
})

test('local lockout loading discards entries older than 24 hours', () => {
  const now = 2_000_000
  const raw = JSON.stringify({
    stale: { count: 1, lockedUntil: 0, updatedAt: now - 24 * 60 * 60 * 1000 - 1 },
    current: { count: 1, lockedUntil: 0, updatedAt: now },
  })
  const restored = parseLoginFailures(raw, now)
  assert.equal(restored.has('stale'), false)
  assert.equal(restored.get('current')?.count, 1)
})

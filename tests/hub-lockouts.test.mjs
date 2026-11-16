import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HubAuth } from '../hub/src/auth.ts'
import { HubStorage } from '../hub/src/storage.ts'

test('hub authentication prunes expired lockouts and caps persisted records', async () => {
  const root = await mkdtemp(join(tmpdir(), '7anouti-lockouts-test-'))
  try {
    const storage = new HubStorage(root)
    await storage.initialize()
    await storage.replaceStore('store-1', {
      storeId: 'store-1', seq: 1, collections: {}, appliedOpIds: [],
    })
    const now = Date.now()
    const failures = {
      expired: { count: 0, lockedUntil: now - 1, updatedAt: now - 1 },
      stale: { count: 1, lockedUntil: 0, updatedAt: now - 24 * 60 * 60 * 1000 - 1 },
      locked: { count: 0, lockedUntil: now + 60_000, updatedAt: now },
      ...Object.fromEntries(Array.from({ length: 10_002 }, (_, index) => [
        `attempt-${index}`,
        { count: 1, lockedUntil: 0, updatedAt: now + index },
      ])),
    }
    await writeFile(join(root, 'auth-lockouts.json'), JSON.stringify(failures), 'utf8')
    const auth = new HubAuth(storage)
    await auth.initialize()
    await assert.rejects(auth.login('missing', 'user', 'wrong', 'test-ip'))

    const saved = JSON.parse(await readFile(join(root, 'auth-lockouts.json'), 'utf8'))
    assert.equal(saved.expired, undefined)
    assert.equal(saved.stale, undefined)
    assert.ok(Object.keys(saved).length <= 10_000)
    assert.ok(saved['attempt-10001'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

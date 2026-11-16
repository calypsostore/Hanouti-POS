import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HubAuth, hashSecret } from '../hub/src/auth.ts'
import { HubStorage } from '../hub/src/storage.ts'

test('device authentication uses SHA-256, upgrades legacy hashes, and throttles last-seen writes', async () => {
  const root = await mkdtemp(join(tmpdir(), '7anouti-device-auth-test-'))
  try {
    const storage = new HubStorage(root)
    await storage.initialize()
    const legacyToken = randomBytes(32).toString('base64url')
    const currentToken = randomBytes(32).toString('base64url')
    await storage.replaceStore('store-1', {
      storeId: 'store-1',
      seq: 1,
      appliedOpIds: [],
      collections: {
        stationDevices: {
          legacy: {
            id: 'legacy', storeId: 'store-1', active: true, stationIds: ['station-1'],
            deviceTokenHash: hashSecret(legacyToken),
          },
          current: {
            id: 'current', storeId: 'store-1', active: true, stationIds: ['station-2'],
            deviceTokenHash: createHash('sha256').update(currentToken).digest('hex'),
          },
        },
        stations: {
          'station-1': { id: 'station-1', storeId: 'store-1', active: true, screen: true },
          'station-2': { id: 'station-2', storeId: 'store-1', active: true, screen: true },
        },
      },
    })
    const auth = new HubAuth(storage)
    await auth.initialize()

    assert.equal(await auth.authenticateDevice('current', 'incorrect-token'), null)
    const currentActor = await auth.authenticateDevice('current', currentToken)
    assert.equal(currentActor?.stationOnly, true)
    const afterCurrentAuth = await storage.readStore('store-1')
    assert.equal(afterCurrentAuth.seq, 2)
    await auth.authenticateDevice('current', currentToken)
    assert.equal((await storage.readStore('store-1')).seq, 2)

    const legacyActor = await auth.authenticateDevice('legacy', legacyToken)
    assert.equal(legacyActor?.stationOnly, true)
    const recovered = await storage.readStore('store-1')
    assert.equal(recovered.seq, 3)
    assert.equal(
      recovered.collections.stationDevices?.legacy?.deviceTokenHash,
      createHash('sha256').update(legacyToken).digest('hex'),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

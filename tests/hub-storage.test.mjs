import test from 'node:test'
import assert from 'node:assert/strict'
import { appendFile, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HubStorage } from '../hub/src/storage.ts'

test('hub storage compacts change logs and recovers after restart and a torn final line', async () => {
  const root = await mkdtemp(join(tmpdir(), '7anouti-storage-test-'))
  try {
    const storage = new HubStorage(root)
    await storage.initialize()
    await storage.replaceStore('store-1', {
      storeId: 'store-1', seq: 0, collections: {}, appliedOpIds: [],
    })
    for (let index = 0; index < 250; index += 1) {
      await storage.transact('store-1', {
        opId: `operation-${index}`,
        deviceId: 'device-1',
        storeId: 'store-1',
        baseSeq: index,
        ops: [{
          kind: 'put',
          collection: 'products',
          id: 'product-1',
          document: { id: 'product-1', value: index, payload: 'x'.repeat(2048) },
        }],
      })
    }

    const path = join(root, 'stores', 'store-1.jsonl')
    const size = (await stat(path)).size
    assert.ok(size < 150_000, `expected compacted log under 150 KB, got ${size}`)
    const staleChanges = await storage.changesSince('store-1', 0)
    assert.equal(staleChanges.fullResyncRequired, true)
    const retainedChanges = await storage.changesSince('store-1', 200)
    assert.equal(retainedChanges.fullResyncRequired, false)
    assert.equal(retainedChanges.changes.length, 50)

    const restarted = new HubStorage(root)
    await restarted.initialize()
    const recovered = await restarted.readStore('store-1')
    assert.equal(recovered.seq, 250)
    assert.equal(recovered.collections.products?.['product-1']?.value, 249)

    await appendFile(path, '{"seq":251,"changeSet":', 'utf8')
    const afterTornWrite = await new HubStorage(root).readStore('store-1')
    assert.equal(afterTornWrite.seq, 250)
    assert.equal(afterTornWrite.collections.products?.['product-1']?.value, 249)
    await new HubStorage(root).transact('store-1', {
      opId: 'after-torn-write',
      deviceId: 'device-1',
      storeId: 'store-1',
      baseSeq: 250,
      ops: [{ kind: 'put', collection: 'products', id: 'product-1', document: { id: 'product-1', value: 250 } }],
    })
    assert.equal((await new HubStorage(root).readStore('store-1')).seq, 251)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('hub storage replays legacy full-state records', async () => {
  const root = await mkdtemp(join(tmpdir(), '7anouti-storage-legacy-test-'))
  try {
    await new HubStorage(root).initialize()
    const state = {
      storeId: 'store-1',
      seq: 1,
      collections: { products: { product: { id: 'product', value: 'legacy' } } },
      appliedOpIds: ['legacy-operation'],
    }
    const record = {
      seq: 1,
      changeSet: {
        opId: 'legacy-operation', deviceId: 'device-1', storeId: 'store-1', baseSeq: 0, ops: [],
      },
      state,
    }
    await writeFile(join(root, 'stores', 'store-1.jsonl'), `${JSON.stringify(record)}\n`, 'utf8')
    const recovered = await new HubStorage(root).readStore('store-1')
    assert.equal(recovered.seq, 1)
    assert.equal(recovered.collections.products?.product?.value, 'legacy')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

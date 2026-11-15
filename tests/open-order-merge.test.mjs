import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeOpenOrderItems } from '../src/lib/openOrderItemsMerge.ts'

test('merges appends by line id and preserves the latest edit to an existing line', () => {
  const earlier = {
    lineId: 'line-1',
    productId: 'coffee',
    name: 'Coffee',
    price: 2,
    qty: 1,
    status: 'draft',
    addedAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
  }
  const changed = { ...earlier, qty: 3, updatedAt: '2026-11-15T10:02:00.000Z' }
  const secondLine = { ...earlier, lineId: 'line-2', qty: 1, addedAt: '2026-11-15T10:01:00.000Z' }
  const merged = mergeOpenOrderItems(
    [earlier],
    [changed, secondLine],
    '2026-11-15T10:00:00.000Z',
    '2026-11-15T10:02:00.000Z',
  )

  assert.deepEqual(merged.map((item) => item.lineId).sort(), ['line-1', 'line-2'])
  assert.equal(merged.find((item) => item.lineId === 'line-1').qty, 3)
})

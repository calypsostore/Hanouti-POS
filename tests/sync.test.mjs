import test from 'node:test'
import assert from 'node:assert/strict'
import { applyChangeSet, diffCollections } from '../src/shared/sync.ts'

const metadata = { opId: 'op-1', deviceId: 'phone-1', storeId: 'store-1', baseSeq: 0 }

test('diff is id-based and independent of collection ordering', () => {
  const before = { products: [{ id: 'a', name: 'Tea' }, { id: 'b', name: 'Coffee' }] }
  const after = { products: [{ id: 'b', name: 'Coffee' }, { id: 'a', name: 'Mint tea' }, { id: 'c', name: 'Water' }] }
  const change = diffCollections(before, after, metadata)
  assert.deepEqual(change.ops.map((op) => [op.kind, op.id]), [['put', 'a'], ['put', 'c']])
  assert.deepEqual(diffCollections(after, before, metadata).ops, [{ kind: 'put', collection: 'products', id: 'a', document: before.products[0] }, { kind: 'delete', collection: 'products', id: 'c' }])
})

test('hub-order last writer wins for a concurrent table document edit', () => {
  let state = { seq: 0, collections: { tables: { t1: { id: 't1', name: 'Front' } } }, appliedOpIds: [] }
  state = applyChangeSet(state, { ...metadata, opId: 'a', ops: [{ kind: 'put', collection: 'tables', id: 't1', document: { id: 't1', name: 'Patio' } }] })
  state = applyChangeSet(state, { ...metadata, opId: 'b', baseSeq: 0, ops: [{ kind: 'put', collection: 'tables', id: 't1', document: { id: 't1', name: 'Garden' } }] })
  assert.equal(state.collections.tables.t1.name, 'Garden')
})

test('idempotency ignores duplicate op ids and reordering is stable', () => {
  const state = { seq: 0, collections: {}, appliedOpIds: [] }
  const first = applyChangeSet(state, { ...metadata, ops: [{ kind: 'put', collection: 'x', id: 'x1', document: { id: 'x1' } }] })
  assert.equal(applyChangeSet(first, { ...metadata, ops: [] }), first)
  const reordered = applyChangeSet(state, { ...metadata, ops: [{ kind: 'put', collection: 'x', id: 'x2', document: { id: 'x2' } }, { kind: 'put', collection: 'x', id: 'x1', document: { id: 'x1' } }] })
  assert.deepEqual(Object.keys(reordered.collections.x).sort(), ['x1', 'x2'])
})

test('reconnect replay does not duplicate order items or payments', () => {
  const change = { ...metadata, ops: [{ kind: 'put', collection: 'orderItems', id: 'o1', document: { id: 'o1', items: [{ id: 'i1', qty: 1 }] } }, { kind: 'put', collection: 'payments', id: 'p1', document: { id: 'p1', payments: [{ id: 'pay1', amount: 5 }] } }] }
  const state = applyChangeSet({ seq: 0, collections: {}, appliedOpIds: [] }, change)
  assert.equal(applyChangeSet(state, change), state)
  assert.equal(state.collections.orderItems.o1.items.length, 1)
  assert.equal(state.collections.payments.p1.payments.length, 1)
})

test('stale phone updates merge separate table lines and preserve the newest shared-line edit', () => {
  const initial = {
    seq: 0,
    collections: {
      openOrders: {
        order1: { id: 'order1', items: [{ lineId: 'old', qty: 1, updatedAt: '2026-01-01T10:00:00Z' }], tableHistory: [] },
      },
    },
    appliedOpIds: [],
  }
  const phoneA = applyChangeSet(initial, {
    ...metadata, opId: 'phone-a',
    ops: [{ kind: 'put', collection: 'openOrders', id: 'order1', document: {
      id: 'order1', items: [
        { lineId: 'old', qty: 2, updatedAt: '2026-01-01T10:02:00Z' },
        { lineId: 'a', qty: 1, updatedAt: '2026-01-01T10:02:00Z' },
      ], tableHistory: [{ id: 'event-a', at: '2026-01-01T10:02:00Z' }],
    } }],
  })
  const phoneB = applyChangeSet(phoneA, {
    ...metadata, opId: 'phone-b', baseSeq: 0,
    ops: [{ kind: 'put', collection: 'openOrders', id: 'order1', document: {
      id: 'order1', items: [
        { lineId: 'old', qty: 3, updatedAt: '2026-01-01T10:03:00Z' },
        { lineId: 'b', qty: 1, updatedAt: '2026-01-01T10:03:00Z' },
      ], tableHistory: [{ id: 'event-b', at: '2026-01-01T10:03:00Z' }],
    } }],
  })
  const order = phoneB.collections.openOrders.order1
  assert.deepEqual(order.items.map((item) => item.lineId).sort(), ['a', 'b', 'old'])
  assert.equal(order.items.find((item) => item.lineId === 'old').qty, 3)
  assert.deepEqual(order.tableHistory.map((event) => event.id).sort(), ['event-a', 'event-b'])
})

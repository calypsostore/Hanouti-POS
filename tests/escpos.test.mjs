import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeEscposText, linesToEscpos } from '../src/shared/escpos.ts'

test('encodes supported printer codepages and replaces unsupported glyphs', () => {
  assert.deepEqual([...encodeEscposText('€', 'cp1252')], [0x80])
  assert.deepEqual([...encodeEscposText('€', 'cp858')], [0xd5])
  assert.deepEqual([...encodeEscposText('é?', 'cp437')], [0x82, 0x3f])
  assert.deepEqual([...encodeEscposText('مرحبا', 'cp1252')], [0x3f, 0x3f, 0x3f, 0x3f, 0x3f])
})

test('renders drawer kick and selected partial/full/no-cut modes', () => {
  const partial = [...linesToEscpos([{ text: 'Cash' }], 80, { openDrawer: true })]
  assert.ok(partial.some((_, index) =>
    partial[index] === 0x1b && partial[index + 1] === 0x70 && partial[index + 4] === 0x78,
  ))
  assert.deepEqual(partial.slice(-3), [0x1d, 0x56, 0x01])

  const full = [...linesToEscpos([], 58, { cutMode: 'full' })]
  assert.deepEqual(full.slice(-3), [0x1d, 0x56, 0x00])
  const none = [...linesToEscpos([], 58, { cutMode: 'none' })]
  assert.deepEqual(none.slice(-3), [0x1b, 0x64, 0x04])
})

test('selects the printer codepage and limits rows to the requested paper width', () => {
  const bytes58 = [...linesToEscpos([{ text: 'X'.repeat(40) }], 58, { cutMode: 'none' })]
  const bytes80 = [...linesToEscpos([{ text: 'X'.repeat(40) }], 80, { cutMode: 'none' })]
  assert.equal(bytes58.filter((byte) => byte === 0x58).length, 32)
  assert.equal(bytes80.filter((byte) => byte === 0x58).length, 40)
  const cp850 = [...linesToEscpos([], 80, { codepage: 'cp850' })]
  assert.ok(cp850.includes(0x02))
})

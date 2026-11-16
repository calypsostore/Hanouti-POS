import test from 'node:test'
import assert from 'node:assert/strict'
import { applyAccent } from '../src/lib/theme.ts'

function applyAccentWithDocument(isDark, paletteId) {
  const properties = new Map()
  const previousDocument = globalThis.document
  globalThis.document = {
    documentElement: {
      classList: { contains: (name) => name === 'dark' && isDark },
      style: { setProperty: (name, value) => properties.set(name, value) },
    },
  }
  try {
    applyAccent(paletteId)
  } finally {
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
  return properties
}

test('selected palette updates primary brand tokens in light mode', () => {
  const properties = applyAccentWithDocument(false, 'ocean')

  assert.equal(properties.get('--color-brand-amber'), '#2c7794')
  assert.equal(properties.get('--color-brand-amber-hover'), '#22647e')
  assert.equal(properties.get('--color-brand-amber-pressed'), '#1b5266')
  assert.equal(properties.get('--color-brand-amber-soft'), '#eff6fa')
  assert.equal(properties.get('--color-brand-amber-focus'), '#1b5266')
})

test('selected palette updates primary brand tokens in dark mode', () => {
  const properties = applyAccentWithDocument(true, 'ocean')

  assert.equal(properties.get('--color-brand-amber'), '#a8d7e8')
  assert.equal(properties.get('--color-brand-amber-hover'), '#8dc9df')
  assert.equal(properties.get('--color-brand-amber-pressed'), '#73bad5')
  assert.equal(properties.get('--color-brand-amber-soft'), '#1c2842')
  assert.equal(properties.get('--color-brand-amber-focus'), '#73bad5')
})

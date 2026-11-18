import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.') || /\.[a-z\d]+$/i.test(specifier)) {
        throw error
      }
      return nextResolve(`${specifier}.ts`, context)
    }
  },
})

test('every README demo account authenticates against the seeded database', async () => {
  const [{ buildSeed }, { normalizePin }] = await Promise.all([
    import('../src/data/seed.ts'),
    import('../src/shared/pin.ts'),
  ])
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  const rows = readme.split(/\r?\n/).filter((line) => /^\| (?:Super admin|Store admin|Staff)/.test(line))
  const db = buildSeed()

  assert.equal(rows.length, 6, 'README should document all six seeded demo accounts')

  for (const row of rows) {
    const [, role = '', loginCell = '', credentialCell = ''] = row.split('|')
    const login = loginCell.trim().replaceAll('`', '').toLowerCase()
    const credentialMatch = /^(?:Password|PIN) `([^`]+)`$/.exec(credentialCell.trim())
    assert.ok(credentialMatch, `${role.trim()} should document one credential`)
    const credential = credentialMatch[1]
    const staffAccount = role.trim().startsWith('Staff')
    const account = db.users.find((user) => staffAccount
      ? (user.role === 'staff' || user.role === 'manager') && user.username?.toLowerCase() === login
      : user.role !== 'staff' && user.email?.toLowerCase() === login)

    assert.ok(account?.active, `${role.trim()} demo account should exist and be active`)
    assert.equal(
      staffAccount ? normalizePin(account?.pin ?? '') : account?.password,
      staffAccount ? normalizePin(credential) : credential,
      `${role.trim()} demo credential should match its seeded account`,
    )
  }
})

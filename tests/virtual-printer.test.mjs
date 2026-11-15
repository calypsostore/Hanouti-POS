import test from 'node:test'
import assert from 'node:assert/strict'
import { createConnection } from 'node:net'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startVirtualPrinter } from '../hub/src/printers/virtual-printer.ts'

test('virtual printer persists bytes when the TCP client closes immediately', async () => {
  const originalDataDir = process.env.HUB_DATA_DIR
  const dataDir = await mkdtemp(join(tmpdir(), '7anouti-virtual-printer-test-'))
  process.env.HUB_DATA_DIR = dataDir
  const server = await startVirtualPrinter(0)
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Virtual printer did not bind to a TCP port.')
    const bytes = Buffer.from([0x1b, 0x40, ...Buffer.from('test receipt')])
    const socket = createConnection(address.port, '127.0.0.1')
    await new Promise((resolveConnect, reject) => {
      socket.once('connect', resolveConnect)
      socket.once('error', reject)
    })
    const closed = new Promise((resolveClose, reject) => {
      socket.once('close', resolveClose)
      socket.once('error', reject)
    })
    socket.end(bytes)
    await closed

    let files = []
    for (let attempt = 0; attempt < 40; attempt += 1) {
      files = (await readdir(join(dataDir, 'virtual-printer'))).filter((name) => name.endsWith('.bin'))
      if (files.length) break
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25))
    }
    assert.equal(files.length, 1)
    assert.deepEqual(await readFile(join(dataDir, 'virtual-printer', files[0])), bytes)
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose))
    await rm(dataDir, { recursive: true, force: true })
    if (originalDataDir === undefined) delete process.env.HUB_DATA_DIR
    else process.env.HUB_DATA_DIR = originalDataDir
  }
})

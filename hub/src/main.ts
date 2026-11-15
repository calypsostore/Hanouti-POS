import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHubServer } from './server.ts'
import { HubStorage } from './storage.ts'

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2)
  const storage = new HubStorage()
  await storage.initialize()
  if (command === 'backup') {
    console.log(`Created backup: ${await storage.backupNow()}`)
    return
  }
  if (command === 'restore') {
    if (!argument) throw new Error('Usage: npm run hub -- restore <backup-file-name>')
    console.log(`Restored stores: ${(await storage.restoreSnapshot(argument)).join(', ') || 'none'}`)
    return
  }
  if (command === 'import-backup') {
    if (!argument) throw new Error('Usage: npm run hub -- import-backup <7anouti-backup.json>')
    const ids = await storage.importAppBackup(JSON.parse(await readFile(resolve(argument), 'utf8')) as unknown)
    console.log(`Imported stores: ${ids.join(', ')}`)
    return
  }
  const runtime = await createHubServer()
  const shutdown = async () => {
    await runtime.close()
    process.exitCode = 0
  }
  process.once('SIGINT', () => { void shutdown() })
  process.once('SIGTERM', () => { void shutdown() })
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Hub startup failed.')
  process.exitCode = 1
})

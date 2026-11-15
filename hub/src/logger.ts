import { appendFile, mkdir, rename, stat, rm } from 'node:fs/promises'
import { join } from 'node:path'

const MAX_LOG_BYTES = 5 * 1024 * 1024
const RETAINED_LOGS = 5

export async function logEvent(root: string, level: 'info' | 'warn' | 'error', message: string): Promise<void> {
  const folder = join(root, 'logs')
  await mkdir(folder, { recursive: true })
  const file = join(folder, 'hub.log')
  try {
    if ((await stat(file)).size >= MAX_LOG_BYTES) {
      for (let index = RETAINED_LOGS - 1; index >= 1; index -= 1) {
        try {
          await rm(join(folder, `hub.${index + 1}.log`), { force: true })
          await rename(join(folder, `hub.${index}.log`), join(folder, `hub.${index + 1}.log`))
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
      try { await rename(file, join(folder, 'hub.1.log')) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message.replace(/[\r\n]/g, ' ').slice(0, 1000)}\n`
  await appendFile(file, line, { encoding: 'utf8', mode: 0o600 })
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](line.trim())
}

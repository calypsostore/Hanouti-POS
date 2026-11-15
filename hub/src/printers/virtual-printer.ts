import { createServer, type Server } from 'node:net'
import { mkdir, appendFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function startVirtualPrinter(port = Number(process.env.HUB_VIRTUAL_PRINTER_PORT ?? 9101)): Promise<Server> {
  const folder = resolve(process.env.HUB_DATA_DIR ?? fileURLToPath(new URL('../data/', import.meta.url)), 'virtual-printer')
  await mkdir(folder, { recursive: true })
  const server = createServer((socket) => {
    const chunks: Buffer[] = []
    let flushTimer: NodeJS.Timeout | undefined
    const flush = () => {
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = undefined
      if (!chunks.length) return
      const bytes = Buffer.concat(chunks)
      chunks.length = 0
      const name = `job-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.bin`
      void appendFile(join(folder, 'jobs.jsonl'), `${JSON.stringify({ name, bytes: bytes.toString('base64'), createdAt: new Date().toISOString() })}\n`, { mode: 0o600 })
        .then(() => writeFile(join(folder, name), bytes, { mode: 0o600 }))
        .catch((error: unknown) => console.error(`Virtual printer could not save a job: ${error instanceof Error ? error.message : 'storage error'}`))
    }
    socket.on('data', (chunk) => {
      chunks.push(chunk)
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = setTimeout(flush, 120)
    })
    socket.on('close', flush)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  return server
}

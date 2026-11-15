import { createServer, type Server } from 'node:net'
import { mkdir, appendFile, readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function startVirtualPrinter(port = Number(process.env.HUB_VIRTUAL_PRINTER_PORT ?? 9101)): Promise<Server> {
  const folder = resolve(process.env.HUB_DATA_DIR ?? fileURLToPath(new URL('../data/', import.meta.url)), 'virtual-printer')
  await mkdir(folder, { recursive: true })
  const server = createServer((socket) => {
    const chunks: Buffer[] = []
    let flushTimer: NodeJS.Timeout | undefined
    socket.on('data', (chunk) => {
      chunks.push(chunk)
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = setTimeout(() => {
        const bytes = Buffer.concat(chunks)
        const name = `job-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.bin`
        void appendFile(join(folder, 'jobs.jsonl'), `${JSON.stringify({ name, bytes: bytes.toString('base64'), createdAt: new Date().toISOString() })}\n`, { mode: 0o600 })
        void import('node:fs/promises').then(({ writeFile }) => writeFile(join(folder, name), bytes, { mode: 0o600 }))
      }, 120)
    })
    socket.on('close', () => { if (flushTimer) clearTimeout(flushTimer) })
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

export async function virtualPrinterPreview(folder = resolve(process.env.HUB_DATA_DIR ?? fileURLToPath(new URL('../data/', import.meta.url)), 'virtual-printer')): Promise<string> {
  try {
    const names = (await readdir(folder)).filter((name) => name.endsWith('.bin')).sort().reverse().slice(0, 20)
    const items = await Promise.all(names.map(async (name) => {
      const bytes = await readFile(join(folder, name))
      const preview = [...bytes].map((byte) => byte >= 32 && byte < 127 ? String.fromCharCode(byte) : byte === 10 ? '\n' : ' ').join('')
      return `<article><h2>${name.replace(/[<>&"]/g, '')}</h2><pre>${preview.replace(/[<>&"]/g, '')}</pre></article>`
    }))
    return `<!doctype html><meta charset="utf-8"><title>Virtual printer preview</title><style>body{font:16px sans-serif;max-width:900px;margin:2rem auto}pre{white-space:pre-wrap;background:#f5f5f5;padding:1rem}</style><h1>Virtual printer jobs</h1>${items.join('') || '<p>No jobs yet.</p>'}`
  } catch (error) {
    throw new Error('Virtual printer preview is not available.', { cause: error })
  }
}

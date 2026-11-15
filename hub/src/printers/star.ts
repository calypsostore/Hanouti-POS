import { request } from 'node:http'
import type { PrintJobRecord } from './queue.ts'

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
})[character] ?? '')

export async function sendStarWebPrnt(host: string, port: number, job: PrintJobRecord): Promise<void> {
  const lines = job.payload.map((line) => {
    const align = line.align === 'center' ? 'center' : line.align === 'right' ? 'right' : 'left'
    const emphasis = line.bold ? ' emphasis="true"' : ''
    const size = line.size === 'double' ? ' width="2" height="2"' : ''
    return `<text align="${align}"${emphasis}${size}>${escapeXml(line.text)}&#10;</text>`
  }).join('')
  const drawer = job.openDrawer ? '<pulse channel="1" time="100"/>' : ''
  const xml = `<?xml version="1.0" encoding="utf-8"?><StarWebPrintRequest><print>${lines}${drawer}<cut type="feed"/></print></StarWebPrintRequest>`
  await new Promise<void>((resolve, reject) => {
    const req = request({
      hostname: host, port, path: '/StarWebPRNT/SendMessage', method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(xml) },
      timeout: 10_000,
    }, (response) => {
      response.resume()
      response.on('end', () => response.statusCode && response.statusCode >= 200 && response.statusCode < 300
        ? resolve()
        : reject(new Error(`Star WebPRNT returned HTTP ${response.statusCode ?? 'unknown'}.`)))
    })
    req.on('timeout', () => req.destroy(new Error('Star WebPRNT request timed out.')))
    req.on('error', reject)
    req.end(xml)
  })
}

export function cloudPrntResponse(job: unknown): { jobReady: boolean; mediaTypes: string[]; jobToken?: string; printJob?: string } {
  if (!job || typeof job !== 'object') return { jobReady: false, mediaTypes: ['application/vnd.star.line'] }
  const candidate = job as { id?: unknown; payload?: unknown }
  if (typeof candidate.id !== 'string' || typeof candidate.payload !== 'string') {
    return { jobReady: false, mediaTypes: ['application/vnd.star.line'] }
  }
  return { jobReady: true, jobToken: candidate.id, mediaTypes: ['application/vnd.star.line'], printJob: candidate.payload }
}

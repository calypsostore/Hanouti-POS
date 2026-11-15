import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'
import type { PrintJobRecord } from './queue.ts'

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
})[character] ?? '')

export async function sendEpos(host: string, port: number, job: PrintJobRecord): Promise<void> {
  const lines = job.payload.map((line) => {
    const align = line.align === 'center' || line.align === 'right' ? ` align="${line.align}"` : ''
    const emphasis = line.bold ? ' em="true"' : ''
    const size = line.size === 'double' ? ' width="2" height="2"' : ''
    return `<text${align}${emphasis}${size}>${escapeXml(line.text)}&#10;</text>`
  }).join('')
  const drawer = job.openDrawer ? '<pulse drawer="drawer_1" time="pulse_100"/>' : ''
  const xml = `<?xml version="1.0"?><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">${lines}${drawer}<cut type="feed"/></epos-print>`
  const protocol = port === 443 ? httpsRequest : httpRequest
  await new Promise<void>((resolve, reject) => {
    const req = protocol({
      hostname: host, port, path: '/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000',
      method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(xml) },
      timeout: 10_000,
    }, (response) => {
      response.resume()
      response.on('end', () => response.statusCode && response.statusCode >= 200 && response.statusCode < 300
        ? resolve()
        : reject(new Error(`Epson ePOS returned HTTP ${response.statusCode ?? 'unknown'}.`)))
    })
    req.on('timeout', () => req.destroy(new Error('Epson ePOS request timed out.')))
    req.on('error', reject)
    req.end(xml)
  })
}

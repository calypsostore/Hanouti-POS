import { Capacitor } from '@capacitor/core'
import type { PrintJob, PrintLine, Printer } from '../types'
import { linesToEscpos } from '../shared/escpos'
import { isWebSerialSupported, printBytes } from './printer'
import type { DevicePrintPreference } from '../types'
import { TcpPrinter } from 'tcp-printer'

export type PrintTransportResult = { ok: true } | { ok: false; error: string }

export interface PrintTransport {
  send(job: PrintJob, printer: Printer): Promise<PrintTransportResult>
}

const isLanIpv4 = (host: string): boolean => {
  const octets = host.split('.')
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) return false
  const [first, second, third, fourth] = octets.map(Number)
  if ([first, second, third, fourth].some((octet) => octet < 0 || octet > 255)) return false
  return first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
}

export const isNativeTcpPrinter = (printer: Printer): boolean =>
  Capacitor.isNativePlatform() &&
  printer.connection === 'hub-tcp' &&
  typeof printer.host === 'string' &&
  isLanIpv4(printer.host.trim())

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export const NativeTcpTransport: PrintTransport = {
  async send(job, printer) {
    const host = printer.host?.trim()
    if (!host) return { ok: false, error: 'Enter the printer LAN IP address.' }
    const bytes = linesToEscpos(job.payload, printer.paperWidth, {
      codepage: printer.codepage,
      cutMode: printer.cutMode,
      openDrawer: job.openDrawer,
    })
    const copies = new Uint8Array(bytes.length * job.copies)
    for (let copy = 0; copy < job.copies; copy += 1) {
      copies.set(bytes, copy * bytes.length)
    }
    try {
      const result = await TcpPrinter.send({
        host,
        port: printer.port || 9100,
        data: bytesToBase64(copies),
      })
      if (result.ok) return { ok: true }
      return { ok: false, error: result.error ?? `Could not print to ${host}:${printer.port || 9100}.` }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'The native TCP printer plugin failed.',
      }
    }
  },
}

export const HubTransport: PrintTransport = {
  async send() {
    return { ok: false, error: 'The shop hub is not connected.' }
  },
}

export const WebSerialTransport: PrintTransport = {
  async send(job, printer) {
    const bytes = linesToEscpos(job.payload, printer.paperWidth, {
      codepage: printer.codepage,
      cutMode: printer.cutMode,
      openDrawer: job.openDrawer,
    })
    for (let copy = 0; copy < job.copies; copy += 1) {
      const result = await printBytes(bytes)
      if (!result.ok) return result
    }
    return { ok: true }
  },
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

export const BrowserPrintTransport: PrintTransport = {
  async send(job, printer) {
    const popup = window.open('', '_blank')
    if (!popup) return { ok: false, error: 'The browser blocked the print window.' }
    popup.opener = null
    const rows = job.payload.map((line: PrintLine) => {
      const align = line.align ?? 'left'
      const weight = line.bold ? '700' : '400'
      const size = line.size === 'double' ? '1.8em' : '1em'
      return `<div style="text-align:${align};font-weight:${weight};font-size:${size};white-space:pre-wrap">${escapeHtml(line.text)}</div>`
    }).join('')
    const copies = Array.from({ length: job.copies }, (_, index) =>
      `<section class="copy${index < job.copies - 1 ? ' copy-break' : ''}">${rows}</section>`,
    ).join('')
    popup.document.write(`<!doctype html><html><head><title>Print job</title><style>
      @page{size:${printer.paperWidth}mm auto;margin:2mm}
      body{font-family:monospace;font-size:12px;width:${printer.paperWidth - 4}mm;margin:0}
      .copy-break{page-break-after:always}
    </style></head><body>${copies}</body></html>`)
    popup.document.close()
    popup.focus()
    popup.print()
    return { ok: true }
  },
}

export const WebBluetoothTransport: PrintTransport = {
  async send() {
    return { ok: false, error: 'This Bluetooth printer protocol is not configured.' }
  },
}

export const MockTransport = (send: PrintTransport['send']): PrintTransport => ({ send })

export const hasPrintCapability = (printer: Printer): boolean => {
  if (printer.connection === 'browser-print') return true
  if (printer.connection === 'browser-webserial') return isWebSerialSupported()
  if (printer.connection === 'browser-bluetooth') {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }
  return false
}

export const sendToPrintTransport = (
  job: PrintJob,
  printer: Printer,
  preference: DevicePrintPreference = 'this-device',
): Promise<PrintTransportResult> => {
  if (isNativeTcpPrinter(printer)) return NativeTcpTransport.send(job, printer)
  if (preference === 'hub') return HubTransport.send(job, printer)
  if (preference === 'browser') return BrowserPrintTransport.send(job, printer)
  if (printer.connection.startsWith('hub-')) return HubTransport.send(job, printer)
  if (printer.connection === 'browser-webserial') return WebSerialTransport.send(job, printer)
  if (printer.connection === 'browser-bluetooth') return WebBluetoothTransport.send(job, printer)
  if (printer.connection === 'browser-print') return BrowserPrintTransport.send(job, printer)
  return Promise.resolve({ ok: false, error: 'This printer is configured as a screen, not a printer.' })
}

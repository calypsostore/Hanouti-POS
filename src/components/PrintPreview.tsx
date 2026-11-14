import { useEffect, useState } from 'react'
import { Cable, Download, Printer, X } from 'lucide-react'
import { Button, Modal } from './ui'
import { useToast } from './toast'
import { useApp } from '../store/AppStore'
import { columnsFor, type ReceiptLine } from '../lib/escpos'
import { downloadReceiptPdf } from '../lib/receiptPdf'
import { ThermalReceipt } from './ThermalReceipt'
import type { PrinterWidth } from '../types'
import {
  connectPrinter,
  onPrinterState,
  printBytes,
  printerState,
} from '../lib/printer'

export interface PrintJob {
  title: string
  subtitle?: string
  lines: ReceiptLine[]
  /** Raw ESC/POS payload. Null → browser printing only. */
  bytes: Uint8Array | null
  kind: 'receipt' | 'kitchen' | 'report'
  width?: PrinterWidth
}

/**
 * Print dialog shared by POS receipts, kitchen tickets, X/Z reports and the
 * settings test page. Shares one thermal-width layout between preview,
 * browser printing, PDF export, and the ESC/POS byte stream.
 */
export function PrintModal({ job, onClose }: { job: PrintJob | null; onClose: () => void }) {
  const { store } = useApp()
  const { push } = useToast()
  const [state, setState] = useState(printerState())

  useEffect(() => onPrinterState(setState), [])

  if (!job || !store) return null
  const cfg = store.settings.printer
  const width = job.width ?? cfg.width
  const cols = columnsFor(width)
  const wantsSerial = cfg.enabled && cfg.connection === 'webserial'

  const send = async () => {
    if (!job.bytes) return
    const res = await printBytes(job.bytes)
    if (res.ok) {
      push('Sent to printer', 'success')
      onClose()
    } else {
      push(res.error, 'error')
    }
  }

  const connect = async () => {
    const res = await connectPrinter(cfg.baudRate)
    if (res.ok) push(`Printer connected · ${res.label}`, 'success')
    else push(res.error, 'error')
  }

  const browserPrint = () => {
    const printStyle = document.createElement('style')
    printStyle.textContent = `@media print {
      @page { size: ${width}mm auto; margin: 0; }
      body.thermal-receipt-print * { overflow: visible !important; max-height: none !important; }
      body.thermal-receipt-print .receipt-print { position: fixed !important; inset: 0 auto auto 0 !important; width: ${width}mm !important; max-width: none !important; max-height: none !important; overflow: visible !important; }
    }`
    document.head.append(printStyle)
    const cleanup = () => {
      printStyle.remove()
      document.body.classList.remove('thermal-receipt-print')
    }
    document.body.classList.add('thermal-receipt-print')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

  const downloadPdf = () => {
    try {
      const filename = `${job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
      downloadReceiptPdf(job.lines, width, filename)
      push('Receipt PDF downloaded', 'success')
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not create the receipt PDF.', 'error')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={job.title}
      subtitle={job.subtitle}
      footer={
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {wantsSerial && !state.connected && (
              <Button onClick={connect}>
                <Cable className="h-4 w-4" /> Connect printer / ESC/POS
              </Button>
            )}
            {wantsSerial && state.connected && (
              <Button onClick={send} disabled={!job.bytes || state.busy}>
                <Printer className="h-4 w-4" /> Print ESC/POS
              </Button>
            )}
            <Button variant="secondary" onClick={browserPrint}>
              <Printer className="h-4 w-4" /> Browser print
            </Button>
            <Button variant="secondary" onClick={downloadPdf}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" /> Close
            </Button>
          </div>
          <div className="text-[10.5px] leading-relaxed text-muted">
            {cfg.enabled
              ? wantsSerial
                ? state.connected
                  ? `${state.label} · ${width}mm · ${cols} columns`
                  : 'Connect a 58/80mm ESC/POS printer, or use browser print. WebSerial works in Chrome / Edge on desktop.'
                : 'Browser printing only (WebSerial disabled in settings).'
              : 'Printing is disabled in settings — this is a preview only.'}
          </div>
        </div>
      }
    >
      <div className="space-y-2">
        <div className="text-center text-[11px] font-medium text-muted">
          Receipt width: {width} mm · {cols} characters per line
        </div>
        <div className="thermal-preview-host -mx-5 flex max-h-[58vh] justify-center overflow-x-hidden overflow-y-auto bg-neutral-100 px-2 py-4 sm:-mx-6">
          <div
            className="receipt-print mx-auto shrink-0"
            data-receipt-width={width}
            style={{ width: `${width}mm`, maxWidth: '100%' }}
          >
            <ThermalReceipt lines={job.lines} width={width} />
          </div>
        </div>
      </div>
    </Modal>
  )
}

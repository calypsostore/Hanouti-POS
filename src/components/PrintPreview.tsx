import { useEffect, useState } from 'react'
import { Cable, Printer, Usb, X } from 'lucide-react'
import { Button, Modal } from './ui'
import { useToast } from './toast'
import { useApp } from '../store/AppStore'
import { columnsFor, linesToText, type ReceiptLine } from '../lib/escpos'
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
}

/**
 * Print dialog shared by POS receipts, kitchen tickets, X/Z reports and the
 * settings test page. Shows a monospace preview of exactly what the thermal
 * printer will receive, then either sends raw ESC/POS bytes over WebSerial or
 * falls back to the browser print dialog.
 */
export function PrintModal({ job, onClose }: { job: PrintJob | null; onClose: () => void }) {
  const { store } = useApp()
  const { push } = useToast()
  const [state, setState] = useState(printerState())

  useEffect(() => onPrinterState(setState), [])

  if (!job || !store) return null
  const cfg = store.settings.printer
  const cols = columnsFor(cfg.width)
  const text = linesToText(job.lines, cols)
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

  return (
    <Modal
      open
      onClose={onClose}
      title={job.title}
      subtitle={job.subtitle}
      footer={
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {wantsSerial && state.connected && (
              <Button onClick={send} disabled={!job.bytes || state.busy}>
                <Printer className="h-4 w-4" /> Send to printer
              </Button>
            )}
            {wantsSerial && !state.connected && (
              <Button onClick={connect}>
                <Cable className="h-4 w-4" /> Connect printer
              </Button>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              <Usb className="h-4 w-4" /> Browser print
            </Button>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" /> Close
            </Button>
          </div>
          <div className="text-[10.5px] leading-relaxed text-muted">
            {cfg.enabled
              ? wantsSerial
                ? state.connected
                  ? `${state.label} · ${cfg.width}mm · ${cols} columns`
                  : 'Connect a 58/80mm ESC/POS printer, or use browser print. WebSerial works in Chrome / Edge on desktop.'
                : 'Browser printing only (WebSerial disabled in settings).'
              : 'Printing is disabled in settings — this is a preview only.'}
          </div>
        </div>
      }
    >
      <div className="rounded-xl bg-neutral-200/70 p-3">
        <div className="receipt-print max-h-[52vh] overflow-auto">
          <pre
            className="receipt-preview mx-auto bg-white px-4 py-3 font-mono text-[11px] leading-[1.45] text-neutral-900"
            style={{ width: cfg.width === 58 ? 302 : 340 }}
          >
            {text}
          </pre>
        </div>
      </div>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { Cable, Download, Printer, X } from 'lucide-react'
import { Button, Modal } from './ui'
import { useToast } from './toast'
import { useApp } from '../store/AppStore'
import { columnsFor, type ReceiptLine } from '../lib/escpos'
import { downloadReceiptPdf } from '../lib/receiptPdf'
import { ThermalReceipt } from './ThermalReceipt'
import type { PrinterWidth } from '../types'
import type { RegisterItemsReport } from '../types'
import type { PrintJobType } from '../types'
import { RegisterItemsTable } from './RegisterItemsTable'
import {
  connectPrinter,
  onPrinterState,
  printBytes,
  printerState,
} from '../lib/printer'
import { resolvePrintPrinter } from '../lib/printRouting'

export interface PrintJob {
  title: string
  subtitle?: string
  lines: ReceiptLine[]
  /** Raw ESC/POS payload. Null → browser printing only. */
  bytes: Uint8Array | null
  kind: PrintJobType
  stationId?: string
  stationTickets?: Array<{ stationId: string; lines: ReceiptLine[] }>
  width?: PrinterWidth
  itemsReport?: RegisterItemsReport
  itemsRebuiltFromOrders?: boolean
  openDrawer?: boolean
}

/**
 * Print dialog shared by POS receipts, kitchen tickets, X/Z reports and the
 * settings test page. Shares one thermal-width layout between preview,
 * browser printing, PDF export, and the ESC/POS byte stream.
 */
export function PrintModal({ job, onClose }: { job: PrintJob | null; onClose: () => void }) {
  const { store, db, enqueuePrint } = useApp()
  const { push } = useToast()
  const [state, setState] = useState(printerState())
  const [sentStationState, setSentStationState] = useState<{ job: PrintJob | null; ids: Set<string> }>({
    job: null,
    ids: new Set(),
  })

  useEffect(() => onPrinterState(setState), [])

  if (!job || !store) return null
  const cfg = store.settings.printer
  const sentStationIds = sentStationState.job === job ? sentStationState.ids : new Set<string>()
  const markStationTicketsSent = (ids: string[]) => setSentStationState((current) => ({
    job,
    ids: new Set([...(current.job === job ? current.ids : []), ...ids]),
  }))
  const width = job.width ?? cfg.width
  const cols = columnsFor(width)
  const configuredPrinters = db.printers.filter((printer) => printer.storeId === store.id && printer.enabled)
  const targetPrinter = resolvePrintPrinter(db, store.id, job.kind, job.stationId)
  const stationTargets = job.stationTickets?.map((ticket) => ({
    ...ticket,
    printer: resolvePrintPrinter(db, store.id, job.kind, ticket.stationId),
  })).filter((ticket) => !sentStationIds.has(ticket.stationId))
  const configuredStationTargets = stationTargets?.filter((ticket) => !!ticket.printer) ?? []
  const serialTarget = configuredStationTargets.find((ticket) => ticket.printer?.connection === 'browser-webserial')?.printer
  const wantsSerial = stationTargets
    ? Boolean(serialTarget)
    : targetPrinter
      ? targetPrinter.connection === 'browser-webserial'
      : configuredPrinters.length === 0 && cfg.enabled && cfg.connection === 'webserial'

  const send = async () => {
    if (!job.bytes) return
    let res: { ok: true } | { ok: false; error: string }
    if (stationTargets?.length && configuredStationTargets.length) {
      const failures: string[] = []
      const succeeded: string[] = []
      for (const ticket of configuredStationTargets) {
        const result = await enqueuePrint({
          type: job.kind,
          stationId: ticket.stationId,
          printerId: ticket.printer?.id,
          payload: ticket.lines,
        })
        if (!result.ok) failures.push(result.error)
        else succeeded.push(ticket.stationId)
      }
      if (succeeded.length) markStationTicketsSent(succeeded)
      res = failures.length ? { ok: false, error: failures.join(' ') } : { ok: true }
    } else if (targetPrinter) {
      res = await enqueuePrint({
        type: job.kind,
        stationId: job.stationId,
        printerId: targetPrinter.id,
        payload: job.lines,
        openDrawer: job.openDrawer,
      })
    } else {
      res = await printBytes(job.bytes)
    }
    if (res.ok) {
      if (stationTargets?.some((ticket) => !ticket.printer)) {
        push('Configured station tickets sent; unassigned tickets remain in preview.', 'success')
      } else {
        push('Sent to printer', 'success')
        onClose()
      }
    } else {
      push(res.error, 'error')
    }
  }

  const connect = async () => {
    const res = await connectPrinter(serialTarget?.baudRate ?? targetPrinter?.baudRate ?? cfg.baudRate)
    if (res.ok) push(`Printer connected · ${res.label}`, 'success')
    else push(res.error, 'error')
  }

  const browserPrint = () => {
    if (configuredStationTargets.length && configuredStationTargets.every((ticket) =>
      ticket.printer?.connection === 'browser-print',
    )) {
      void Promise.all(configuredStationTargets.map((ticket) => enqueuePrint({
        type: job.kind,
        stationId: ticket.stationId,
        printerId: ticket.printer?.id,
        payload: ticket.lines,
      }))).then((results) => {
        const succeeded = results.flatMap((result, index) =>
          result.ok ? [configuredStationTargets[index].stationId] : [],
        )
        if (succeeded.length) markStationTicketsSent(succeeded)
        const failures = results.filter((result) => !result.ok)
        if (failures.length) push(failures.map((result) => result.error).join(' '), 'error')
        else {
          if (stationTargets?.some((ticket) => !ticket.printer)) {
            push('Configured station tickets sent; unassigned tickets remain in preview.', 'success')
          } else {
            push('Print jobs completed', 'success')
            onClose()
          }
        }
      })
      return
    }
    const configuredBrowserPrinter = targetPrinter?.connection === 'browser-print' ? targetPrinter : undefined
    if (configuredBrowserPrinter) {
      void enqueuePrint({
        type: job.kind,
        stationId: job.stationId,
        printerId: configuredBrowserPrinter.id,
        payload: job.lines,
        openDrawer: job.openDrawer,
      }).then((result) => {
        if (result.ok) {
          push('Print job completed', 'success')
          onClose()
        } else {
          push(result.error, 'error')
        }
      })
      return
    }
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

  const displayLines = stationTargets
    ? stationTargets.flatMap((ticket) => ticket.lines)
    : job.lines

  const downloadPdf = () => {
    try {
      const filename = `${job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
      downloadReceiptPdf(displayLines, width, filename)
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
                <Printer className="h-4 w-4" /> {job.stationTickets ? 'Send to configured printers' : 'Print ESC/POS'}
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
      <div className="space-y-4">
        <div className="text-center text-[11px] font-medium text-muted">
          Receipt width: {width} mm · {cols} characters per line
        </div>
        <div className="thermal-preview-host -mx-5 flex max-h-[58vh] justify-center overflow-x-hidden overflow-y-auto bg-neutral-100 px-2 py-4 sm:-mx-6">
          <div
            className="receipt-print mx-auto shrink-0"
            data-receipt-width={width}
            style={{ width: `${width}mm`, maxWidth: '100%' }}
          >
            <ThermalReceipt lines={displayLines} width={width} />
          </div>
        </div>
        {job.itemsReport && (
          <RegisterItemsTable
            report={job.itemsReport}
            title="Report item detail"
            rebuiltFromOrders={job.itemsRebuiltFromOrders}
          />
        )}
      </div>
    </Modal>
  )
}

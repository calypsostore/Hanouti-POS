import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChefHat, Printer } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { Order } from '../../types'
import { PrintModal, type PrintJob } from '../../components/PrintPreview'
import { ReceiptView } from '../../components/ReceiptView'
import { useToast } from '../../components/toast'
import { buildKitchenLines, buildReceiptLines, linesToEscpos } from '../../lib/escpos'
import { onPrinterState, printBytes, printerState } from '../../lib/printer'
import { Button, Modal } from '../../components/ui'
import { fmtTime } from '../../lib/utils'
import { preparationTicketsEnabled } from '../../lib/defaults'

export function ReceiptModal({
  order,
  customerName,
  onClose,
}: {
  order: Order | null
  customerName?: string
  onClose: () => void
}) {
  const { store } = useApp()
  const { push } = useToast()
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)
  const [printer, setPrinter] = useState(printerState())
  // Guards double auto-printing across StrictMode's double effect invocation.
  const autoPrinted = useRef<Set<string>>(new Set())

  useEffect(() => onPrinterState(setPrinter), [])

  useEffect(() => {
    if (!order || !store) return
    if (autoPrinted.current.has(order.id)) return
    const cfg = store.settings.printer
    if (!cfg.enabled || cfg.mode !== 'auto') return
    autoPrinted.current.add(order.id)

    if (cfg.connection === 'webserial') {
      // Silent thermal send; if no printer is attached, fall back to the dialog.
      void (async () => {
        const bytes = linesToEscpos(buildReceiptLines(order, store, { customerName }), cfg.width)
        const res = await printBytes(bytes)
        if (res.ok) {
          push('Receipt sent to printer', 'success')
        } else {
          setPrintJob({
            title: 'Receipt',
            subtitle: `Order #${order.number}`,
            lines: buildReceiptLines(order, store, { customerName }),
            bytes,
            kind: 'receipt',
          })
        }
      })()
    } else {
      const t = window.setTimeout(() => window.print(), 400)
      return () => window.clearTimeout(t)
    }
  }, [order, store, customerName, push])

  if (!order || !store) return null
  const cfg = store.settings.printer
  const isTableOrder = order.items.some((item) => item.status !== undefined || item.sentAt !== undefined)
  const kitchenWanted = cfg.enabled && order.channel === 'dine-in' &&
    preparationTicketsEnabled(store.settings) && !isTableOrder

  const openPrintDialog = (kind: 'receipt' | 'kitchen') => {
    const lines = kind === 'kitchen' ? buildKitchenLines(order, store) : buildReceiptLines(order, store, { customerName })
    setPrintJob({
      title: kind === 'kitchen' ? 'Kitchen ticket' : 'Receipt',
      subtitle: `Order #${order.number}`,
      lines,
      bytes: linesToEscpos(lines, cfg.width),
      kind,
    })
  }

  const sendKitchen = async () => {
    const bytes = linesToEscpos(buildKitchenLines(order, store), cfg.width)
    const res = await printBytes(bytes)
    if (res.ok) push('Kitchen ticket sent', 'success')
    else push(res.error, 'error')
  }

  return (
    <>
      <Modal
        open={!!order}
        onClose={onClose}
        title="Sale completed"
        subtitle={`Order #${order.number} · ${fmtTime(order.createdAt)}`}
        size="sm"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              New sale
            </Button>
            <Button className="flex-1" onClick={() => openPrintDialog('receipt')}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            {kitchenWanted && (
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  if (cfg.connection === 'webserial' && printer.connected) void sendKitchen()
                  else openPrintDialog('kitchen')
                }}
              >
                <ChefHat className="h-4 w-4" /> Kitchen
              </Button>
            )}
          </div>
        }
      >
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-[var(--semantic-green-soft)] py-2.5 text-[12.5px] font-semibold text-[var(--semantic-green-text)]">
          <CheckCircle2 className="h-4 w-4" />
          {order.paymentMethod === 'credit'
            ? `Charged to ${customerName ?? 'customer'}'s tab`
            : order.paymentMethod === 'cash'
              ? 'Paid in cash'
              : 'Paid by card'}
        </div>

        <div className="receipt-print">
          <ReceiptView order={order} store={store} />
        </div>
      </Modal>

      <PrintModal job={printJob} onClose={() => setPrintJob(null)} />
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChefHat, Printer } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { Order } from '../../types'
import { PrintModal, type PrintJob } from '../../components/PrintPreview'
import { ReceiptView } from '../../components/ReceiptView'
import { useToast } from '../../components/toast'
import { buildKitchenLines, buildReceiptLines, linesToEscpos } from '../../lib/escpos'
import { Button, Modal } from '../../components/ui'
import { fmtTime } from '../../lib/utils'
import { preparationTicketsEnabled } from '../../lib/defaults'
import { resolvePrintPrinter } from '../../lib/printRouting'
import { shouldAutoPrintReceipt } from '../../lib/automation'
import { readDeviceReceiptPolicy } from '../../lib/printPreferences'
import { orderNumberLabel } from '../../lib/orderNumber'

export function ReceiptModal({
  order,
  customerName,
  onClose,
}: {
  order: Order | null
  customerName?: string
  onClose: () => void
}) {
  const { store, db, enqueuePrint } = useApp()
  const { push } = useToast()
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)
  const autoPrinted = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!order || !store) return
    if (autoPrinted.current.has(order.id)) return
    const receiptPolicy = readDeviceReceiptPolicy(store.id, store.settings.receiptPrintPolicy)
    if (!shouldAutoPrintReceipt(receiptPolicy)) return
    autoPrinted.current.add(order.id)
    const lines = buildReceiptLines(order, store, { customerName })
    const targetPrinter = resolvePrintPrinter(db, store.id, 'receipt')
    if (!targetPrinter) {
      setPrintJob({
        title: 'Receipt',
        subtitle: `Order #${orderNumberLabel(order, store.settings)}`,
        lines,
        bytes: linesToEscpos(lines, store.settings.printer.width),
        kind: 'receipt',
      })
      return
    }
    void enqueuePrint({
      type: 'receipt',
      printerId: targetPrinter.id,
      payload: lines,
      openDrawer: store.settings.automation.drawerKickOnCash &&
        order.paymentMethod === 'cash' && targetPrinter.openDrawerOnCash,
    }).then((result) => {
      if (result.ok) push('Receipt sent to printer', 'success')
      else push(result.error, 'error')
    })
  }, [db, enqueuePrint, order, store, customerName, push])

  if (!order || !store) return null
  const cfg = store.settings.printer
  const isTableOrder = order.items.some((item) => item.status !== undefined || item.sentAt !== undefined)
  const kitchenWanted = cfg.enabled && order.channel === 'dine-in' &&
    preparationTicketsEnabled(store.settings) && !isTableOrder

  const openPrintDialog = (kind: 'receipt' | 'kitchen') => {
    const lines = kind === 'kitchen' ? buildKitchenLines(order, store) : buildReceiptLines(order, store, { customerName })
    const targetPrinter = resolvePrintPrinter(db, store.id, kind)
    setPrintJob({
      title: kind === 'kitchen' ? 'Kitchen ticket' : 'Receipt',
      subtitle: `Order #${orderNumberLabel(order, store.settings)}`,
      lines,
      bytes: linesToEscpos(lines, cfg.width),
      kind,
      openDrawer: kind === 'receipt' && order.paymentMethod === 'cash' &&
        store.settings.automation.drawerKickOnCash && targetPrinter?.openDrawerOnCash === true,
    })
  }

  return (
    <>
      <Modal
        open={!!order}
        onClose={onClose}
        title="Sale completed"
        subtitle={`Order #${orderNumberLabel(order, store.settings)} · ${fmtTime(order.createdAt)}`}
        size="sm"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              New sale
            </Button>
            {readDeviceReceiptPolicy(store.id, store.settings.receiptPrintPolicy) !== 'never' && (
              <Button className="flex-1" onClick={() => openPrintDialog('receipt')}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            )}
            {kitchenWanted && store.settings.stationTicketPrintPolicy !== 'never' && (
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => openPrintDialog('kitchen')}
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

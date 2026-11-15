import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { buildReceiptLines, linesToEscpos } from '../lib/escpos'
import { useApp } from '../store/AppStore'
import { PrintModal, type PrintJob } from './PrintPreview'
import { useToast } from './toast'

export function ReprintLastReceipt({ compact = false }: { compact?: boolean }) {
  const { db, store } = useApp()
  const { push } = useToast()
  const [job, setJob] = useState<PrintJob | null>(null)
  const lastOrder = useMemo(() => store
    ? [...db.orders]
      .filter((order) => order.storeId === store.id && order.status === 'completed')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : undefined, [db.orders, store])

  const openReceipt = () => {
    if (!store || !lastOrder) {
      push('There is no completed receipt to reprint.', 'error')
      return
    }
    const customerName = db.customers.find((customer) =>
      customer.id === lastOrder.customerId && customer.storeId === store.id,
    )?.name
    const lines = buildReceiptLines(lastOrder, store, { customerName })
    setJob({
      title: 'Reprint last receipt',
      subtitle: `Order #${lastOrder.number}`,
      lines,
      bytes: linesToEscpos(lines, store.settings.printer.width),
      kind: 'receipt',
      openDrawer: false,
    })
  }

  return (
    <>
      <button type="button" onClick={openReceipt} disabled={!lastOrder}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 text-[11px] font-semibold text-ink transition hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-espresso-800"
        title="Open the latest receipt for reprinting">
        <Printer className="h-3.5 w-3.5" />
        {!compact && <span>Reprint last receipt</span>}
      </button>
      <PrintModal job={job} onClose={() => setJob(null)} />
    </>
  )
}

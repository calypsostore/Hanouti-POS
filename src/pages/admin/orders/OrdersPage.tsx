import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Banknote,
  CreditCard,
  Download,
  ReceiptText,
  Wallet,
} from 'lucide-react'
import { useApp } from '../../../store/AppStore'
import type { Order } from '../../../types'
import { Button } from '../../../components/ui'
import { PrintModal, type PrintJob } from '../../../components/PrintPreview'
import { useToast } from '../../../components/toast'
import { buildReceiptLines, linesToEscpos } from '../../../lib/escpos'
import { balanceFor } from '../../../lib/selectors'
import { csvDownload, dateKey, fmtDate, fmtTime, money, sum } from '../../../lib/utils'
import { MiniStat } from './components/OrderPrimitives'
import OrdersList from './components/OrdersList'
import OrderDetailsDrawer from './components/OrderDetailsDrawer'
import VoidOrderModal from './components/VoidOrderModal'
import type { OrderMethod, OrderRange, OrderStatus } from './types'

export default function OrdersPage() {
  const { db, store, user, voidOrder } = useApp()
  const [searchParams] = useSearchParams()
  const { push } = useToast()
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<OrderRange>('today')
  const [method, setMethod] = useState<OrderMethod>('all')
  const [status, setStatus] = useState<OrderStatus>('all')
  const [tableId, setTableId] = useState('all')
  const [selected, setSelected] = useState<Order | null>(null)
  const [voidTarget, setVoidTarget] = useState<Order | null>(null)
  const [voidPin, setVoidPin] = useState('')
  const [voidReason, setVoidReason] = useState('')
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)
  const [limit, setLimit] = useState(20)

  if (!store || !user) return null

  const customers = db.customers.filter((customer) => customer.storeId === store.id)
  const customerName = (id?: string) => customers.find((customer) => customer.id === id)?.name
  const myOrders = user.role === 'staff' && searchParams.get('mine') === 'true'
  const tableNames = new Map(
    db.tables.filter((table) => table.storeId === store.id).map((table) => [table.id, table.name]),
  )
  db.orders.filter((order) => order.storeId === store.id && order.tableId).forEach((order) => {
    if (order.tableId && !tableNames.has(order.tableId)) {
      tableNames.set(order.tableId, order.tableName ?? 'Former table')
    }
  })
  const tableOptions = [...tableNames].map(([id, name]) => ({ id, name }))

  const boundary = new Date()
  if (range === '7d') boundary.setDate(boundary.getDate() - 6)
  if (range === '30d') boundary.setDate(boundary.getDate() - 29)
  boundary.setHours(0, 0, 0, 0)
  const filtered = db.orders
    .filter((order) => order.storeId === store.id)
    .filter((order) => !myOrders || order.staffId === user.id)
    .filter((order) =>
      range === 'today'
        ? dateKey(order.createdAt) === dateKey(new Date())
        : range === 'all'
          ? true
          : new Date(order.createdAt) >= boundary,
    )
    .filter((order) => method === 'all' || order.paymentMethod === method)
    .filter((order) => status === 'all' || order.status === status)
    .filter((order) => tableId === 'all' || order.tableId === tableId)
    .filter((order) => {
      if (!query.trim()) return true
      const search = query.trim().toLowerCase()
      return (
        String(order.number).includes(search) ||
        order.staffName.toLowerCase().includes(search) ||
        (customerName(order.customerId) ?? '').toLowerCase().includes(search) ||
        (order.tableName ?? '').toLowerCase().includes(search) ||
        order.items.some((item) => item.name.toLowerCase().includes(search))
      )
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  const completed = filtered.filter((order) => order.status === 'completed')
  const revenue = sum(completed, (order) => order.total)
  const creditTotal = sum(
    completed.filter((order) => order.paymentMethod === 'credit'),
    (order) => order.total,
  )

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Order', 'Date', 'Time', 'Channel', 'Table', 'Guests', 'Customer', 'Staff', 'Payment', 'Status', 'Items', 'Total (DT)'],
      ...filtered.map((order) => [
        order.number,
        fmtDate(order.createdAt),
        fmtTime(order.createdAt),
        order.channel,
        order.tableName ?? '',
        order.guests ?? '',
        customerName(order.customerId) ?? 'Guest',
        order.staffName,
        order.paymentMethod,
        order.status,
        order.items.map((item) => `${item.qty}x ${item.name}`).join(' | '),
        order.total.toFixed(3),
      ]),
    ]
    csvDownload(`orders-${store.slug}-${range}.csv`, rows)
    push('Orders exported to CSV')
  }

  const reprint = (order: Order) => {
    const lines = buildReceiptLines(order, store, {
      reprint: true,
      customerName: customerName(order.customerId),
    })
    setPrintJob({
      title: `Reprint · Order #${order.number}`,
      subtitle: store.name,
      lines,
      bytes: linesToEscpos(lines, store.settings.printer.width),
      kind: 'receipt',
    })
  }

  const confirmVoid = async () => {
    if (!voidTarget) return
    const result = await voidOrder(voidTarget.id, user.role === 'admin' ? undefined : voidPin, voidReason)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Order #${voidTarget.number} voided`, 'info')
    setVoidTarget(null)
    setVoidPin('')
    setVoidReason('')
    setSelected(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Orders</h2>
          <p className="mt-1 text-[13px] text-muted">
            {myOrders ? 'Your sales and voids — searchable and exportable.' : 'Every sale, tab and void — searchable and exportable.'}
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Orders" value={String(filtered.length)} icon={<ReceiptText className="h-4 w-4" />} />
        <MiniStat label="Revenue" value={money(revenue)} icon={<Banknote className="h-4 w-4" />} />
        <MiniStat
          label="Average ticket"
          value={money(completed.length ? revenue / completed.length : 0)}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <MiniStat label="Charged to tabs" value={money(creditTotal)} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <OrdersList
        filtered={filtered}
        customerName={customerName}
        query={query}
        onQueryChange={setQuery}
        range={range}
        onRangeChange={(nextRange) => {
          setRange(nextRange)
          setLimit(20)
        }}
        tableId={tableId}
        tableOptions={tableOptions}
        onTableIdChange={(id) => {
          setTableId(id)
          setLimit(20)
        }}
        method={method}
        onMethodChange={setMethod}
        status={status}
        onStatusChange={setStatus}
        limit={limit}
        onLoadMore={() => setLimit((current) => current + 25)}
        onSelect={setSelected}
      />

      <OrderDetailsDrawer
        order={selected}
        store={store}
        customerName={customerName}
        balanceForCustomer={(customerId) => balanceFor(db.ledger, customerId)}
        isAdmin={user.role === 'admin'}
        onClose={() => setSelected(null)}
        onVoid={() => {
          if (!selected) return
          setVoidPin('')
          setVoidReason('')
          setVoidTarget(selected)
        }}
        onReprint={reprint}
      />

      <VoidOrderModal
        order={voidTarget}
        isAdmin={user.role === 'admin'}
        pin={voidPin}
        reason={voidReason}
        onPinChange={setVoidPin}
        onReasonChange={setVoidReason}
        onClose={() => {
          setVoidTarget(null)
          setVoidReason('')
        }}
        onConfirm={confirmVoid}
      />
      <PrintModal job={printJob} onClose={() => setPrintJob(null)} />
    </div>
  )
}

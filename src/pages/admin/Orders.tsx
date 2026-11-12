import { useState } from 'react'
import {
  Banknote,
  CreditCard,
  Download,
  Eye,
  KeyRound,
  Printer,
  ReceiptText,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { Order } from '../../types'
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Field,
  Input,
  Modal,
  Segmented,
  Select,
} from '../../components/ui'
import { PrintModal, type PrintJob } from '../../components/PrintPreview'
import { ReceiptView } from '../../components/ReceiptView'
import { useToast } from '../../components/toast'
import { balanceFor } from '../../lib/selectors'
import { buildReceiptLines, linesToEscpos } from '../../lib/escpos'
import { cn, csvDownload, dateKey, fmtDate, fmtTime, money, sum } from '../../lib/utils'

type Range = 'today' | '7d' | '30d' | 'all'
type Method = 'all' | 'cash' | 'card' | 'credit'
type Status = 'all' | 'completed' | 'void'

export default function Orders() {
  const { db, store, user, voidOrder } = useApp()
  const { push } = useToast()
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<Range>('today')
  const [method, setMethod] = useState<Method>('all')
  const [status, setStatus] = useState<Status>('all')
  const [selected, setSelected] = useState<Order | null>(null)
  const [voidTarget, setVoidTarget] = useState<Order | null>(null)
  const [voidPin, setVoidPin] = useState('')
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)
  const [limit, setLimit] = useState(20)

  if (!store || !user) return null

  const customers = db.customers.filter((c) => c.storeId === store.id)
  const customerName = (id?: string) => customers.find((c) => c.id === id)?.name

  const filtered = (() => {
    const boundary = new Date()
    if (range === '7d') boundary.setDate(boundary.getDate() - 6)
    if (range === '30d') boundary.setDate(boundary.getDate() - 29)
    boundary.setHours(0, 0, 0, 0)

    return db.orders
      .filter((o) => o.storeId === store.id)
      .filter((o) => (range === 'today' ? dateKey(o.createdAt) === dateKey(new Date()) : range === 'all' ? true : new Date(o.createdAt) >= boundary))
      .filter((o) => method === 'all' || o.paymentMethod === method)
      .filter((o) => status === 'all' || o.status === status)
      .filter((o) => {
        if (!query.trim()) return true
        const q = query.trim().toLowerCase()
        return (
          String(o.number).includes(q) ||
          o.staffName.toLowerCase().includes(q) ||
          (customerName(o.customerId) ?? '').toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  })()

  const completed = filtered.filter((o) => o.status === 'completed')
  const revenue = sum(completed, (o) => o.total)
  const creditTotal = sum(
    completed.filter((o) => o.paymentMethod === 'credit'),
    (o) => o.total,
  )

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Order', 'Date', 'Time', 'Channel', 'Customer', 'Staff', 'Payment', 'Status', 'Items', 'Total (DT)'],
      ...filtered.map((o) => [
        o.number,
        fmtDate(o.createdAt),
        fmtTime(o.createdAt),
        o.channel,
        customerName(o.customerId) ?? 'Guest',
        o.staffName,
        o.paymentMethod,
        o.status,
        o.items.map((i) => `${i.qty}x ${i.name}`).join(' | '),
        o.total.toFixed(3),
      ]),
    ]
    csvDownload(`orders-${store.slug}-${range}.csv`, rows)
    push('Orders exported to CSV')
  }

  const reprint = (o: Order) => {
    const lines = buildReceiptLines(o, store, {
      reprint: true,
      customerName: customerName(o.customerId),
    })
    setPrintJob({
      title: `Reprint · Order #${o.number}`,
      subtitle: store.name,
      lines,
      bytes: linesToEscpos(lines, store.settings.printer.width),
      kind: 'receipt',
    })
  }

  const confirmVoid = () => {
    if (!voidTarget) return
    let authorizer = { id: user.id, name: user.name }
    if (user.role !== 'admin') {
      const manager = db.users.find(
        (u) => u.storeId === store.id && u.role === 'admin' && u.active && u.pin === voidPin.trim(),
      )
      if (!manager) {
        push("That PIN doesn't match an active store manager.", 'error')
        return
      }
      authorizer = { id: manager.id, name: manager.name }
    }
    voidOrder(voidTarget.id, authorizer)
    push(`Order #${voidTarget.number} voided · authorized by ${authorizer.name}`, 'info')
    setVoidTarget(null)
    setVoidPin('')
    setSelected(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Orders</h2>
          <p className="mt-1 text-[13px] text-muted">
            Every sale, tab and void — searchable and exportable.
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

      <Card>
        <div className="flex flex-col gap-3 border-b border-line/70 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by order #, customer, staff or item…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={range}
              onChange={(v) => {
                setRange(v)
                setLimit(20)
              }}
              size="sm"
              options={[
                { value: 'today', label: 'Today' },
                { value: '7d', label: '7 days' },
                { value: '30d', label: '30 days' },
                { value: 'all', label: 'All' },
              ]}
            />
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className="h-9 w-[130px] text-[12.5px]"
            >
              <option value="all">All payments</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="credit">On tab</option>
            </Select>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="h-9 w-[120px] text-[12.5px]"
            >
              <option value="all">All status</option>
              <option value="completed">Completed</option>
              <option value="void">Void</option>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-5 w-5" />}
            title="No orders match"
            description="Try widening the date range or clearing the filters."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line/70 text-[10.5px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2.5 font-semibold">Order</th>
                    <th className="px-4 py-2.5 font-semibold">Customer</th>
                    <th className="px-4 py-2.5 font-semibold">Items</th>
                    <th className="px-4 py-2.5 font-semibold">Staff</th>
                    <th className="px-4 py-2.5 font-semibold">Payment</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((o) => (
                    <tr
                      key={o.id}
                      className="cursor-pointer border-b border-line/50 text-[12.5px] transition hover:bg-cream-50"
                      onClick={() => setSelected(o)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">#{o.number}</div>
                        <div className="text-[10.5px] text-muted">
                          {fmtDate(o.createdAt)} · {fmtTime(o.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(o.customerId ? 'font-medium text-ink' : 'text-muted')}>
                          {customerName(o.customerId) ?? 'Guest'}
                        </span>
                        <div className="text-[10.5px] capitalize text-muted">
                          {o.channel.replace('-', ' ')}
                        </div>
                      </td>
                      <td className="max-w-[240px] px-4 py-3 text-muted">
                        <span className="line-clamp-1">
                          {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{o.staffName.split(' ')[0]}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <PaymentBadge method={o.paymentMethod} />
                          {o.status === 'void' && <Badge tone="danger">Void</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular">{money(o.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="rounded-lg p-1.5 text-muted transition hover:bg-cream-200 hover:text-ink"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelected(o)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="divide-y divide-line/60 md:hidden">
              {filtered.slice(0, limit).map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-100 text-[11px] font-bold text-muted">
                    #{o.number.toString().slice(-2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold">
                      #{o.number} · {customerName(o.customerId) ?? 'Guest'}
                    </div>
                    <div className="truncate text-[10.5px] text-muted">
                      {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12.5px] font-bold tabular">{money(o.total)}</div>
                    <div className="text-[10px] text-muted">{fmtTime(o.createdAt)}</div>
                  </div>
                </button>
              ))}
            </div>

            {filtered.length > limit && (
              <div className="border-t border-line/70 p-3 text-center">
                <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + 25)}>
                  Load {Math.min(25, filtered.length - limit)} more
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Order detail drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Order #${selected.number}` : ''}
        subtitle={selected ? `${fmtDate(selected.createdAt)} · ${fmtTime(selected.createdAt)}` : ''}
        footer={
          selected ? (
            <div className="flex items-center justify-between gap-2">
              {selected.status === 'completed' ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setVoidPin('')
                    setVoidTarget(selected)
                  }}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> {user.role === 'admin' ? 'Void order' : 'Request void'}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => reprint(selected)}>
                  <Printer className="h-4 w-4" /> Print
                </Button>
                <Button onClick={() => setSelected(null)}>Done</Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected && (
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <PaymentBadge method={selected.paymentMethod} />
              <Badge tone={selected.status === 'void' ? 'danger' : 'success'}>
                {selected.status === 'void' ? 'Voided' : 'Completed'}
              </Badge>
              <Badge tone="neutral">{selected.channel.replace('-', ' ')}</Badge>
              {selected.customerId && (
                <Badge tone="accent">
                  <UserRound className="h-3 w-3" />
                  {customerName(selected.customerId)}
                </Badge>
              )}
            </div>

            {selected.status === 'void' && selected.voidedByName && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12px] text-red-800">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  Voided by <span className="font-bold">{selected.voidedByName}</span>
                </span>
              </div>
            )}

            <div className="rounded-2xl border border-line bg-white p-4">
              <div className="space-y-2.5">
                {selected.items.map((i) => (
                  <div key={i.productId} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-100 text-base">
                      {i.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-ink">{i.name}</div>
                      <div className="text-[10.5px] text-muted">
                        {i.qty} × {money(i.price)}
                      </div>
                    </div>
                    <span className="text-[12.5px] font-semibold tabular">
                      {money(i.price * i.qty)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1 border-t border-dashed border-line pt-3 text-[12px]">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span className="tabular">{money(selected.subtotal)}</span>
                </div>
                {selected.service > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>Service</span>
                    <span className="tabular">{money(selected.service)}</span>
                  </div>
                )}
                {selected.tax > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>Tax {store.settings.taxInclusive ? '(included)' : ''}</span>
                    <span className="tabular">{money(selected.tax)}</span>
                  </div>
                )}
                {selected.discount > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>Discount</span>
                    <span className="tabular">−{money(selected.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-[14px] font-extrabold">
                  <span>Total</span>
                  <span className="tabular">{money(selected.total)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Served by</div>
                <div className="mt-1 text-[12.5px] font-semibold">{selected.staffName}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {selected.customerId ? 'Tab balance' : 'Payment'}
                </div>
                <div className="mt-1 text-[12.5px] font-semibold">
                  {selected.customerId
                    ? money(balanceFor(db.ledger, selected.customerId))
                    : selected.paymentMethod === 'cash'
                      ? 'Paid in cash'
                      : 'Paid by card'}
                </div>
              </div>
            </div>

            {selected.note && (
              <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900">
                <span className="font-semibold">Note: </span>
                {selected.note}
              </div>
            )}

            <div className="rounded-2xl bg-cream-200/60 p-4">
              <div className="receipt-print">
                <ReceiptView order={selected} store={store} />
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        title="Void this order?"
        subtitle={voidTarget ? `Order #${voidTarget.number} · ${money(voidTarget.total)}` : ''}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVoidTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={user.role !== 'admin' && !/^\d{4}$/.test(voidPin.trim())}
              onClick={confirmVoid}
            >
              <Trash2 className="h-4 w-4" /> Void order
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <p className="text-[13px] leading-relaxed text-muted">
            The sale will be marked as void and excluded from reports. If it was charged to a tab,
            the charge is reversed automatically. This cannot be undone.
          </p>
          {user.role === 'admin' ? (
            <div className="flex items-center gap-2 rounded-lg bg-cream-100 px-3 py-2 text-[11.5px] text-muted">
              <KeyRound className="h-3.5 w-3.5" />
              You are the store admin — the void is recorded under your name.
            </div>
          ) : (
            <Field label="Manager PIN" hint="Ask a manager to authorize this void">
              <Input
                value={voidPin}
                onChange={(e) => setVoidPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="••••"
                className="font-mono text-center text-lg tracking-[0.4em]"
                autoFocus
              />
            </Field>
          )}
        </div>
      </Modal>

      <PrintModal job={printJob} onClose={() => setPrintJob(null)} />
    </div>
  )
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-100 text-muted">
        {icon}
      </div>
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="text-[16px] font-extrabold tracking-tight tabular">{value}</div>
      </div>
    </Card>
  )
}

function PaymentBadge({ method }: { method: Order['paymentMethod'] }) {
  if (method === 'credit')
    return (
      <Badge tone="accent">
        <Wallet className="h-3 w-3" /> Tab
      </Badge>
    )
  if (method === 'card')
    return (
      <Badge tone="info">
        <CreditCard className="h-3 w-3" /> Card
      </Badge>
    )
  return (
    <Badge tone="success">
      <Banknote className="h-3 w-3" /> Cash
    </Badge>
  )
}

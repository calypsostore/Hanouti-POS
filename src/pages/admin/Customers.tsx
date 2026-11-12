import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CreditCard,
  HandCoins,
  Lock,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { Customer, SettlementCycle } from '../../types'
import {
  Avatar,
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
  Textarea,
} from '../../components/ui'
import { useToast } from '../../components/toast'
import { balanceFor, customerActivity } from '../../lib/selectors'
import { cn, cycleLabel, dateKey, fmtDate, fmtDateTime, money, nextDueLabel } from '../../lib/utils'

export default function Customers() {
  const {
    db,
    store,
    user,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    settleCredit,
  } = useApp()
  const { push } = useToast()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'all' | 'open' | 'settled'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ open: boolean; customer?: Customer }>({ open: false })
  const [settleCustomerId, setSettleCustomerId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [detailTab, setDetailTab] = useState<'ledger' | 'orders'>('ledger')

  if (!store || !user) return null

  const isAdmin = user.role === 'admin'
  const canSettle = isAdmin || user.permissions.settle
  const customers = db.customers.filter((c) => c.storeId === store.id)
  const selected = customers.find((c) => c.id === selectedId) ?? null
  const settleTarget = customers.find((c) => c.id === settleCustomerId) ?? null
  const balance = selected ? balanceFor(db.ledger, selected.id) : 0
  const settleBalance = settleTarget ? balanceFor(db.ledger, settleTarget.id) : 0
  const activity = selected ? customerActivity(db.ledger, selected.id) : []
  const orders = selected
    ? db.orders
        .filter((o) => o.customerId === selected.id && o.storeId === store.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    : []

  const filtered = customers
    .filter((c) => {
      const matchesQuery =
        c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query.trim())
      const cBalance = balanceFor(db.ledger, c.id)
      const matchesView =
        view === 'all' || (view === 'open' ? cBalance > 0 : cBalance <= 0)
      return matchesQuery && matchesView
    })
    .sort((a, b) => balanceFor(db.ledger, b.id) - balanceFor(db.ledger, a.id))

  const totalOutstanding = customers.reduce(
    (acc, c) => acc + Math.max(0, balanceFor(db.ledger, c.id)),
    0,
  )
  const debtors = customers.filter((c) => balanceFor(db.ledger, c.id) > 0).length
  const monthPrefix = dateKey(new Date()).slice(0, 7)
  const collectedThisMonth = db.ledger
    .filter(
      (l) =>
        l.storeId === store.id &&
        l.type === 'payment' &&
        dateKey(l.createdAt).startsWith(monthPrefix),
    )
    .reduce((a, l) => a + l.amount, 0)

  const startOrder = (customerId: string) => navigate(`/pos?customer=${customerId}`)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Regulars &amp; tabs</h2>
          <p className="mt-1 text-[13px] text-muted">
            Monthly customer cards for regulars who settle at the end of the month.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setEditor({ open: true })}>
            <UserPlus className="h-4 w-4" /> New customer
          </Button>
        )}
      </div>

      {!isAdmin && (
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3 text-[12px] leading-relaxed text-muted">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600" />
          <span>
            {canSettle
              ? 'You can start an order or take a payment from any card.'
              : 'You can start an order from any card. Taking payments needs the settlement permission — ask your manager.'}{' '}
            Customer details and credit limits can only be edited by an admin.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Regulars" value={String(customers.length)} icon={<Users className="h-4 w-4" />} />
        <SummaryTile
          label="Outstanding"
          value={money(totalOutstanding)}
          icon={<Wallet className="h-4 w-4" />}
          accent
        />
        <SummaryTile label="Open tabs" value={String(debtors)} icon={<HandCoins className="h-4 w-4" />} />
        <SummaryTile
          label="Collected this month"
          value={money(collectedThisMonth)}
          icon={<Banknote className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone…"
            className="pl-9"
          />
        </div>
        <Segmented
          value={view}
          onChange={setView}
          size="sm"
          options={[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open tabs' },
            { value: 'settled', label: 'Settled' },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={customers.length ? 'No customers match' : 'No regulars yet'}
            description={
              customers.length
                ? 'Try a different name, phone number or filter.'
                : 'Create a profile for regulars who pay at the end of the month.'
            }
            action={
              isAdmin && !customers.length ? (
                <Button size="sm" onClick={() => setEditor({ open: true })}>
                  <Plus className="h-4 w-4" /> Add customer
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const bal = balanceFor(db.ledger, c.id)
            const pct = c.limit > 0 ? Math.min(100, (bal / c.limit) * 100) : 0
            const over = c.limit > 0 && bal > c.limit
            return (
              <div
                key={c.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-line/80 bg-white transition hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-[0_6px_20px_rgba(36,30,25,0.06)]"
              >
                <button
                  onClick={() => {
                    setSelectedId(c.id)
                    setDetailTab('ledger')
                  }}
                  className="flex-1 p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={c.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-bold text-ink">{c.name}</div>
                      <div className="mt-0.5 truncate text-[11.5px] text-muted">
                        {c.phone || 'No phone'}
                      </div>
                    </div>
                    {bal > 0 ? (
                      <Badge tone={over ? 'danger' : 'accent'}>{over ? 'Over limit' : 'Tab open'}</Badge>
                    ) : (
                      <Badge tone="success">Settled</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">
                        Outstanding
                      </div>
                      <div
                        className={cn(
                          'text-[19px] font-extrabold tracking-tight tabular',
                          bal > 0 ? (over ? 'text-red-500' : 'text-ink') : 'text-muted',
                        )}
                      >
                        {money(bal)}
                      </div>
                    </div>
                    <div className="text-right text-[10.5px] text-muted">
                      limit {money(c.limit)}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        over ? 'bg-red-400' : 'bg-accent-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-dashed border-line/70 pt-2.5">
                    <span className="inline-flex min-w-0 items-center gap-1 text-[10.5px] font-semibold text-muted">
                      <CalendarClock className="h-3 w-3 shrink-0 text-accent-600" />
                      <span className="truncate">
                        {cycleLabel(c.cycle)} · {nextDueLabel(c.cycle)}
                      </span>
                    </span>
                    {c.notes && (
                      <span className="max-w-[45%] truncate text-[10.5px] italic text-muted">
                        “{c.notes}”
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-1 border-t border-line/60 bg-cream-50/70 px-2 py-1.5">
                  <button
                    onClick={() => startOrder(c.id)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-ink transition hover:bg-white hover:text-accent-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> New order
                  </button>
                  {canSettle && bal > 0 && (
                    <button
                      onClick={() => setSettleCustomerId(c.id)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-accent-700 transition hover:bg-accent-50"
                    >
                      <HandCoins className="h-3.5 w-3.5" /> Take payment
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setEditor({ open: true, customer: c })}
                      className="rounded-lg p-1.5 text-muted transition hover:bg-white hover:text-ink"
                      title="Edit customer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Customer drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        width="max-w-2xl"
        title={selected?.name}
        subtitle={selected ? `Regular since ${fmtDate(selected.createdAt)}` : ''}
        footer={
          selected ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditor({ open: true, customer: selected })}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit profile
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteTarget(selected)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                    <Lock className="h-3 w-3" /> Profile is managed by an admin
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="md" onClick={() => startOrder(selected.id)}>
                  <Plus className="h-4 w-4" /> New order
                </Button>
                {canSettle && balance > 0 && (
                  <Button size="md" onClick={() => setSettleCustomerId(selected.id)}>
                    <HandCoins className="h-4 w-4" /> Take payment
                  </Button>
                )}
                {!canSettle && balance > 0 && (
                  <span className="text-[11px] text-muted">Ask an admin to record the payment.</span>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {selected && (
          <div className="space-y-5 p-5">
            <div className="rounded-2xl bg-espresso-900 p-5 text-cream-50">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Outstanding balance
                  </div>
                  <div className="mt-1 text-[32px] font-extrabold tracking-tight tabular">
                    {money(balance)}
                  </div>
                  <div className="mt-1 text-[11.5px] text-white/45">
                    Credit limit {money(selected.limit)}
                  </div>
                </div>
                <Avatar name={selected.name} size="lg" className="bg-white/10 text-white" />
              </div>
              {selected.limit > 0 && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      balance > selected.limit ? 'bg-red-400' : 'bg-accent-500',
                    )}
                    style={{ width: `${Math.min(100, (balance / selected.limit) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  <Phone className="h-3 w-3" /> Phone
                </div>
                <div className="mt-1 text-[12.5px] font-semibold">{selected.phone || '—'}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Orders</div>
                <div className="mt-1 text-[12.5px] font-semibold">{orders.length}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Lifetime</div>
                <div className="mt-1 text-[12.5px] font-semibold tabular">
                  {money(orders.filter((o) => o.status === 'completed').reduce((a, o) => a + o.total, 0))}
                </div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  <CalendarClock className="h-3 w-3" /> Settlement
                </div>
                <div className="mt-1 text-[12.5px] font-semibold">{cycleLabel(selected.cycle)}</div>
                <div className="text-[10px] text-muted">{nextDueLabel(selected.cycle)}</div>
              </div>
            </div>

            {selected.notes && (
              <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900">
                {selected.notes}
              </div>
            )}

            <div>
              <Segmented
                value={detailTab}
                onChange={setDetailTab}
                size="sm"
                options={[
                  { value: 'ledger', label: 'Tab activity' },
                  { value: 'orders', label: 'Orders' },
                ]}
              />
            </div>

            {detailTab === 'ledger' ? (
              <div className="overflow-hidden rounded-2xl border border-line bg-white">
                {activity.length === 0 ? (
                  <p className="py-10 text-center text-[12.5px] text-muted">No tab activity yet.</p>
                ) : (
                  <div className="divide-y divide-line/60">
                    {activity.map((l) => (
                      <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg',
                            l.type === 'payment'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-cream-100 text-accent-600',
                          )}
                        >
                          {l.type === 'payment' ? (
                            <ArrowDownRight className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold text-ink">
                            {l.type === 'payment' ? 'Payment received' : 'Charge added'}
                            {l.note ? ` · ${l.note}` : ''}
                          </div>
                          <div className="text-[10.5px] text-muted">
                            {fmtDateTime(l.createdAt)} {l.staffName ? `· ${l.staffName}` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={cn(
                              'text-[12.5px] font-bold tabular',
                              l.type === 'payment' ? 'text-emerald-600' : 'text-ink',
                            )}
                          >
                            {l.type === 'payment' ? '−' : '+'}
                            {money(l.amount)}
                          </div>
                          {l.method && (
                            <div className="text-[9.5px] uppercase text-muted">{l.method}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line bg-white">
                {orders.length === 0 ? (
                  <p className="py-10 text-center text-[12.5px] text-muted">No orders yet.</p>
                ) : (
                  <div className="divide-y divide-line/60">
                    {orders.map((o) => (
                      <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-100 text-[10.5px] font-bold text-muted">
                          #{o.number.toString().slice(-2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold">Order #{o.number}</div>
                          <div className="truncate text-[10.5px] text-muted">
                            {fmtDateTime(o.createdAt)} · {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[12.5px] font-bold tabular">{money(o.total)}</div>
                          <div className="text-[9.5px] uppercase text-muted">
                            {o.paymentMethod === 'credit' ? 'tab' : o.paymentMethod}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <CustomerEditor
        open={editor.open}
        customer={editor.customer}
        onClose={() => setEditor({ open: false })}
        onSave={(data) => {
          const res = editor.customer
            ? updateCustomer(editor.customer.id, data)
            : addCustomer(store.id, data)
          if (!res.ok) {
            push(res.error, 'error')
            return
          }
          push(editor.customer ? 'Customer profile updated' : 'Customer created')
          setEditor({ open: false })
        }}
      />

      {settleTarget && (
        <SettleModal
          key={settleTarget.id}
          open
          onClose={() => setSettleCustomerId(null)}
          customer={settleTarget}
          balance={settleBalance}
          onSettle={(amount, method, note) => {
            const res = settleCredit(settleTarget.id, amount, method, note)
            if (!res.ok) {
              push(res.error, 'error')
              return
            }
            push(`${money(amount)} received from ${settleTarget.name}`)
            setSettleCustomerId(null)
          }}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove customer?"
        subtitle={deleteTarget?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteTarget) return
                const res = deleteCustomer(deleteTarget.id)
                if (!res.ok) {
                  push(res.error, 'error')
                  return
                }
                push('Customer removed', 'info')
                setDeleteTarget(null)
                setSelectedId(null)
              }}
            >
              Remove customer
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          This removes the profile and its tab history. Customers with an outstanding balance cannot
          be removed.
        </p>
      </Modal>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent?: boolean
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl',
          accent ? 'bg-accent-50 text-accent-600' : 'bg-cream-100 text-muted',
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="text-[16px] font-extrabold tracking-tight tabular">{value}</div>
      </div>
    </Card>
  )
}

function CustomerEditor({
  open,
  customer,
  onClose,
  onSave,
}: {
  open: boolean
  customer?: Customer
  onClose: () => void
  onSave: (data: {
    name: string
    phone: string
    limit: number
    notes: string
    cycle: SettlementCycle
  }) => void
}) {
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [limit, setLimit] = useState(String(customer?.limit ?? 150))
  const [notes, setNotes] = useState(customer?.notes ?? '')
  const [cycle, setCycle] = useState<SettlementCycle>(customer?.cycle ?? 'monthly')

  // Reset when switching between create/edit targets
  const key = customer?.id ?? 'new'
  const [lastKey, setLastKey] = useState(key)
  if (lastKey !== key) {
    setLastKey(key)
    setName(customer?.name ?? '')
    setPhone(customer?.phone ?? '')
    setLimit(String(customer?.limit ?? 150))
    setNotes(customer?.notes ?? '')
    setCycle(customer?.cycle ?? 'monthly')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit customer' : 'New customer'}
      subtitle={customer ? customer.name : 'Create a card for a regular who runs a tab.'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                phone: phone.trim(),
                limit: Number(limit) || 0,
                notes: notes.trim(),
                cycle,
              })
            }
          >
            {customer ? 'Save changes' : 'Create customer'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mohamed Ali" autoFocus />
        </Field>
        <Field label="Phone" hint="Optional">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+216 …" />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Credit limit (DT)" hint="0 = unlimited">
            <Input
              type="number"
              min={0}
              step={10}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="tabular"
            />
          </Field>
          <Field label="Settlement cycle">
            <Select
              value={cycle}
              onChange={(e) => setCycle(e.target.value as SettlementCycle)}
            >
              <option value="monthly">Monthly — end of month</option>
              <option value="weekly">Weekly — every Friday</option>
              <option value="on-demand">On demand — pay anytime</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes" hint="Optional">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. pays at the end of each month"
          />
        </Field>
        <div className="rounded-xl bg-cream-100 px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
          Staff can add orders and record payments from this card. Only store admins can edit the
          profile, credit limit or settlement cycle.
        </div>
      </div>
    </Modal>
  )
}

function SettleModal({
  open,
  onClose,
  customer,
  balance,
  onSettle,
}: {
  open: boolean
  onClose: () => void
  customer: Customer
  balance: number
  onSettle: (amount: number, method: 'cash' | 'card', note: string) => void
}) {
  const [amount, setAmount] = useState(balance ? String(balance.toFixed(3)) : '')
  const [method, setMethod] = useState<'cash' | 'card'>('cash')
  const [note, setNote] = useState('')
  const value = Number(amount) || 0
  const valid = value > 0 && value <= balance + 0.0001

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Take payment"
      subtitle={`${customer.name} · balance ${money(balance)}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-muted">
            {valid ? `Remaining after payment · ${money(balance - value)}` : 'Enter a valid amount'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!valid} onClick={() => onSettle(value, method, note)}>
              <HandCoins className="h-4 w-4" /> Receive {money(value)}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-espresso-900 px-5 py-4 text-cream-50">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">
            Current balance
          </div>
          <div className="mt-1 text-[28px] font-extrabold tracking-tight tabular">{money(balance)}</div>
        </div>
        <Field label="Amount received" hint="Partial payments are fine">
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-12 text-lg font-bold tabular"
            autoFocus
          />
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAmount(String(balance.toFixed(3)))}>
            Full balance
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAmount(String((balance / 2).toFixed(3)))}
          >
            Half
          </Button>
        </div>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">Method</span>
          <Segmented
            value={method}
            onChange={setMethod}
            className="w-full [&>button]:flex-1"
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
            ]}
          />
        </div>
        {method === 'card' && (
          <p className="flex items-center gap-2 rounded-lg bg-cream-100 px-3 py-2 text-[11.5px] text-muted">
            <CreditCard className="h-3.5 w-3.5" /> Confirm on the terminal before saving.
          </p>
        )}
        <Field label="Note" hint="Optional">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. month-end settlement" />
        </Field>
      </div>
    </Modal>
  )
}

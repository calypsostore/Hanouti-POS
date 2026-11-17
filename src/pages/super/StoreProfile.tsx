import { useState } from 'react'
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Store as StoreIcon,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { PLAN_INFO } from '../../data/seed'
import type { Plan, StoreStatus } from '../../types'
import { Avatar, Badge, Button, Drawer, Select } from '../../components/ui'
import { useToast } from '../../components/toast'
import { balanceFor } from '../../lib/selectors'
import { orderNumberLabel } from '../../lib/orderNumber'
import { cn, dateKey, fmtDate, fmtDateTime, money, sum } from '../../lib/utils'
import { AppIcon } from '../../components/AppIcon'
import { ChartLegend } from '../../components/charts'
import { SEMANTIC_COLORS } from '../../lib/semanticColors'
import { isQuick } from '../../lib/posMode'

export function StoreProfileDrawer({ storeId, onClose }: { storeId: string | null; onClose: () => void }) {
  const { db, setStoreStatus, changePlan } = useApp()
  const { push } = useToast()
  const [confirmStatus, setConfirmStatus] = useState<StoreStatus | null>(null)

  const store = db.stores.find((s) => s.id === storeId) ?? null

  if (!store) return null

  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)

  const orders = db.orders.filter((o) => o.storeId === store.id && o.status === 'completed')
  const recent = [...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6)
  const last30 = orders.filter((o) => new Date(o.createdAt) >= since30)
  const revenue30 = sum(last30, (o) => o.total)
  const revenueAll = sum(orders, (o) => o.total)
  const expenses30 = sum(
    db.expenses.filter((e) => e.storeId === store.id && new Date(e.date) >= since30),
    (e) => e.amount,
  )
  const team = db.users.filter((u) => u.storeId === store.id)
  const customers = db.customers.filter((c) => c.storeId === store.id)
  const outstanding = customers.reduce((acc, c) => acc + Math.max(0, balanceFor(db.ledger, c.id)), 0)
  const products = db.products.filter((p) => p.storeId === store.id)
  const categories = db.categories.filter((c) => c.storeId === store.id)

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = dateKey(d)
    return {
      day: d.toLocaleDateString('en-GB', { day: '2-digit' }),
      value: sum(
        orders.filter((o) => dateKey(o.createdAt) === key),
        (o) => o.total,
      ),
    }
  })
  const maxDay = Math.max(1, ...last14.map((d) => d.value))

  const applyStatus = (status: StoreStatus) => {
    const result = setStoreStatus(store.id, status)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(
      status === 'suspended'
        ? `${store.name} suspended — sign-in is blocked`
        : `${store.name} is now ${status}`,
      status === 'suspended' ? 'error' : 'success',
    )
    setConfirmStatus(null)
  }

  return (
    <Drawer open={!!storeId} onClose={onClose} width="max-w-2xl" title="Store profile" subtitle={store.slug}>
      <div className="space-y-5 p-5">
        {/* Identity */}
        <div className="rounded-2xl bg-espresso-900 p-5 text-cream-50 grain">
          <div className="flex items-start gap-3.5">
            {store.logo
              ? <img src={store.logo} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              : <AppIcon name={store.icon} color={store.iconColor} size={25} className="h-14 w-14 rounded-2xl" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[19px] font-extrabold tracking-tight">{store.name}</h3>
                <StatusBadge status={store.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-white/50">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {store.city}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> since {fmtDate(store.createdAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <StoreIcon className="h-3 w-3" /> {store.slug}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-white/35">
                Revenue · 30d
              </div>
              <div className="mt-0.5 text-[17px] font-extrabold tabular">{money(revenue30)}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-white/35">
                Orders · 30d
              </div>
              <div className="mt-0.5 text-[17px] font-extrabold tabular">{last30.length}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-white/35">
                Outstanding
              </div>
              <div className="mt-0.5 text-[17px] font-extrabold tabular">{money(outstanding)}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Plan & access</div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-[11.5px] font-semibold text-muted">Subscription plan</span>
              <Select
                value={store.plan}
                onChange={(e) => {
                  const plan = e.target.value as Plan
                  const result = changePlan(store.id, plan)
                  if (!result.ok) {
                    push(result.error, 'error')
                    return
                  }
                  push(`${store.name} moved to ${PLAN_INFO[plan].label}`)
                }}
              >
                {(Object.keys(PLAN_INFO) as Plan[]).map((p) => (
                  <option key={p} value={p}>
                    {PLAN_INFO[p].label} — {money(PLAN_INFO[p].price)}/mo
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex gap-2">
              {store.status !== 'suspended' ? (
                <Button variant="danger" onClick={() => setConfirmStatus('suspended')}>
                  <Ban className="h-4 w-4" /> Suspend
                </Button>
              ) : (
                <Button onClick={() => setConfirmStatus('active')}>
                  <CheckCircle2 className="h-4 w-4" /> Reactivate
                </Button>
              )}
              {store.status === 'trial' && (
                <Button variant="secondary" onClick={() => applyStatus('active')}>
                  Convert to paid
                </Button>
              )}
            </div>
          </div>
          {store.status === 'trial' && store.trialEndsAt && (
            <p className="mt-2 text-[11px] text-muted">
              Trial ends {fmtDate(store.trialEndsAt)} · currently on the {PLAN_INFO[store.plan].label} plan.
            </p>
          )}
        </div>

        {/* Contact */}
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile icon={<Users className="h-3.5 w-3.5" />} label="Owner">
            {store.ownerName}
          </InfoTile>
          <InfoTile icon={<Mail className="h-3.5 w-3.5" />} label="Email">
            {store.ownerEmail}
          </InfoTile>
          <InfoTile icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
            {store.phone}
          </InfoTile>
          <InfoTile icon={<MapPin className="h-3.5 w-3.5" />} label="Address">
            {store.address}, {store.city}
          </InfoTile>
        </div>

        {/* Usage */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Products" value={String(products.length)} />
          <MiniStat label="Categories" value={String(categories.length)} />
          <MiniStat label="Team" value={String(team.length)} />
          <MiniStat label="Customers" value={String(customers.length)} />
        </div>

        {/* Revenue trend */}
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Revenue · last 14 days
            </div>
            <span className="text-[12px] font-bold tabular">{money(sum(last14, (d) => d.value))}</span>
          </div>
          <div className="mt-3 flex h-16 items-end gap-1">
            {last14.map((d, i) => (
              <div key={i} className="group flex flex-1 flex-col items-center gap-1">
                <div className="flex h-12 w-full items-end">
                  <div
                    className="w-full rounded-t-md transition"
                    style={{
                      background: SEMANTIC_COLORS.moneyFlow.revenue.light.gradient,
                      height: `${Math.max(4, (d.value / maxDay) * 100)}%`,
                    }}
                    title={money(d.value)}
                  />
                </div>
                <span className="text-[8px] text-muted/60">{d.day}</span>
              </div>
            ))}
          </div>
          <ChartLegend items={[{ label: 'Revenue', color: SEMANTIC_COLORS.moneyFlow.revenue.light.solid }]} />
        </div>

        {/* Commercials */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Financials</div>
            <div className="mt-2 space-y-1.5 text-[12px]">
              <Line label="Lifetime revenue" value={money(revenueAll)} />
              <Line label="Expenses · 30d" value={money(expenses30)} />
              <Line
                label="Net · 30d"
                value={money(revenue30 - expenses30)}
                valueClass={revenue30 - expenses30 >= 0 ? 'text-[var(--semantic-green-text)]' : 'text-[var(--semantic-rose-text)]'}
              />
              <Line label="Average ticket" value={money(last30.length ? revenue30 / last30.length : 0)} />
              <Line label="MRR" value={money(PLAN_INFO[store.plan].price)} />
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Register configuration
            </div>
            <div className="mt-2 space-y-1.5 text-[12px]">
              <Line
                label="POS mode"
                value={isQuick(store) ? 'Quick order' : 'Cashier'}
              />
              <Line label="Tax" value={`${store.settings.taxRate}%`} />
              <Line label="Service charge" value={`${store.settings.serviceCharge}%`} />
              <Line label="Credit tabs" value={store.settings.allowCredit ? 'Enabled' : 'Disabled'} />
              <Line label="Low stock at" value={`${store.settings.lowStockThreshold} units`} />
            </div>
          </div>
        </div>

        {/* Customers with balances */}
        <div className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line/70 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">
            Customers with open tabs
          </div>
          {customers.filter((c) => balanceFor(db.ledger, c.id) > 0).length === 0 ? (
            <p className="px-4 py-6 text-center text-[11.5px] text-muted">No outstanding tabs.</p>
          ) : (
            <div className="divide-y divide-line/60">
              {customers
                .filter((c) => balanceFor(db.ledger, c.id) > 0)
                .sort((a, b) => balanceFor(db.ledger, b.id) - balanceFor(db.ledger, a.id))
                .slice(0, 4)
                .map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={c.name} size="xs" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold">{c.name}</div>
                      <div className="text-[10px] text-muted">{c.phone || 'No phone'}</div>
                    </div>
                    <span className="text-[12px] font-bold text-accent-foreground tabular">
                      {money(balanceFor(db.ledger, c.id))}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Team */}
        <div className="rounded-2xl border border-line bg-white">
          <div className="border-b border-line/70 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">
            Team ({team.length})
          </div>
          <div className="divide-y divide-line/60">
            {team.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={u.name} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-semibold">{u.name}</span>
                    <Badge tone={u.role === 'admin' ? 'dark' : 'neutral'}>{u.role}</Badge>
                    {!u.active && <Badge tone="danger">inactive</Badge>}
                  </div>
                  <div className="text-[10px] text-muted">{u.role === 'staff' ? u.username : u.email}</div>
                </div>
                <span className="text-[10.5px] text-muted">{u.role === 'staff' ? 'PIN login' : 'Email login'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="rounded-2xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line/70 px-4 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Recent orders</span>
            <ReceiptText className="h-3.5 w-3.5 text-muted" />
          </div>
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-[11.5px] text-muted">No orders yet.</p>
          ) : (
            <div className="divide-y divide-line/60">
              {recent.map((o) => (
                <div key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream-100 text-[10px] font-bold text-muted">
                    #{o.number.toString().slice(-2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold">Order #{orderNumberLabel(o)}</div>
                    <div className="text-[10px] text-muted">
                      {fmtDateTime(o.createdAt)} · {o.staffName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-bold tabular">{money(o.total)}</div>
                    <div className="text-[9.5px] uppercase text-muted">{o.paymentMethod}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-cream-100 px-3.5 py-2.5 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            {isQuick(store) ? <Zap className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
            {isQuick(store) ? 'Quick order mode' : 'Full cashier mode'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> {money(outstanding)} open tabs
          </span>
        </div>
      </div>

      {confirmStatus && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso-900/50" onClick={() => setConfirmStatus(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-[16px] font-bold">
              {confirmStatus === 'suspended' ? 'Suspend this store?' : 'Reactivate this store?'}
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              {confirmStatus === 'suspended'
                ? `${store.name} will be signed out and nobody at the store can sign in until you reactivate it. All data is preserved.`
                : `${store.name} will regain access with their existing data and settings.`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmStatus(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant={confirmStatus === 'suspended' ? 'danger' : 'primary'}
                onClick={() => applyStatus(confirmStatus)}
              >
                {confirmStatus === 'suspended' ? 'Suspend store' : 'Reactivate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  )
}

function StatusBadge({ status }: { status: StoreStatus }) {
  if (status === 'active')
    return (
      <Badge tone="success">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
      </Badge>
    )
  if (status === 'trial')
    return (
      <Badge tone="info">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Trial
      </Badge>
    )
  return (
    <Badge tone="danger">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Suspended
    </Badge>
  )
}

function InfoTile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-muted">
        {icon} {label}
      </div>
      <div className="mt-1 truncate text-[12px] font-semibold text-ink">{children}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3 text-center">
      <div className="text-[16px] font-extrabold tabular">{value}</div>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">{label}</div>
    </div>
  )
}

function Line({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn('font-semibold tabular', valueClass)}>{value}</span>
    </div>
  )
}

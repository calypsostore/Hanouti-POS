import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CreditCard,
  Store as StoreIcon,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../../store/AppStore'
import { PLAN_INFO } from '../../data/seed'
import type { Plan, Store } from '../../types'
import { Avatar, Badge, Card } from '../../components/ui'
import { ChartTooltip, axisProps } from '../../components/charts'
import { StoreProfileDrawer } from './StoreProfile'
import { balanceFor } from '../../lib/selectors'
import { cn, dateKey, fmtDate, money, sum } from '../../lib/utils'
import { BRAND_NAME } from '../../lib/brand'

export default function SuperOverview() {
  const { db, user } = useApp()
  const [selected, setSelected] = useState<string | null>(null)

  const stores = db.stores
  const activeStores = stores.filter((s) => s.status !== 'suspended')
  const mrr = sum(activeStores, (s) => PLAN_INFO[s.plan].price)

  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)
  const orders30 = db.orders.filter(
    (o) => o.status === 'completed' && new Date(o.createdAt) >= since30,
  )
  const gmv = sum(orders30, (o) => o.total)
  const customers = db.customers
  const outstanding = sum(customers, (c) => Math.max(0, balanceFor(db.ledger, c.id)))

  const trend = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const key = dateKey(d)
    return {
      day: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      revenue: Math.round(
        sum(
          db.orders.filter((o) => o.status === 'completed' && dateKey(o.createdAt) === key),
          (o) => o.total,
        ) * 1000,
      ) / 1000,
    }
  })

  const storeRows = stores
    .map((s) => {
      const orders = db.orders.filter(
        (o) => o.storeId === s.id && o.status === 'completed' && new Date(o.createdAt) >= since30,
      )
      return {
        store: s,
        revenue: sum(orders, (o) => o.total),
        orders: orders.length,
        staff: db.users.filter((u) => u.storeId === s.id).length,
        outstanding: sum(
          db.customers.filter((c) => c.storeId === s.id),
          (c) => Math.max(0, balanceFor(db.ledger, c.id)),
        ),
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  const recentOrders = [...db.orders]
    .filter((o) => o.status === 'completed')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 7)

  const planCounts = (['starter', 'growth', 'pro'] as Plan[]).map((p) => ({
    plan: p,
    count: stores.filter((s) => s.plan === p).length,
  }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight">
            Platform overview
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            {fmtDate(new Date().toISOString())} · {stores.length} stores on {BRAND_NAME}.
          </p>
        </div>
        <Link
          to="/super/stores"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-[13px] font-semibold shadow-sm transition hover:bg-cream-100"
        >
          <StoreIcon className="h-4 w-4" /> All stores
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Stores</div>
              <div className="mt-1.5 text-[24px] font-extrabold tracking-tight">{stores.length}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">
                {stores.filter((s) => s.status === 'active').length} active ·{' '}
                {stores.filter((s) => s.status === 'trial').length} trial
              </div>
            </div>
            <div className="rounded-xl bg-cream-100 p-2 text-ink">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">MRR</div>
              <div className="mt-1.5 text-[24px] font-extrabold tracking-tight tabular">{money(mrr)}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">recurring subscription</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">GMV · 30d</div>
              <div className="mt-1.5 text-[24px] font-extrabold tracking-tight tabular">{money(gmv)}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">{orders30.length} orders</div>
            </div>
            <div className="rounded-xl bg-accent-50 p-2 text-accent-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Open tabs</div>
              <div className="mt-1.5 text-[24px] font-extrabold tracking-tight tabular">{money(outstanding)}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">
                across {customers.filter((c) => balanceFor(db.ledger, c.id) > 0).length} customers
              </div>
            </div>
            <div className="rounded-xl bg-brand-amber-soft p-2 text-accent-foreground">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Platform revenue</h3>
              <p className="mt-0.5 text-[12px] text-muted">All stores · last 30 days</p>
            </div>
            <div className="text-right">
              <div className="text-[18px] font-extrabold tabular">{money(gmv)}</div>
              <div className="text-[10.5px] text-muted">gross merchandise value</div>
            </div>
          </div>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="platformRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand-navy)" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="var(--color-brand-navy)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-tint)" vertical={false} />
                <XAxis dataKey="day" {...axisProps} interval={4} />
                <YAxis {...axisProps} width={54} />
                <Tooltip content={<ChartTooltip formatter={(v) => money(v)} />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="var(--color-brand-navy)"
                  strokeWidth={2.2}
                  fill="url(#platformRev)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-[15px] font-semibold tracking-tight">Store health</h3>
            <div className="mt-3 space-y-2">
              {(['active', 'trial', 'suspended'] as const).map((status) => {
                const count = stores.filter((s) => s.status === status).length
                const tone =
                  status === 'active' ? 'bg-emerald-500' : status === 'trial' ? 'bg-sky-500' : 'bg-red-500'
                return (
                  <div key={status} className="flex items-center gap-2.5 text-[12px]">
                    <span className={cn('h-2 w-2 rounded-full', tone)} />
                    <span className="capitalize text-muted">{status}</span>
                    <span className="ml-auto font-semibold">{count}</span>
                  </div>
                )
              })}
            </div>
            <div className="my-3 h-px bg-line" />
            <div className="space-y-2.5">
              {planCounts.map((p) => (
                <div key={p.plan}>
                  <div className="mb-1 flex items-center justify-between text-[11.5px]">
                    <span className="text-muted">{PLAN_INFO[p.plan].label}</span>
                    <span className="font-semibold">{p.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-cream-200">
                    <div
                      className="h-full rounded-full bg-espresso-700"
                      style={{ width: `${stores.length ? (p.count / stores.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {stores.some((s) => s.status === 'suspended') && (
            <Card className="border-red-200/70 bg-red-50/60 p-4">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4" />
                {stores.filter((s) => s.status === 'suspended').length} suspended store(s)
              </div>
              <p className="mt-1 text-[11px] text-red-600/80">
                Their staff cannot sign in. Review them in the stores list.
              </p>
            </Card>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Store performance</h3>
              <p className="mt-0.5 text-[12px] text-muted">Revenue in the last 30 days</p>
            </div>
            <Link to="/super/stores" className="text-[12px] font-semibold text-accent-foreground hover:text-accent-foreground">
              Manage
            </Link>
          </div>
          <div className="divide-y divide-line/60">
            {storeRows.map((row) => (
              <button
                key={row.store.id}
                onClick={() => setSelected(row.store.id)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-cream-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-100 text-lg">
                  {row.store.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12.5px] font-semibold">{row.store.name}</span>
                    <StatusDot status={row.store.status} />
                  </div>
                  <div className="text-[10.5px] text-muted">
                    {row.store.city} · {row.orders} orders · {row.staff} staff
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12.5px] font-bold tabular">{money(row.revenue)}</div>
                  <div className="text-[10px] capitalize text-muted">{row.store.plan}</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted/50" />
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <h3 className="text-[15px] font-semibold tracking-tight">Latest activity</h3>
            <Users className="h-4 w-4 text-muted" />
          </div>
          <div className="divide-y divide-line/60">
            {recentOrders.map((o) => {
              const owner = stores.find((s) => s.id === o.storeId)
              return (
                <div key={o.id} className="flex items-center gap-2.5 px-5 py-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream-100 text-sm">
                    {owner?.emoji ?? '🏪'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-semibold">{owner?.name}</div>
                    <div className="text-[10px] text-muted">
                      #{o.number} · {o.staffName.split(' ')[0]}
                    </div>
                  </div>
                  <span className="text-[11.5px] font-bold tabular">{money(o.total)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <Avatar name={user?.name ?? 'Owner'} size="xs" />
          Signed in as <span className="font-semibold text-ink">{user?.name}</span> · super admin
        </div>
        <Badge tone="neutral">Demo workspace</Badge>
      </Card>

      <StoreProfileDrawer storeId={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function StatusDot({ status }: { status: Store['status'] }) {
  const tone =
    status === 'active' ? 'bg-emerald-500' : status === 'trial' ? 'bg-sky-500' : 'bg-red-500'
  return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone)} />
}

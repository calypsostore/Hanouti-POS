import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CreditCard,
  PackageX,
  Plus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApp } from '../../store/AppStore'
import { Badge, Card, SectionTitle, StatCard, Avatar } from '../../components/ui'
import { ChartTooltip, axisProps } from '../../components/charts'
import { balanceFor } from '../../lib/selectors'
import { cn, dateKey, fmtDate, fmtTime, money, sum } from '../../lib/utils'

export default function AdminOverview() {
  const { db, store, user } = useApp()
  if (!store || !user) return null

  const now = new Date()
  const todayKey = dateKey(now)
  const storeOrders = db.orders.filter((o) => o.storeId === store.id)
  const completed = storeOrders.filter((o) => o.status === 'completed')

  const today = completed.filter((o) => dateKey(o.createdAt) === todayKey)
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = completed.filter((o) => dateKey(o.createdAt) === dateKey(yesterdayDate))

  const todayRevenue = sum(today, (o) => o.total)
  const yesterdayRevenue = sum(yesterday, (o) => o.total)
  const delta = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0
  const avgTicket = today.length ? todayRevenue / today.length : 0

  const customers = db.customers.filter((c) => c.storeId === store.id)
  const outstanding = sum(customers, (c) => Math.max(0, balanceFor(db.ledger, c.id)))

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthOrders = completed.filter((o) => new Date(o.createdAt) >= monthStart)
  const monthRevenue = sum(monthOrders, (o) => o.total)
  const monthExpenses = sum(
    db.expenses.filter((e) => e.storeId === store.id && new Date(e.date) >= monthStart),
    (e) => e.amount,
  )

  const trend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = dateKey(d)
    const dayOrders = completed.filter((o) => dateKey(o.createdAt) === key)
    return {
      day: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      revenue: Math.round(sum(dayOrders, (o) => o.total) * 1000) / 1000,
      orders: dayOrders.length,
    }
  })
  const trendTotal = sum(trend, (t) => t.revenue)
  const firstHalf = sum(trend.slice(0, 7), (t) => t.revenue)
  const secondHalf = sum(trend.slice(7), (t) => t.revenue)
  const trendDelta = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0

  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)
  const productStats = new Map<string, { name: string; emoji: string; qty: number; revenue: number }>()
  completed
    .filter((o) => new Date(o.createdAt) >= since30)
    .forEach((o) =>
      o.items.forEach((it) => {
        const cur = productStats.get(it.productId) ?? {
          name: it.name,
          emoji: it.emoji,
          qty: 0,
          revenue: 0,
        }
        cur.qty += it.qty
        cur.revenue += it.qty * it.price
        productStats.set(it.productId, cur)
      }),
    )
  const topProducts = Array.from(productStats.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  const lowStock = db.products
    .filter(
      (p) =>
        p.storeId === store.id &&
        p.active &&
        p.trackStock &&
        p.stock <= store.settings.lowStockThreshold,
    )
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5)

  const paymentMix = (['cash', 'card', 'credit'] as const).map((method) => {
    const list = today.filter((o) => o.paymentMethod === method)
    return { method, count: list.length, amount: sum(list, (o) => o.total) }
  })
  const mixTotal = Math.max(1, today.length)

  const recent = [...storeOrders]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 6)

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight text-ink">
            {greeting}, {user.name.split(' ')[0]} 👋
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            {fmtDate(now.toISOString())} · here&apos;s how {store.name} is doing today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/reports"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-[13px] font-semibold text-ink shadow-sm transition hover:bg-cream-100"
          >
            <BarChart3 className="h-4 w-4" /> Reports
          </Link>
          <Link
            to="/pos"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-accent-700"
          >
            <Plus className="h-4 w-4" /> New sale
          </Link>
        </div>
      </div>

      {store.status === 'trial' && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent-500/25 bg-accent-50 px-4 py-3">
          <Badge tone="accent">Trial</Badge>
          <p className="text-[12.5px] text-accent-700">
            Your trial ends {store.trialEndsAt ? fmtDate(store.trialEndsAt) : 'soon'} — everything is
            unlocked until then.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        <StatCard
          label="Revenue today"
          value={money(todayRevenue)}
          sub={
            <span className={cn('inline-flex items-center gap-1 font-semibold', delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)}% vs yesterday
            </span>
          }
          icon={<Banknote className="h-4.5 w-4.5" />}
          tone="accent"
        />
        <StatCard
          label="Orders today"
          value={today.length}
          sub={`${yesterday.length} yesterday`}
          icon={<ReceiptText className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Average ticket"
          value={money(avgTicket)}
          sub={quickModeLabel(store.settings.posMode)}
          icon={<TrendingUp className="h-4.5 w-4.5" />}
          tone="success"
        />
        <StatCard
          label="Outstanding tabs"
          value={money(outstanding)}
          sub={`${customers.filter((c) => balanceFor(db.ledger, c.id) > 0).length} customers owe`}
          icon={<Users className="h-4.5 w-4.5" />}
          tone={outstanding > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">Revenue</h3>
              <p className="mt-0.5 text-[12px] text-muted">Last 14 days</p>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-right text-[18px] font-extrabold tracking-tight tabular">
                  {money(trendTotal)}
                </div>
                <div
                  className={cn(
                    'text-right text-[11px] font-semibold',
                    trendDelta >= 0 ? 'text-emerald-600' : 'text-red-500',
                  )}
                >
                  {trendDelta >= 0 ? '+' : ''}
                  {trendDelta.toFixed(1)}% vs previous week
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 h-[228px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B4652F" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="#B4652F" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee6d9" vertical={false} />
                <XAxis dataKey="day" {...axisProps} interval={1} />
                <YAxis {...axisProps} width={54} tickFormatter={(v) => `${v}`} />
                <Tooltip content={<ChartTooltip formatter={(v) => money(v)} />} cursor={{ stroke: '#d9c9b4' }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#B4652F"
                  strokeWidth={2.2}
                  fill="url(#rev)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Payment mix" subtitle="Today's collections" />
          <div className="space-y-3">
            {paymentMix.map((p) => {
              const pct = Math.round((p.count / mixTotal) * 100)
              const meta = {
                cash: { label: 'Cash', icon: Banknote, color: 'bg-emerald-500' },
                card: { label: 'Card', icon: CreditCard, color: 'bg-sky-500' },
                credit: { label: 'On tab', icon: Wallet, color: 'bg-accent-500' },
              }[p.method]
              return (
                <div key={p.method}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                      <meta.icon className="h-3.5 w-3.5 text-muted" /> {meta.label}
                    </span>
                    <span className="font-semibold tabular">{money(p.amount)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-cream-200">
                    <div className={cn('h-full rounded-full', meta.color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 rounded-xl bg-cream-100 p-3">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">
              This month
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-[13px] text-muted">Sales</span>
              <span className="text-[14px] font-bold tabular">{money(monthRevenue)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-[13px] text-muted">Expenses</span>
              <span className="text-[14px] font-bold text-red-500 tabular">−{money(monthExpenses)}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-[12px] font-semibold">Net</span>
              <span
                className={cn(
                  'text-[15px] font-extrabold tabular',
                  monthRevenue - monthExpenses >= 0 ? 'text-emerald-600' : 'text-red-500',
                )}
              >
                {money(monthRevenue - monthExpenses)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">Recent orders</h3>
              <p className="mt-0.5 text-[12px] text-muted">Live from the counter</p>
            </div>
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-700 hover:text-accent-600"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-line/70">
            {recent.length === 0 && (
              <div className="px-5 py-10 text-center text-[13px] text-muted">No orders yet today.</div>
            )}
            {recent.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-[11px] font-bold text-muted">
                  #{o.number.toString().slice(-2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-ink">
                      Order #{o.number}
                    </span>
                    <Badge tone={o.status === 'void' ? 'danger' : o.paymentMethod === 'credit' ? 'accent' : 'success'}>
                      {o.status === 'void' ? 'Void' : o.paymentMethod === 'credit' ? 'Tab' : 'Paid'}
                    </Badge>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted">
                    {o.items.reduce((a, i) => a + i.qty, 0)} items · {o.staffName} · {fmtTime(o.createdAt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold tabular">{money(o.total)}</div>
                  <div className="text-[10.5px] capitalize text-muted">{o.channel.replace('-', ' ')}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle
            title="Top sellers"
            subtitle="Last 30 days"
            action={<Badge tone="neutral">by qty</Badge>}
          />
          <div className="space-y-2.5">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2.5">
                <span className="w-4 text-[11px] font-bold text-muted/60">{i + 1}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-100 text-base">
                  {p.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-ink">{p.name}</div>
                  <div className="text-[10.5px] text-muted">{p.qty} sold</div>
                </div>
                <span className="text-[12px] font-bold text-ink tabular">{money(p.revenue)}</span>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="py-6 text-center text-[12.5px] text-muted">No sales in this period.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div className="flex items-center gap-2">
              <PackageX className="h-4 w-4 text-amber-600" />
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-ink">Low stock</h3>
                <p className="mt-0.5 text-[12px] text-muted">
                  At or below {store.settings.lowStockThreshold} units
                </p>
              </div>
            </div>
            <Link
              to="/admin/products"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-700 hover:text-accent-600"
            >
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="px-5 py-8 text-center text-[12.5px] text-muted">
              Everything is well stocked. Nice.
            </p>
          ) : (
            <div className="divide-y divide-line/70">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-100 text-base">
                    {p.emoji}
                  </span>
                  <span className="flex-1 text-[12.5px] font-semibold text-ink">{p.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                      p.stock === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700',
                    )}
                  >
                    {p.stock} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle title="Team snapshot" subtitle="Active staff today" />
          <div className="space-y-2">
            {db.users
              .filter((u) => u.storeId === store.id)
              .slice(0, 4)
              .map((u) => {
                const sold = today.filter((o) => o.staffId === u.id)
                return (
                  <div key={u.id} className="flex items-center gap-2.5">
                    <Avatar name={u.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold text-ink">{u.name}</div>
                      <div className="text-[10.5px] capitalize text-muted">
                        {u.role} · {sold.length} orders
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold tabular">
                      {money(sum(sold, (o) => o.total))}
                    </span>
                  </div>
                )
              })}
          </div>
          <Link
            to="/admin/staff"
            className="mt-3 flex items-center justify-center gap-1 rounded-xl border border-line py-2 text-[12px] font-semibold text-ink transition hover:bg-cream-100"
          >
            Manage team <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>
    </div>
  )
}

function quickModeLabel(mode: 'quick' | 'cashier') {
  return mode === 'quick' ? 'Quick-order mode active' : 'Cashier mode active'
}

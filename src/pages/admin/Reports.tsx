import { useState } from 'react'
import {
  Banknote,
  Download,
  Percent,
  ReceiptText,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApp } from '../../store/AppStore'
import { Badge, Button, Card, Segmented } from '../../components/ui'
import { ChartTooltip, axisProps } from '../../components/charts'
import { balanceFor } from '../../lib/selectors'
import { cn, csvDownload, dateKey, fmtDate, money, sum } from '../../lib/utils'

type Period = 'today' | 'week' | 'month' | 'year'

const methodColors: Record<string, string> = {
  cash: '#10b981',
  card: '#0ea5e9',
  credit: '#B4652F',
}

export default function Reports() {
  const { db, store } = useApp()
  const [period, setPeriod] = useState<Period>('month')

  if (!store) return null

  const now = new Date()
  const { start, label } = getRange(period, now)

  const orders = db.orders.filter(
    (o) =>
      o.storeId === store.id &&
      o.status === 'completed' &&
      new Date(o.createdAt) >= start &&
      new Date(o.createdAt) <= now,
  )
  const sales = sum(orders, (o) => o.total)
  const expenses = sum(
    db.expenses.filter((e) => e.storeId === store.id && new Date(e.date) >= start && new Date(e.date) <= now),
    (e) => e.amount,
  )
  const avgTicket = orders.length ? sales / orders.length : 0

  const series = buildSeries(period, orders, now)
  const seriesTotal = sum(series, (s) => s.value)

  const productStats = new Map<string, { name: string; emoji: string; qty: number; revenue: number }>()
  orders.forEach((o) =>
    o.items.forEach((i) => {
      const cur = productStats.get(i.productId) ?? { name: i.name, emoji: i.emoji, qty: 0, revenue: 0 }
      cur.qty += i.qty
      cur.revenue += i.qty * i.price
      productStats.set(i.productId, cur)
    }),
  )
  const topProducts = Array.from(productStats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8)

  const categoryStats = new Map<string, { name: string; revenue: number }>()
  orders.forEach((o) =>
    o.items.forEach((i) => {
      const product = db.products.find((p) => p.id === i.productId)
      const cat = db.categories.find((c) => c.id === product?.categoryId)
      const key = cat?.name ?? 'Other'
      const cur = categoryStats.get(key) ?? { name: key, revenue: 0 }
      cur.revenue += i.qty * i.price
      categoryStats.set(key, cur)
    }),
  )
  const categoryList = Array.from(categoryStats.values()).sort((a, b) => b.revenue - a.revenue)

  const staffStats = new Map<string, { name: string; orders: number; revenue: number }>()
  orders.forEach((o) => {
    const cur = staffStats.get(o.staffId) ?? { name: o.staffName, orders: 0, revenue: 0 }
    cur.orders += 1
    cur.revenue += o.total
    staffStats.set(o.staffId, cur)
  })
  const staffList = Array.from(staffStats.values()).sort((a, b) => b.revenue - a.revenue)

  const paymentMix = (['cash', 'card', 'credit'] as const).map((method) => {
    const list = orders.filter((o) => o.paymentMethod === method)
    return { name: method, value: sum(list, (o) => o.total), count: list.length }
  })
  const paymentTotal = Math.max(1, sum(paymentMix, (p) => p.value))

  const ledgerInRange = db.ledger.filter(
    (l) => l.storeId === store.id && new Date(l.createdAt) >= start && new Date(l.createdAt) <= now,
  )
  const charges = sum(ledgerInRange.filter((l) => l.type === 'charge'), (l) => l.amount)
  const settled = sum(ledgerInRange.filter((l) => l.type === 'payment'), (l) => l.amount)
  const outstanding = sum(
    db.customers.filter((c) => c.storeId === store.id),
    (c) => Math.max(0, balanceFor(db.ledger, c.id)),
  )

  const expenseByCategory = new Map<string, number>()
  db.expenses
    .filter((e) => e.storeId === store.id && new Date(e.date) >= start && new Date(e.date) <= now)
    .forEach((e) => expenseByCategory.set(e.category, (expenseByCategory.get(e.category) ?? 0) + e.amount))

  const exportSummary = () => {
    csvDownload(`report-${store.slug}-${period}.csv`, [
      ['Kawa POS report', `${store.name} — ${label}`],
      [],
      ['Sales', sales.toFixed(3)],
      ['Orders', orders.length],
      ['Average ticket', avgTicket.toFixed(3)],
      ['Expenses', expenses.toFixed(3)],
      ['Net profit', (sales - expenses).toFixed(3)],
      ['New tab charges', charges.toFixed(3)],
      ['Tab settlements', settled.toFixed(3)],
      ['Outstanding balance', outstanding.toFixed(3)],
      [],
      ['Top products', 'Qty', 'Revenue'],
      ...topProducts.map((p) => [p.name, p.qty, p.revenue.toFixed(3)]),
      [],
      ['Staff', 'Orders', 'Revenue'],
      ...staffList.map((s) => [s.name, s.orders, s.revenue.toFixed(3)]),
    ])
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Reports</h2>
          <p className="mt-1 text-[13px] text-muted">
            {label} · every number is calculated from your real orders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={period}
            onChange={setPeriod}
            size="sm"
            options={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
            ]}
          />
          <Button variant="secondary" size="sm" onClick={exportSummary}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Gross sales" value={money(sales)} sub={`${orders.length} orders`} icon={<Banknote className="h-4 w-4" />} accent />
        <Kpi label="Average ticket" value={money(avgTicket)} sub="per order" icon={<TrendingUp className="h-4 w-4" />} />
        <Kpi label="Expenses" value={money(expenses)} sub={`${expenseByCategory.size} categories`} icon={<Wallet className="h-4 w-4" />} />
        <Kpi
          label="Net profit"
          value={money(sales - expenses)}
          sub="sales − expenses"
          icon={<Percent className="h-4 w-4" />}
          tone={sales - expenses >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Sales over time</h3>
              <p className="mt-0.5 text-[12px] capitalize text-muted">{period}</p>
            </div>
            <div className="text-right">
              <div className="text-[18px] font-extrabold tabular">{money(seriesTotal)}</div>
              <div className="text-[10.5px] text-muted">{series.filter((s) => s.value > 0).length} active periods</div>
            </div>
          </div>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee6d9" vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
                <YAxis {...axisProps} width={54} />
                <Tooltip content={<ChartTooltip formatter={(v) => money(v)} />} cursor={{ fill: '#f6efe4' }} />
                <Bar dataKey="value" name="Sales" fill="#B4652F" radius={[5, 5, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Payment methods</h3>
          <p className="mt-0.5 text-[12px] text-muted">Share of collected sales</p>
          {sales > 0 ? (
            <>
              <div className="relative mx-auto mt-1 h-[170px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMix.filter((p) => p.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {paymentMix
                        .filter((p) => p.value > 0)
                        .map((p) => (
                          <Cell key={p.name} fill={methodColors[p.name]} />
                        ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip formatter={(v) => money(v)} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Total</span>
                  <span className="text-[15px] font-extrabold tabular">{money(sales)}</span>
                </div>
              </div>
              <div className="space-y-2">
                {paymentMix.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-[12px]">
                    <span className="h-2 w-2 rounded-full" style={{ background: methodColors[p.name] }} />
                    <span className="capitalize text-muted">{p.name}</span>
                    <span className="ml-auto font-semibold tabular">
                      {Math.round((p.value / paymentTotal) * 100)}%
                    </span>
                    <span className="w-[74px] text-right text-[11px] text-muted tabular">
                      {money(p.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-[12.5px] text-muted">
              No sales in this period.
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="px-5 pb-3 pt-5">
            <h3 className="text-[15px] font-semibold tracking-tight">Top products</h3>
            <p className="mt-0.5 text-[12px] text-muted">By revenue in this period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line/70 text-[10.5px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-2 font-semibold">Product</th>
                  <th className="px-4 py-2 text-right font-semibold">Qty</th>
                  <th className="px-4 py-2 text-right font-semibold">Revenue</th>
                  <th className="px-5 py-2 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.name} className="border-b border-line/50 text-[12.5px]">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream-100 text-sm">
                          {p.emoji}
                        </span>
                        <span className="font-medium text-ink">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted tabular">{p.qty}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular">{money(p.revenue)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-cream-200">
                          <div
                            className="h-full rounded-full bg-accent-500"
                            style={{ width: `${sales > 0 ? (p.revenue / sales) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-8 text-[11px] text-muted tabular">
                          {sales > 0 ? Math.round((p.revenue / sales) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!topProducts.length && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-[12.5px] text-muted">
                      No products sold in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-[15px] font-semibold tracking-tight">Customer tabs</h3>
            <div className="mt-3 space-y-2.5 text-[12px]">
              <Line label="New charges" value={money(charges)} />
              <Line label="Settlements received" value={money(settled)} valueClass="text-emerald-600" />
              <div className="border-t border-dashed border-line pt-2.5">
                <Line label="Outstanding overall" value={money(outstanding)} valueClass="text-accent-700" strong />
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-cream-100 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
              {outstanding > 0
                ? `${db.customers.filter((c) => c.storeId === store.id && balanceFor(db.ledger, c.id) > 0).length} customers have an open tab.`
                : 'Every tab is settled. Clean books.'}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[15px] font-semibold tracking-tight">Expenses</h3>
            <div className="mt-3 space-y-2">
              {Array.from(expenseByCategory.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([name, amount]) => (
                  <div key={name} className="flex items-center justify-between text-[12px]">
                    <span className="text-muted">{name}</span>
                    <span className="font-semibold tabular">{money(amount)}</span>
                  </div>
                ))}
              {!expenseByCategory.size && (
                <p className="py-3 text-center text-[12px] text-muted">No expenses recorded.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Categories</h3>
              <p className="mt-0.5 text-[12px] text-muted">Revenue by menu section</p>
            </div>
            <Badge tone="neutral">{categoryList.length}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {categoryList.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-ink">{c.name}</span>
                  <span className="font-semibold tabular">{money(c.revenue)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-cream-200">
                  <div
                    className="h-full rounded-full bg-espresso-700"
                    style={{ width: `${sales > 0 ? (c.revenue / sales) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {!categoryList.length && (
              <p className="py-6 text-center text-[12.5px] text-muted">No category data.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Staff performance</h3>
              <p className="mt-0.5 text-[12px] text-muted">Who sold what</p>
            </div>
            <Users className="h-4 w-4 text-muted" />
          </div>
          <div className="mt-4 space-y-3">
            {staffList.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cream-200 text-[11px] font-bold text-muted">
                  {s.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-ink">{s.name}</div>
                  <div className="text-[10.5px] text-muted">{s.orders} orders</div>
                </div>
                <span className="text-[12.5px] font-bold tabular">{money(s.revenue)}</span>
              </div>
            ))}
            {!staffList.length && (
              <p className="py-6 text-center text-[12.5px] text-muted">No sales in this period.</p>
            )}
          </div>
          {staffList.length > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-cream-100 px-3 py-2.5 text-[11px] text-muted">
              <ReceiptText className="h-3.5 w-3.5" />
              Best seller: <span className="font-semibold text-ink">{staffList[0].name}</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Line({
  label,
  value,
  valueClass,
  strong,
}: {
  label: string
  value: string
  valueClass?: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn(strong ? 'text-[14px] font-extrabold' : 'font-semibold', 'tabular', valueClass)}>
        {value}
      </span>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  icon,
  accent,
  tone,
}: {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  accent?: boolean
  tone?: 'good' | 'bad'
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{label}</span>
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            accent ? 'bg-accent-50 text-accent-600' : 'bg-cream-100 text-muted',
          )}
        >
          {icon}
        </span>
      </div>
      <div
        className={cn(
          'mt-2 text-[20px] font-extrabold tracking-tight tabular',
          tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-500' : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted">{sub}</div>
    </Card>
  )
}

function getRange(period: Period, now: Date) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === 'week') start.setDate(start.getDate() - 6)
  if (period === 'month') start.setDate(1)
  if (period === 'year') start.setMonth(0, 1)
  const label =
    period === 'today'
      ? `Today, ${fmtDate(now.toISOString())}`
      : period === 'week'
        ? `Last 7 days · ${fmtDate(start.toISOString())} – ${fmtDate(now.toISOString())}`
        : period === 'month'
          ? now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
          : `Year ${now.getFullYear()}`
  return { start, label }
}

function buildSeries(
  period: Period,
  orders: Array<{ createdAt: string; total: number }>,
  now: Date,
) {
  if (period === 'today') {
    return Array.from({ length: 14 }, (_, i) => {
      const hour = 7 + i
      const value = sum(
        orders.filter((o) => new Date(o.createdAt).getHours() === hour),
        (o) => o.total,
      )
      return { label: `${String(hour).padStart(2, '0')}:00`, value: Math.round(value * 1000) / 1000 }
    })
  }
  if (period === 'week' || period === 'month') {
    const days = period === 'week' ? 7 : now.getDate()
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now)
      if (period === 'week') {
        d.setDate(d.getDate() - (days - 1 - i))
      } else {
        d.setDate(i + 1)
      }
      const key = dateKey(d)
      const value = sum(
        orders.filter((o) => dateKey(o.createdAt) === key),
        (o) => o.total,
      )
      return {
        label:
          period === 'week'
            ? d.toLocaleDateString('en-GB', { weekday: 'short' })
            : String(i + 1),
        value: Math.round(value * 1000) / 1000,
      }
    })
  }
  return Array.from({ length: 12 }, (_, m) => {
    const value = sum(
      orders.filter((o) => {
        const d = new Date(o.createdAt)
        return d.getMonth() === m && d.getFullYear() === now.getFullYear()
      }),
      (o) => o.total,
    )
    return {
      label: new Date(now.getFullYear(), m, 1).toLocaleDateString('en-GB', { month: 'short' }),
      value: Math.round(value * 1000) / 1000,
    }
  })
}

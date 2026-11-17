import { BarChart3, ClipboardList, Wallet } from 'lucide-react'
import type { Database } from '../../../types'
import { money } from '../../../lib/utils'
import { registerDifferenceTotal } from '../../../lib/reports'
import { Card } from '../../../components/ui'
import type { Period, ReportData } from './reportData'
import { getRange } from './reportData'

export function QuickReports({ data, db, storeId, period, now }: {
  data: ReportData
  db: Database
  storeId: string
  period: Period
  now: Date
}) {
  const { start } = getRange(period, now)
  const itemsSold = data.orders.reduce((count, order) =>
    count + order.items.reduce((quantity, item) => quantity + item.qty, 0), 0)
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: data.orders.filter((order) => new Date(order.createdAt).getHours() === hour).length,
  }))
  const staffCounts = new Map<string, { name: string; orders: number }>()
  for (const order of data.orders) {
    const current = staffCounts.get(order.staffId) ?? { name: order.staffName, orders: 0 }
    current.orders += 1
    staffCounts.set(order.staffId, current)
  }
  const shifts = db.registerSessions.filter((session) =>
    session.storeId === storeId &&
    session.status === 'closed' &&
    !!session.closedAt &&
    new Date(session.closedAt) >= start &&
    new Date(session.closedAt) <= now,
  )
  const shiftDifference = registerDifferenceTotal(
    db.registerSessions,
    storeId,
    start.toISOString(),
    now.toISOString(),
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Summary icon={ClipboardList} label="Orders" value={String(data.orders.length)} />
        <Summary icon={BarChart3} label="Items sold" value={String(itemsSold)} />
        <Summary icon={Wallet} label="Expenses" value={money(data.expenses)} />
        <Summary icon={Wallet} label="Shift difference" value={money(shiftDifference)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Orders per hour</h3>
          <p className="mt-0.5 text-[12px] text-muted">Count of completed orders</p>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {hourly.filter((row) => row.count > 0).map((row) => (
              <div key={row.hour} className="rounded-lg bg-cream-100 px-2 py-2 text-center">
                <div className="text-[10px] text-muted">{String(row.hour).padStart(2, '0')}:00</div>
                <div className="mt-0.5 text-sm font-bold tabular text-ink">{row.count}</div>
              </div>
            ))}
            {!hourly.some((row) => row.count > 0) && (
              <p className="col-span-full py-4 text-center text-xs text-muted">No orders in this period.</p>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Orders per staff</h3>
          <div className="mt-3 divide-y divide-line/70">
            {[...staffCounts.values()].sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name)).map((row) => (
              <div key={row.name} className="flex items-center justify-between py-2.5 text-[12px]">
                <span className="font-semibold text-ink">{row.name}</span>
                <span className="tabular text-muted">{row.orders} orders</span>
              </div>
            ))}
            {!staffCounts.size && <p className="py-4 text-center text-xs text-muted">No staff orders.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Expenses</h3>
          <div className="mt-3 space-y-2">
            {[...data.expenseByCategory.entries()].map(([category, amount]) => (
              <div key={category} className="flex items-center justify-between text-[12px]">
                <span className="text-muted">{category}</span>
                <span className="font-semibold tabular">{money(amount)}</span>
              </div>
            ))}
            {!data.expenseByCategory.size && <p className="py-3 text-center text-xs text-muted">No expenses recorded.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Shift differences</h3>
          <div className="mt-3 divide-y divide-line/70">
            {shifts.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 py-2.5 text-[12px]">
                <span className="min-w-0 truncate text-ink">{session.openedByName}</span>
                <span className="shrink-0 font-semibold tabular">{money(session.difference ?? 0)}</span>
              </div>
            ))}
            {!shifts.length && <p className="py-3 text-center text-xs text-muted">No closed shifts in this period.</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Summary({ icon: Icon, label, value }: {
  icon: typeof ClipboardList
  label: string
  value: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
        <Icon className="h-4 w-4 text-muted" />
      </div>
      <div className="mt-2 text-xl font-extrabold tabular text-ink">{value}</div>
    </Card>
  )
}

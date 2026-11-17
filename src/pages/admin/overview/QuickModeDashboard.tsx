import { ClipboardList, CreditCard, PackageCheck, ReceiptText, Wallet } from 'lucide-react'
import type { AdminDashboardData } from '../../../lib/dashboard'
import { money, relative } from '../../../lib/utils'
import { orderNumberLabel } from '../../../lib/orderNumber'
import type { Store } from '../../../types'
import { GradientKpiCard } from '../../../components/dashboard/GradientKpiCard'
import { SectionCard } from '../../../components/dashboard/SectionCard'

export function QuickModeDashboard({ data, store }: {
  data: AdminDashboardData
  store: Store
}) {
  const recentOrders = data.recentOrders.filter((order) => order.status === 'completed')
  const byStaff = new Map<string, { name: string; orders: number }>()
  for (const order of data.todayOrders) {
    const current = byStaff.get(order.staffId) ?? { name: order.staffName, orders: 0 }
    current.orders += 1
    byStaff.set(order.staffId, current)
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <GradientKpiCard icon={ClipboardList} tone="blue" label="Orders today" value={data.todayOrders.length} caption={`${data.yesterdayOrders.length} yesterday`} />
        <GradientKpiCard icon={PackageCheck} tone="amber" label="Items sold" value={data.itemsSold} caption="Today" />
        <GradientKpiCard icon={CreditCard} tone="rose" label="Open tabs" value={data.debtorCount} caption="Customers with a balance" />
        <GradientKpiCard icon={ReceiptText} tone="green" label="Shift status" value={data.registerSession ? 'Open' : 'Closed'} caption="Register shift" />
        <GradientKpiCard icon={Wallet} tone="purple" label="Month expenses" value={money(data.monthExpenses)} caption="Recorded expenses" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard icon={ReceiptText} tone="blue" title="Orders per staff" subtitle="Completed order counts today">
          {byStaff.size ? (
            <div className="divide-y divide-line/70 px-4 pb-3 sm:px-5">
              {[...byStaff.values()].sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name)).map((row) => (
                <div key={row.name} className="flex items-center justify-between py-2.5 text-[12px]">
                  <span className="font-semibold text-ink">{row.name}</span>
                  <span className="tabular text-muted">{row.orders} orders</span>
                </div>
              ))}
            </div>
          ) : <p className="px-5 pb-4 text-xs text-muted">No completed orders today.</p>}
        </SectionCard>
        <SectionCard icon={ClipboardList} tone="purple" title="Recent orders" subtitle="Order activity · no sale totals">
          {recentOrders.length ? (
            <div className="divide-y divide-line/70 px-4 pb-3 sm:px-5">
              {recentOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 py-2.5 text-[12px]">
                  <span className="min-w-0 truncate font-semibold text-ink">
                    Order #{orderNumberLabel(order, store.settings)} · {order.staffName}
                  </span>
                  <span className="shrink-0 text-muted">{order.items.length} items · {relative(order.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : <p className="px-5 pb-4 text-xs text-muted">No completed orders yet.</p>}
        </SectionCard>
      </div>
    </>
  )
}

import { ClipboardList } from 'lucide-react'
import type { AdminDashboardData } from '../../../lib/dashboard'
import { fmtTime } from '../../../lib/utils'
import { EmptyState } from '../../../components/dashboard/EmptyState'
import { SectionCard } from '../../../components/dashboard/SectionCard'

export function TrackedOrdersCard({ data }: { data: AdminDashboardData }) {
  const orders = data.recentOrders.filter((order) => String(order.status) === 'recorded')
  return (
    <SectionCard icon={ClipboardList} tone="purple" title="Tracked orders" subtitle="Recorded activity · no payment totals" bodyClassName="px-4 pb-4 sm:px-5">
      {orders.length === 0 ? <EmptyState icon={ClipboardList} title="No tracked orders yet" description="Recorded orders will appear here without payment amounts." /> : (
        <div className="divide-y divide-line/70">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center gap-3 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-[10px] font-bold text-brand-navy">#{order.number.toString().slice(-2)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold">Order #{order.number}</div>
                <div className="mt-0.5 truncate text-[10px] text-muted">{order.staffName} · {order.items.length} products · {fmtTime(order.createdAt)}</div>
              </div>
              <span className="text-[11px] font-semibold text-muted">{order.items.reduce((count, item) => count + item.qty, 0)} items</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

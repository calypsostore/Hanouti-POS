import { useState } from 'react'
import { Card, Badge } from '../../../components/ui'
import { getStaffPerformance } from '../../../lib/staffPerformance'
import { money } from '../../../lib/utils'
import type { Database, Store, User } from '../../../types'

export default function StaffPerformanceCard({ member, db, store }: {
  member: User
  db: Database
  store: Store
}) {
  const [now] = useState(() => new Date())
  const stats = getStaffPerformance(db, store.id, member.id, 'month', now, store.settings.automation.cashDifferenceTolerance)
  const items = [
    ['Shifts', String(stats.shifts)],
    ['Sales', money(stats.sales)],
    ['Orders', String(stats.orders)],
    ['Average ticket', money(stats.averageTicket)],
    ['Tables served', String(stats.tablesServed)],
    ['Voids', `${stats.voids} · ${stats.discountRate}% discounts`],
    ['Cash accuracy', `${stats.cashAccuracy}%`],
    ['Shortage / overage', `${money(stats.shortage)} / ${money(stats.overage)}`],
  ]
  const tone = stats.status === 'Excellent' ? 'success' : stats.status === 'Good' ? 'warning' : 'danger'
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold text-ink">Staff performance · this month</h3>
        <Badge tone={tone}>{stats.status}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-cream-100/70 p-2.5">
            <div className="text-[10px] text-muted">{label}</div>
            <div className="mt-1 text-[12px] font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-muted">Excellent: accuracy ≥98%, discounts ≤5%, voids ≤2%; Good: ≥90%, ≤10%, ≤5%.</p>
    </Card>
  )
}

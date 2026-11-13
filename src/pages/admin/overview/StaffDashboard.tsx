import { useMemo, useState } from 'react'
import { useApp } from '../../../store/AppStore'
import { getStaffDashboardData, getTableOccupancy, canViewFinancials } from '../../../lib/dashboard'
import { money, relative } from '../../../lib/utils'
import { Badge } from '../../../components/ui'
import { GradientKpiCard } from '../../../components/dashboard/GradientKpiCard'
import { QuickActionTile } from '../../../components/dashboard/QuickActionTile'
import { SectionCard } from '../../../components/dashboard/SectionCard'
import { AdminHeader } from './AdminHeader'
import { ReceiptText, ShoppingBag, Utensils, Users, Wallet } from 'lucide-react'

export default function StaffDashboard() {
  const { db, store, user } = useApp()
  const [now] = useState(() => new Date())
  const data = useMemo(() => store && user ? getStaffDashboardData(db, store.id, user.id, now) : null, [db, now, store, user])
  if (!store || !user || !data) return null
  const openRegister = db.registerSessions.some((session) => session.storeId === store.id && session.status === 'open')
  const canSeeMoney = canViewFinancials(user)
  const tableOccupancy = getTableOccupancy(db, store.id)
  return (
    <div className="space-y-5">
      <AdminHeader store={store} user={user} registerOpen={openRegister} now={now} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <GradientKpiCard icon={ReceiptText} tone="blue" label="Your orders today" value={data.count} caption={`${data.items} items sold`} sparkline={Array.from({ length: 24 }, (_, hour) => data.orders.filter((order) => new Date(order.createdAt).getHours() === hour).length)} />
        {canSeeMoney && <GradientKpiCard icon={Wallet} tone="green" label="Your sales today" value={money(data.total)} caption="Completed orders only" />}
        <GradientKpiCard icon={ShoppingBag} tone="amber" label="Register status" value={openRegister ? 'Open' : 'Closed'} caption={user.permissions.register ? 'Your store register' : 'Ask a manager about register access'} />
      </div>
      {!user.permissions.register && <div className="rounded-2xl border border-line bg-white px-4 py-3 text-xs text-muted dark:bg-espresso-800">Shift tracking is not available in this demo.</div>}
      <SectionCard icon={ShoppingBag} tone="amber" title="Quick actions" subtitle="Pick up where you left off" bodyClassName="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-5">
        <QuickActionTile icon={ShoppingBag} tone="amber" label="New order" href="/pos" />
        {store.settings.features.tables && (
          <QuickActionTile
            icon={Utensils}
            tone="teal"
            label="Tables"
            detail={`${tableOccupancy.free} free · ${tableOccupancy.occupied} occupied`}
            href="/pos/floor"
          />
        )}
        <QuickActionTile icon={ReceiptText} tone="blue" label="My orders" href="/admin/orders?mine=true" />
        {user.permissions.settle && <QuickActionTile icon={Users} tone="teal" label="Collect tab" href="/admin/customers" />}
      </SectionCard>
      <SectionCard icon={ReceiptText} tone="blue" title="Your recent orders" subtitle="Latest transactions" bodyClassName="px-4 pb-4 sm:px-5">
        {data.recentOrders.length === 0 ? <p className="py-6 text-center text-xs text-muted">Your orders will appear here after your first sale.</p> : (
          <div className="divide-y divide-line/70">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-[10px] font-bold text-brand-navy">#{order.number.toString().slice(-2)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-xs font-bold">Order #{order.number}</span><Badge tone={order.status === 'void' ? 'danger' : 'success'}>{order.status === 'void' ? 'Void' : 'Completed'}</Badge></div>
                  <div className="mt-1 text-[10px] text-muted">{relative(order.createdAt)} · {order.items.length} products</div>
                </div>
                {canSeeMoney && <span className="text-xs font-bold tabular">{money(order.total)}</span>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

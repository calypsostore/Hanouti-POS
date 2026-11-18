import { useMemo, useState } from 'react'
import { useApp } from '../../../store/AppStore'
import { getStaffDashboardData, getTableOccupancy, canViewFinancials } from '../../../lib/dashboard'
import { money, relative } from '../../../lib/utils'
import { orderNumberLabel } from '../../../lib/orderNumber'
import { Badge, Button, Select, Toggle } from '../../../components/ui'
import { GradientKpiCard } from '../../../components/dashboard/GradientKpiCard'
import { QuickActionTile } from '../../../components/dashboard/QuickActionTile'
import { SectionCard } from '../../../components/dashboard/SectionCard'
import { AdminHeader } from './AdminHeader'
import { ChefHat, CreditCard, ReceiptText, ShoppingBag, Utensils, Users, Wallet } from 'lucide-react'
import { openShiftForStaff } from '../../../lib/registerShifts'
import { can } from '../../../lib/permissions'
import { canAddOrdersToTabs, canSettleCustomerTabs, canViewCustomerTabs } from '../../../lib/customerTabs'
import { useToast } from '../../../components/toast'
import { modeFeatures } from '../../../lib/posMode'
import { ApplicationUpdatesCard } from '../../../components/ApplicationUpdatesCard'

export default function StaffDashboard() {
  const { db, store, user, updateStationLanding } = useApp()
  const { push } = useToast()
  const [now] = useState(() => new Date())
  const [stationId, setStationId] = useState(user?.stationId ?? '')
  const [goStraight, setGoStraight] = useState(user?.goStraightToStation === true)
  const data = useMemo(() => store && user ? getStaffDashboardData(db, store.id, user.id, now) : null, [db, now, store, user])
  const stations = db.stations.filter((station) => station.storeId === store?.id && station.active && station.screen)
    .sort((a, b) => a.sort - b.sort)
  const waitingTickets = new Set(db.openOrders
    .filter((order) => order.storeId === store?.id)
    .flatMap((order) => order.items
      .filter((item) => item.status === 'sent' && item.stationId)
      .map((item) => `${order.id}:${item.stationId}`))).size

  if (!store || !user || !data) return null
  const openRegister = !!openShiftForStaff(db, store.id, user.id)
  const features = modeFeatures(store)
  const canSeeMoney = features.payments && canViewFinancials(user)
  const tableOccupancy = getTableOccupancy(db, store.id)
  return (
    <div className="space-y-5">
      <AdminHeader store={store} user={user} registerOpen={openRegister} now={now} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <GradientKpiCard icon={ReceiptText} tone="blue" label="Your orders today" value={data.count} caption={`${data.items} items sold`} sparkline={Array.from({ length: 24 }, (_, hour) => data.orders.filter((order) => new Date(order.createdAt).getHours() === hour).length)} />
        {canSeeMoney && <GradientKpiCard icon={Wallet} tone="green" label="Your sales today" value={money(data.total)} caption="Completed orders only" />}
        <GradientKpiCard icon={ShoppingBag} tone="amber" label="Shift status" value={openRegister ? 'Open' : 'Closed'} caption={can(user, 'openShift') || can(user, 'closeShift') ? 'Your personal shift' : 'Ask a manager about shift access'} />
      </div>
      {!can(user, 'openShift') && !can(user, 'closeShift') && <div className="rounded-2xl border border-line bg-white px-4 py-3 text-xs text-muted dark:bg-espresso-800">Ask a manager to enable shift access.</div>}
      <SectionCard icon={ShoppingBag} tone="amber" title="Quick actions" subtitle="Pick up where you left off" bodyClassName="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-5">
        <QuickActionTile icon={ShoppingBag} tone="amber" label="New order" href="/pos" />
        {features.kitchenStations && can(user, 'viewStation') && (
          <QuickActionTile
            icon={ChefHat}
            tone="green"
            label="Stations"
            detail={`${waitingTickets} waiting`}
            href="/kitchen"
          />
        )}
        {features.tablesFloor && (
          <QuickActionTile
            icon={Utensils}
            tone="teal"
            label="Tables"
            detail={`${tableOccupancy.free} free · ${tableOccupancy.occupied} occupied`}
            href="/pos/floor"
          />
        )}
        {can(user, 'viewOrders') && <QuickActionTile icon={ReceiptText} tone="blue" label="My orders" href="/admin/orders?mine=true" />}
        <QuickActionTile icon={Users} tone="teal" label="My profile" href={`/admin/staff/${encodeURIComponent(user.id)}`} />
        {(can(user, 'openShift') || can(user, 'closeShift')) && (
          <QuickActionTile
            icon={Wallet}
            tone="green"
            label={openRegister ? (can(user, 'closeShift') ? 'Close shift' : 'My shift') : (can(user, 'openShift') ? 'Open shift' : 'My shift')}
            href="/admin/register"
          />
        )}
        {canViewCustomerTabs(store, user) && (
          <QuickActionTile
            icon={CreditCard}
            tone="teal"
            label={canSettleCustomerTabs(store, user) ? 'Collect tab' : canAddOrdersToTabs(store, user) ? 'Add to tab' : 'Customer tabs'}
            href="/admin/customers"
          />
        )}
      </SectionCard>
      {can(user, 'viewStation') && !user.stationOnly && (
        <SectionCard icon={ChefHat} tone="green" title="Station access" subtitle="Choose where your next sign-in opens">
          <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end sm:px-5">
            <label className="min-w-0 flex-1 text-xs font-semibold text-ink">
              My station
              <Select className="mt-1" value={stationId} onChange={(event) => setStationId(event.target.value)}>
                <option value="">All stations</option>
                {stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
              </Select>
            </label>
            <Toggle checked={goStraight} onChange={setGoStraight} label="Go straight to my station" />
            <Button
              variant="secondary"
              disabled={goStraight && !stationId}
              onClick={() => {
                const result = updateStationLanding(stationId || undefined, goStraight)
                if (!result.ok) {
                  push(result.error, 'error')
                  return
                }
                push('Station sign-in preference saved', 'success')
              }}
            >
              Save
            </Button>
          </div>
        </SectionCard>
      )}
      <SectionCard icon={ReceiptText} tone="blue" title="Your recent orders" subtitle="Latest transactions" bodyClassName="px-4 pb-4 sm:px-5">
        {data.recentOrders.length === 0 ? <p className="py-6 text-center text-xs text-muted">Your orders will appear here after your first sale.</p> : (
          <div className="divide-y divide-line/70">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-[10px] font-bold text-accent-foreground">#{order.number.toString().slice(-2)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-xs font-bold">Order #{orderNumberLabel(order)}</span><Badge tone={order.status === 'void' ? 'danger' : 'success'}>{order.status === 'void' ? 'Void' : 'Completed'}</Badge></div>
                  <div className="mt-1 text-[10px] text-muted">{relative(order.createdAt)} · {order.items.length} products</div>
                </div>
                {canSeeMoney && <span className="text-xs font-bold tabular">{money(order.total)}</span>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      <ApplicationUpdatesCard />
    </div>
  )
}

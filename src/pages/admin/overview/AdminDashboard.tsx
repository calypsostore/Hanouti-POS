import { useMemo, useState } from 'react'
import {
  Banknote,
  ClipboardList,
  CreditCard,
  PackageCheck,
  ReceiptText,
  ShoppingBasket,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useApp } from '../../../store/AppStore'
import { getAdminDashboardData, percentChange } from '../../../lib/dashboard'
import { money } from '../../../lib/utils'
import { GradientKpiCard } from '../../../components/dashboard/GradientKpiCard'
import { StatCard } from '../../../components/dashboard/StatCard'
import { AdminHeader } from './AdminHeader'
import { BestSellersCard } from './BestSellersCard'
import { DashboardCharts } from './DashboardCharts'
import { DashboardRail } from './DashboardRail'
import { HourlyHeatStrip } from './HourlyHeatStrip'
import { StockAlertsCard } from './StockAlertsCard'
import { TopTabsAndOrders } from './TopTabsAndOrders'
import { TrackedOrdersCard } from './TrackedOrdersCard'

function trend(current: number, previous: number) {
  const value = percentChange(current, previous)
  return value === null ? undefined : { value: `${Math.abs(value).toFixed(1)}%`, positive: value >= 0 }
}

export default function AdminDashboard() {
  const { db, store, user } = useApp()
  const [now] = useState(() => new Date())
  const data = useMemo(() => store ? getAdminDashboardData({ db, store, now }) : null, [db, now, store])
  if (!store || !user || !data) return null
  const isTracking = data.isTrackingMode
  const todayCount = data.todayOrders.length
  const ordersMetric = todayCount

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminHeader store={store} user={user} registerOpen={!!data.registerSession} now={now} />
      {isTracking ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <GradientKpiCard icon={ClipboardList} tone="blue" label="Tracked orders" value={data.trackedOrders} caption="Recorded without payment" />
          <GradientKpiCard icon={PackageCheck} tone="amber" label="Items sold" value={data.itemsSold} caption="Tracked quantity today" />
          <GradientKpiCard icon={ReceiptText} tone="purple" label="Open orders" value={data.openOrders} caption="Pending tickets, if enabled" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <GradientKpiCard icon={Banknote} tone="green" label="Revenue today" value={money(data.todayRevenue)} caption={data.yesterdayRevenue ? 'Compared with yesterday' : 'No previous-day comparison'} trend={trend(data.todayRevenue, data.yesterdayRevenue)} />
          <GradientKpiCard icon={ReceiptText} tone="blue" label="Orders today" value={todayCount} caption={`${data.yesterdayOrders.length} yesterday`} trend={trend(ordersMetric, data.yesterdayOrders.length)} />
          <GradientKpiCard icon={PackageCheck} tone="amber" label="Open orders" value={data.openOrders} caption="No open-order state is stored" />
          <GradientKpiCard icon={CreditCard} tone="rose" label="Unpaid tabs" value={money(data.outstanding)} caption={`${data.debtorCount} customers with a balance`} />
        </div>
      )}

      {!isTracking && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard icon={TrendingUp} tone="blue" label="Average ticket" value={money(data.averageTicket)} caption="Today's completed sales" />
          <StatCard icon={ShoppingBasket} tone="purple" label="Items sold" value={data.itemsSold} caption="Today" />
          <StatCard icon={Banknote} tone="green" label="Month revenue" value={money(data.monthRevenue)} caption="Completed sales" />
          <StatCard icon={Wallet} tone="amber" label="Month profit" value={money(data.monthProfit)} caption="Estimated · sales less cost & expenses" />
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.9fr)]">
        <div className="min-w-0 space-y-4">
          <StockAlertsCard data={data} />
          {!isTracking && <DashboardCharts data={data} />}
          {!isTracking && <HourlyHeatStrip data={data.hourly} />}
          {!isTracking && <TopTabsAndOrders data={data} />}
          {isTracking && <TrackedOrdersCard data={data} />}
          {!isTracking && <BestSellersCard data={data} />}
        </div>
        <DashboardRail now={now} />
      </div>
    </div>
  )
}

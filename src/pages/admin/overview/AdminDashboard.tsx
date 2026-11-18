import { useEffect, useMemo, useState } from 'react'
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
import ShiftAlertsCard from './ShiftAlertsCard'
import { backupHealthIsStale, printerOfflineAlertDue } from '../../../lib/automation'
import { Link } from 'react-router-dom'
import { modeFeatures } from '../../../lib/posMode'
import { QuickModeDashboard } from './QuickModeDashboard'
import { ApplicationUpdatesCard } from '../../../components/ApplicationUpdatesCard'

function trend(current: number, previous: number) {
  const value = percentChange(current, previous)
  return value === null ? undefined : { value: `${Math.abs(value).toFixed(1)}%`, positive: value >= 0 }
}

export default function AdminDashboard() {
  const { db, store, user, providerMode, providerStatus } = useApp()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const data = useMemo(() => store ? getAdminDashboardData({ db, store, now }) : null, [db, now, store])
  if (!store || !user || !data) return null
  const isTracking = data.isTrackingMode
  const features = modeFeatures(store)
  const quick = !features.payments
  const todayCount = data.todayOrders.length
  const ordersMetric = todayCount
  const backupNeedsAttention = user.role === 'admin' && providerMode === 'hub' &&
    store.settings.automation.backupHealthAlerts &&
    backupHealthIsStale(providerStatus.lastBackupAt, now)
  const backupHealthError = user.role === 'admin' && providerMode === 'hub' &&
    store.settings.automation.backupHealthAlerts
    ? providerStatus.backupHealthError
    : undefined
  const offlinePrinters = user.role === 'admin' && providerMode === 'hub' &&
    store.settings.automation.printerOfflineAlerts
    ? db.printers.filter((printer) => printer.storeId === store.id && printer.enabled &&
      printerOfflineAlertDue(
        providerStatus.printerOfflineSince[printer.id],
        store.settings.automation.printerOfflineAlertMinutes,
        now,
      ))
    : []
  const activeTeamShifts = db.registerSessions.filter((session) => {
    if (session.storeId !== store.id || session.status !== 'open') return false
    const ownerId = session.staffId ?? session.openedById
    const owner = db.users.find((candidate) => candidate.id === ownerId && candidate.storeId === store.id)
    return owner?.role !== 'admin'
  })

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminHeader
        store={store}
        user={user}
        registerOpen={user.role === 'admin' ? activeTeamShifts.length > 0 : !!data.registerSession}
        ownerMode={user.role === 'admin'}
        now={now}
      />
      {(backupNeedsAttention || backupHealthError || offlinePrinters.length > 0) && (
        <div className="space-y-2" aria-live="polite">
          {backupNeedsAttention && (
            <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Hub backup health needs attention: the latest backup is missing or older than 48 hours.
              <Link to="/admin/settings?tab=data" className="ml-2 font-bold underline">Check data settings</Link>
            </div>
          )}
          {backupHealthError && (
            <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950">
              Hub backup health could not be checked: {backupHealthError}
            </div>
          )}
          {offlinePrinters.map((printer) => (
            <div key={printer.id} role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950">
              Printer alert: {printer.name} has been offline since {new Date(providerStatus.printerOfflineSince[printer.id]).toLocaleString()}.
              <Link to="/admin/settings?tab=devices" className="ml-2 font-bold underline">Check printer</Link>
            </div>
          ))}
        </div>
      )}
      {quick ? (
        <QuickModeDashboard data={data} db={db} store={store} user={user} now={now} />
      ) : isTracking ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <GradientKpiCard icon={ClipboardList} tone="blue" label="Tracked orders" value={data.trackedOrders} caption="Recorded without payment" />
          <GradientKpiCard icon={PackageCheck} tone="amber" label="Items sold" value={data.itemsSold} caption="Tracked quantity today" />
          <GradientKpiCard icon={ReceiptText} tone="purple" label="Open orders" value={data.openOrders} caption="Pending tickets, if enabled" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <GradientKpiCard icon={Banknote} tone="green" label="Revenue today" value={money(data.todayRevenue)} caption={data.yesterdayRevenue ? 'Compared with yesterday' : 'No previous-day comparison'} trend={trend(data.todayRevenue, data.yesterdayRevenue)} sparkline={data.hourly.map((hour) => hour.revenue)} />
          <GradientKpiCard icon={ReceiptText} tone="blue" label="Orders today" value={todayCount} caption={`${data.yesterdayOrders.length} yesterday`} trend={trend(ordersMetric, data.yesterdayOrders.length)} sparkline={data.hourly.map((hour) => data.todayOrders.filter((order) => new Date(order.createdAt).getHours() === hour.hour).length)} />
          <GradientKpiCard icon={PackageCheck} tone="amber" label="Open orders" value={data.openOrders} caption="No open-order state is stored" />
          <GradientKpiCard icon={CreditCard} tone="rose" label="Unpaid tabs" value={money(data.outstanding)} caption={`${data.debtorCount} customers with a balance`} />
        </div>
      )}

      {!quick && !isTracking && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard icon={TrendingUp} tone="blue" label="Average ticket" value={money(data.averageTicket)} caption="Today's completed sales" />
          <StatCard icon={ShoppingBasket} tone="purple" label="Items sold" value={data.itemsSold} caption="Today" />
          <StatCard icon={Banknote} tone="green" label="Month revenue" value={money(data.monthRevenue)} caption="Completed sales" />
          <StatCard icon={Wallet} tone="amber" label="Month profit" value={money(data.monthProfit)} caption="Estimated · sales less cost & expenses" />
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.9fr)]">
        <div className="min-w-0 space-y-4">
          {features.inventory && <StockAlertsCard data={data} enabled={store.settings.automation.lowStockAlerts} />}
          <ShiftAlertsCard db={db} store={store} now={now} />
          {!quick && !isTracking && <DashboardCharts data={data} />}
          {!quick && !isTracking && <HourlyHeatStrip data={data.hourly} />}
          {!quick && !isTracking && <TopTabsAndOrders data={data} />}
          {!quick && isTracking && <TrackedOrdersCard data={data} />}
          {!quick && !isTracking && <BestSellersCard data={data} />}
        </div>
        <DashboardRail now={now} />
      </div>
      <ApplicationUpdatesCard />
    </div>
  )
}

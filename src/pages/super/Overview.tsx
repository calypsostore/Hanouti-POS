import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Building2,
  Download,
  Plus,
  ShieldAlert,
  Store as StoreIcon,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApp } from '../../store/AppStore'
import { useToast } from '../../components/toast'
import { Badge, Card } from '../../components/ui'
import { DataTable, type DataTableColumn } from '../../components/dashboard/DataTable'
import { EmptyState } from '../../components/dashboard/EmptyState'
import { GradientKpiCard } from '../../components/dashboard/GradientKpiCard'
import { QuickActionTile } from '../../components/dashboard/QuickActionTile'
import { SectionCard } from '../../components/dashboard/SectionCard'
import { ChartLegend, ChartTooltip, axisProps } from '../../components/charts'
import { getSuperDashboardData } from '../../lib/dashboard'
import { csvDownload, fmtDate } from '../../lib/utils'
import type { Store, StoreStatus } from '../../types'
import { AppIcon } from '../../components/AppIcon'
import { SEMANTIC_COLORS } from '../../lib/semanticColors'
import { ApplicationUpdatesCard } from '../../components/ApplicationUpdatesCard'

const statusTone: Record<StoreStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  trial: 'warning',
  suspended: 'danger',
}

export default function SuperOverview() {
  const { db, user, setStoreStatus } = useApp()
  const { push } = useToast()
  const [now] = useState(() => new Date())
  const data = useMemo(() => getSuperDashboardData(db, now), [db, now])
  if (!user) return null

  const exportStores = () => {
    csvDownload('7anouti-stores.csv', [
      ['Store', 'Code', 'Business type', 'Plan', 'Status', 'City', 'Created'],
      ...data.recentStores.map((store) => [store.name, store.slug, store.businessType, store.plan, store.status, store.city, fmtDate(store.createdAt)]),
    ])
    push('Store list exported', 'success')
  }
  const toggleStore = (store: Store) => {
    const status: StoreStatus = store.status === 'suspended' ? 'active' : 'suspended'
    const result = setStoreStatus(store.id, status)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`${store.name} ${status === 'suspended' ? 'suspended' : 'reactivated'}`, 'success')
  }

  const columns: DataTableColumn<Store>[] = [
    { key: 'store', header: 'Store', render: (store) => (
      <div className="flex items-center gap-2.5">
        {store.logo
          ? <img src={store.logo} alt="" className="h-9 w-9 rounded-xl object-cover" />
          : <AppIcon name={store.icon} color={store.iconColor} size={17} className="h-9 w-9 rounded-xl" />}
        <span className="min-w-0">
          <span className="block truncate font-bold text-ink">{store.name}</span>
          <span className="block text-[10px] capitalize text-muted">{store.businessType} · {store.city || 'Location not set'}</span>
        </span>
      </div>
    ) },
    { key: 'plan', header: 'Plan', render: (store) => <Badge tone="neutral" className="capitalize">{store.plan}</Badge> },
    { key: 'status', header: 'Status', render: (store) => <Badge tone={statusTone[store.status]} className="capitalize">{store.status}</Badge> },
    { key: 'created', header: 'Created', render: (store) => <span className="whitespace-nowrap text-muted">{fmtDate(store.createdAt)}</span> },
    { key: 'action', header: 'Action', className: 'text-right', render: (store) => (
      <button type="button" onClick={() => toggleStore(store)} className="rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-bold text-ink hover:bg-cream-100 focus-visible:ring-2 focus-visible:ring-brand-amber-focus">
        {store.status === 'suspended' ? 'Reactivate' : 'Suspend'}
      </button>
    ) },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight">Platform overview</h2>
          <p className="mt-1 text-[12px] text-muted">{fmtDate(now.toISOString())} · Manage stores and platform activity.</p>
        </div>
        <Badge tone="dark"><ShieldAlert className="h-3 w-3" /> Super admin</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <GradientKpiCard icon={Building2} tone="blue" label="Total stores" value={data.total} caption="All registered stores" />
        <GradientKpiCard icon={UserCheck} tone="green" label="Active" value={data.active} caption="Operating stores" />
        <GradientKpiCard icon={Activity} tone="amber" label="Trial" value={data.trial} caption="In trial period" />
        <GradientKpiCard icon={ShieldAlert} tone="rose" label="Suspended" value={data.suspended} caption="Access paused" />
        <GradientKpiCard icon={Users} tone="purple" label="New this month" value={data.newThisMonth} caption="Store signups" sparkline={data.signupTrend.map((month) => month.signups)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard icon={StoreIcon} tone="blue" title="Stores by business type" subtitle="Current portfolio" bodyClassName="px-3 pb-4 sm:px-4">
          {data.businessTypes.length === 0 ? <EmptyState icon={StoreIcon} title="No stores yet" description="New stores will appear in this breakdown." /> : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.businessTypes} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={SEMANTIC_COLORS.trends.flat.light.border} horizontal={false} />
                  <XAxis type="number" {...axisProps} allowDecimals={false} />
                  <YAxis type="category" dataKey="type" {...axisProps} width={90} tickFormatter={(value) => String(value)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Stores" fill={SEMANTIC_COLORS.trends.flat.light.solid} radius={[0, 7, 7, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.businessTypes.length > 0 && <ChartLegend items={[{ label: 'Stores', color: SEMANTIC_COLORS.trends.flat.light.solid }]} />}
        </SectionCard>
        <SectionCard icon={Activity} tone="purple" title="Signup trend" subtitle="New stores · last six months" bodyClassName="px-3 pb-4 sm:px-4">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.signupTrend} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <defs><linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SEMANTIC_COLORS.moneyFlow.revenue.light.solid} stopOpacity={0.28} /><stop offset="100%" stopColor={SEMANTIC_COLORS.moneyFlow.revenue.light.solid} stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={SEMANTIC_COLORS.trends.flat.light.border} vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="signups" name="Stores" stroke={SEMANTIC_COLORS.moneyFlow.revenue.light.solid} strokeWidth={2.2} fill="url(#signupFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
            <ChartLegend items={[{ label: 'New stores', color: SEMANTIC_COLORS.moneyFlow.revenue.light.solid }]} />
        </SectionCard>
      </div>

      <SectionCard icon={StoreIcon} tone="teal" title="Recent stores" subtitle="Latest signups with account actions" action={<Link to="/super/stores" className="text-[11px] font-bold text-accent-foreground hover:underline">Manage all</Link>} bodyClassName="pb-2">
        <DataTable columns={columns} rows={data.recentStores} rowKey={(store) => store.id} empty={<EmptyState icon={StoreIcon} title="No stores yet" description="Create the first store to get started." action={{ label: 'Create store', href: '/super/stores' }} />} />
      </SectionCard>

      <SectionCard icon={Plus} tone="amber" title="Quick actions" subtitle="Platform administration" bodyClassName="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-5">
        <QuickActionTile icon={Plus} tone="amber" label="Create store" href="/super/stores" />
        <QuickActionTile icon={StoreIcon} tone="blue" label="Manage stores" href="/super/stores" />
        <QuickActionTile icon={Download} tone="green" label="Export stores" onClick={exportStores} />
      </SectionCard>
      <Card className="px-4 py-3 text-[11px] text-muted dark:bg-espresso-800">
        Store status changes update the local demo database. A server-backed platform is required for production controls.
      </Card>
      <ApplicationUpdatesCard />
    </div>
  )
}

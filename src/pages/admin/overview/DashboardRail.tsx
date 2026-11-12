import { BarChart3, CreditCard, Package, Plus, ReceiptText, UserPlus, Wallet } from 'lucide-react'
import { useApp } from '../../../store/AppStore'
import { useToast } from '../../../components/toast'
import { SectionCard } from '../../../components/dashboard/SectionCard'
import { QuickActionTile } from '../../../components/dashboard/QuickActionTile'
import { InfoCard } from '../../../components/dashboard/InfoCard'
import { PlanCard } from '../../../components/dashboard/PlanCard'
import { RegisterCard } from './RegisterCard'
import { ActivityCard } from './ActivityCard'

export function DashboardRail({ now }: { now: Date }) {
  const { db, store, user } = useApp()
  const { push } = useToast()
  if (!store || !user) return null
  const trackingMode = 'usageMode' in store.settings && store.settings.usageMode === 'tracking'
  const canRegister = !trackingMode && store.settings.posMode === 'cashier'
  const registerOpen = db.registerSessions.some((session) => session.storeId === store.id && session.status === 'open')
  return (
    <aside className="space-y-4">
      <InfoCard user={user} store={store} profileHref="/admin/settings" />
      <PlanCard
        store={store}
        now={now}
        onUpgrade={() => push('Plan changes are managed by the platform owner in this demo.', 'info')}
      />
      {canRegister && <RegisterCard db={db} store={store} now={now} />}
      <SectionCard icon={Plus} tone="amber" title="Quick actions" subtitle="Shortcuts for your workspace" bodyClassName="grid grid-cols-2 gap-2 px-4 pb-4 sm:px-5">
        <QuickActionTile icon={Plus} tone="amber" label="New sale" href="/pos" />
        <QuickActionTile icon={Package} tone="blue" label="Add product" href="/admin/products" />
        {!trackingMode && <QuickActionTile icon={Wallet} tone="rose" label="Add expense" href="/admin/expenses" />}
        {!trackingMode && <QuickActionTile icon={CreditCard} tone="teal" label="Collect tab" href="/admin/customers" />}
        <QuickActionTile icon={UserPlus} tone="purple" label="Add staff" href="/admin/staff" />
        {canRegister && <QuickActionTile icon={ReceiptText} tone="green" label={registerOpen ? 'Manage register' : 'Open register'} href="/admin/register" />}
        <QuickActionTile icon={BarChart3} tone="blue" label="Reports" href="/admin/reports" />
        <QuickActionTile icon={ReceiptText} tone="purple" label="Export data" href="/admin/reports" />
      </SectionCard>
      <ActivityCard />
    </aside>
  )
}

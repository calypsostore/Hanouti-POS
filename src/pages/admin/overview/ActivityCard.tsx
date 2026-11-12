import { Activity, AlertTriangle } from 'lucide-react'
import { relative } from '../../../lib/utils'
import { getDashboardActivity } from '../../../lib/dashboard'
import { useApp } from '../../../store/AppStore'
import { SectionCard } from '../../../components/dashboard/SectionCard'

export function ActivityCard() {
  const { db, store } = useApp()
  if (!store) return null
  const events = getDashboardActivity(db, store.id, store.settings.lowStockThreshold)
  return (
    <SectionCard icon={Activity} tone="purple" title="Latest activity" subtitle="Recent changes and active notices" bodyClassName="px-4 pb-4 sm:px-5">
      {events.length === 0 ? <p className="py-4 text-center text-xs text-muted">No recent activity to show.</p> : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-navy">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-bold">{event.title}</div>
                <div className="truncate text-[10px] text-muted">{event.detail}</div>
              </div>
              <span className="shrink-0 text-[9px] text-muted">{event.at ? relative(event.at) : 'Active'}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

import { Activity, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { relative } from '../../../lib/utils'
import { getDashboardActivity } from '../../../lib/dashboard'
import { useApp } from '../../../store/AppStore'
import { SectionCard } from '../../../components/dashboard/SectionCard'

export function ActivityCard() {
  const { db, store } = useApp()
  if (!store) return null
  const logged = db.auditLogs
    .filter((entry) => entry.storeId === store.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((entry) => ({
      id: entry.id,
      title: entry.summary,
      detail: entry.userName,
      at: entry.createdAt,
      isNotice: false,
    }))
  const notices = getDashboardActivity(db, store.id, store.settings.lowStockThreshold)
    .filter((event) => event.id.startsWith('stock-'))
    .map((event) => ({ ...event, isNotice: true }))
  const events = [...logged, ...notices]
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
    .slice(0, 6)
  return (
    <SectionCard icon={Activity} tone="purple" title="Latest activity" subtitle="Recent changes and active notices" bodyClassName="px-4 pb-4 sm:px-5">
      {events.length === 0 ? <p className="py-4 text-center text-xs text-muted">No recent activity to show.</p> : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-accent-foreground">
                {event.isNotice ? <AlertTriangle className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
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
      <Link to="/admin/logs" className="mt-4 inline-flex text-[11px] font-semibold text-accent-foreground hover:underline">
        View activity log
      </Link>
    </SectionCard>
  )
}

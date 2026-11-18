import { Link } from 'react-router-dom'
import { ArrowUpRight, CircleDollarSign, Clock3, DoorClosed, DoorOpen } from 'lucide-react'
import type { Database, Store, User } from '../../../types'
import { sessionSnapshot } from '../../../lib/reports'
import { fmtDateTime, money } from '../../../lib/utils'
import { Badge } from '../../../components/ui'
import { SectionCard } from '../../../components/dashboard/SectionCard'

export function RegisterCard({ db, store, user, now }: {
  db: Database
  store: Store
  user: User
  now: Date
}) {
  const allOpen = db.registerSessions
    .filter((item) => item.storeId === store.id && item.status === 'open')
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  const activeSessions = user.role === 'admin'
    ? allOpen.filter((session) => {
        const ownerId = session.staffId ?? session.openedById
        const owner = db.users.find((candidate) =>
          candidate.id === ownerId && candidate.storeId === store.id,
        )
        return owner?.role !== 'admin'
      })
    : allOpen
  const session = activeSessions[0]
  const snapshot = session && user.role !== 'admin'
    ? sessionSnapshot(db, session, now.toISOString())
    : null
  const hasOpen = activeSessions.length > 0
  const subtitle = user.role === 'admin'
    ? hasOpen ? `${activeSessions.length} staff shift${activeSessions.length === 1 ? '' : 's'} active` : 'No staff shifts are open'
    : session ? `Opened by ${session.openedByName}` : 'Ready for today'
  return (
    <SectionCard icon={CircleDollarSign} tone={hasOpen ? 'green' : 'amber'} title="Register" subtitle={subtitle} bodyClassName="px-4 pb-4 sm:px-5">
      <div className="flex items-center justify-between">
        <Badge tone={hasOpen ? 'success' : user.role === 'admin' ? 'neutral' : 'warning'}>
          {hasOpen ? <DoorOpen className="h-3 w-3" /> : <DoorClosed className="h-3 w-3" />}
          {user.role === 'admin'
            ? hasOpen ? 'Staff active' : 'No staff shift'
            : hasOpen ? 'Open' : 'Closed'}
        </Badge>
        <Link to="/admin/register" className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-foreground hover:underline">
          {user.role === 'admin' ? 'View shifts & Z' : session ? 'Manage' : 'Open register'}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      {user.role === 'admin' ? (
        activeSessions.length ? (
          <div className="mt-3 divide-y divide-line/60">
            {activeSessions.slice(0, 4).map((active) => (
              <div key={active.id} className="flex items-center gap-2 py-2 text-[11px]">
                <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate font-semibold">{active.openedByName}</span>
                <span className="shrink-0 text-muted">{fmtDateTime(active.openedAt)}</span>
              </div>
            ))}
            {activeSessions.length > 4 && (
              <p className="pt-2 text-[10px] text-muted">And {activeSessions.length - 4} more open shifts</p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Owner POS is available without opening a personal shift.
          </p>
        )
      ) : session && snapshot && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-cream-100 p-2.5 dark:bg-espresso-900">
            <div className="text-[9px] font-bold uppercase text-muted">Opening cash</div>
            <div className="mt-1 text-[13px] font-extrabold tabular">{money(session.openingCash)}</div>
          </div>
          <div className="rounded-xl bg-brand-tint p-2.5 text-accent-foreground">
            <div className="text-[9px] font-bold uppercase text-muted">Expected cash</div>
            <div className="mt-1 text-[13px] font-extrabold text-accent-foreground tabular">{money(snapshot.expectedCash)}</div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

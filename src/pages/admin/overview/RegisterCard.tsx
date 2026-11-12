import { Link } from 'react-router-dom'
import { ArrowUpRight, CircleDollarSign, DoorClosed, DoorOpen } from 'lucide-react'
import type { Database, Store } from '../../../types'
import { sessionSnapshot } from '../../../lib/reports'
import { money } from '../../../lib/utils'
import { Badge } from '../../../components/ui'
import { SectionCard } from '../../../components/dashboard/SectionCard'

export function RegisterCard({ db, store, now }: { db: Database; store: Store; now: Date }) {
  if (store.settings.posMode !== 'cashier') return null
  const session = db.registerSessions.find((item) => item.storeId === store.id && item.status === 'open')
  const snapshot = session ? sessionSnapshot(db, session, now.toISOString()) : null
  return (
    <SectionCard icon={CircleDollarSign} tone={session ? 'green' : 'amber'} title="Register" subtitle={session ? `Opened by ${session.openedByName}` : 'Ready for today'} bodyClassName="px-4 pb-4 sm:px-5">
      <div className="flex items-center justify-between">
        <Badge tone={session ? 'success' : 'warning'}>
          {session ? <DoorOpen className="h-3 w-3" /> : <DoorClosed className="h-3 w-3" />}
          {session ? 'Open' : 'Closed'}
        </Badge>
        <Link to="/admin/register" className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-foreground hover:underline">
          {session ? 'Manage' : 'Open register'} <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      {session && snapshot && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-cream-100 p-2.5 dark:bg-espresso-900">
            <div className="text-[9px] font-bold uppercase text-muted">Opening cash</div>
            <div className="mt-1 text-[13px] font-extrabold tabular">{money(session.openingCash)}</div>
          </div>
          <div className="rounded-xl bg-brand-tint p-2.5">
            <div className="text-[9px] font-bold uppercase text-muted">Expected cash</div>
            <div className="mt-1 text-[13px] font-extrabold text-brand-navy tabular">{money(snapshot.expectedCash)}</div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

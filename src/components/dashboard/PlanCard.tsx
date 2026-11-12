import { CalendarDays, CreditCard } from 'lucide-react'
import type { Store } from '../../types'
import { PLAN_INFO } from '../../data/seed'
import { Badge, Button } from '../ui'
import { fmtDate } from '../../lib/utils'

export function PlanCard({ store, now, onUpgrade }: { store: Store; now: Date; onUpgrade?: () => void }) {
  const daysRemaining = store.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(store.trialEndsAt).getTime() - now.getTime()) / 86_400_000))
    : null
  const tone = store.status === 'active' ? 'success' : store.status === 'trial' ? 'warning' : 'danger'
  return (
    <article className="rounded-2xl border border-line bg-white p-4 shadow-sm dark:bg-espresso-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-navy">
              <CreditCard className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Current plan</div>
              <div className="text-[14px] font-extrabold capitalize text-ink">{PLAN_INFO[store.plan].label}</div>
            </div>
          </div>
        </div>
        <Badge tone={tone}>{store.status}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
        <CalendarDays className="h-3.5 w-3.5" />
        {store.status === 'trial'
          ? daysRemaining === null
            ? 'Trial end date not set'
            : `${daysRemaining} days left · ends ${fmtDate(store.trialEndsAt ?? '')}`
          : `Store created ${fmtDate(store.createdAt)}`}
      </div>
      {onUpgrade && (
        <Button className="mt-3 w-full" size="sm" onClick={onUpgrade}>Upgrade / Renew</Button>
      )}
    </article>
  )
}

import { CalendarDays, Clock3 } from 'lucide-react'
import type { Store, User } from '../../../types'
import { Badge } from '../../../components/ui'
import { fmtDate } from '../../../lib/utils'
import { AppIcon } from '../../../components/AppIcon'

export function AdminHeader({ store, user, registerOpen, now }: {
  store: Store
  user: User
  registerOpen: boolean
  now: Date
}) {
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm dark:bg-espresso-800 sm:p-5">
      <div className="min-w-0">
        <h2 className="text-[20px] font-extrabold tracking-tight text-ink sm:text-[23px]">{greeting}, {user.name.split(' ')[0]}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1 font-semibold text-accent-foreground">
            <AppIcon name={store.icon} color={store.iconColor} size={14} className="h-6 w-6 rounded-lg" /> {store.name}
          </span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Today · {fmtDate(now.toISOString())}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={store.settings.posMode === 'quick' ? 'info' : 'accent'}>
          {store.settings.posMode === 'quick' ? 'Quick sale' : 'Full cashier'}
        </Badge>
        {store.settings.posMode === 'cashier' && (
          <Badge tone={registerOpen ? 'success' : 'warning'}>
            <Clock3 className="h-3 w-3" /> Register {registerOpen ? 'open' : 'closed'}
          </Badge>
        )}
      </div>
    </div>
  )
}

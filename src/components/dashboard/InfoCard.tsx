import { Clock3, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Store, User } from '../../types'
import { Avatar, Badge } from '../ui'
import { IconChip } from './IconChip'

export function InfoCard({ user, store, profileHref }: { user: User; store: Store; profileHref: string }) {
  return (
    <article className="glass rounded-3xl p-4">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-ink">{user.name}</div>
          <Badge tone={user.role === 'admin' ? 'accent' : 'info'} className="mt-1 capitalize">{user.role}</Badge>
        </div>
        <IconChip icon={UserRound} tone="purple" className="h-9 w-9" />
      </div>
      <div className="mt-4 space-y-2 border-t border-line pt-3 text-[11.5px]">
        <div className="flex items-center gap-2 text-muted">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-tint text-accent-foreground">
            <UserRound className="h-3.5 w-3.5" />
          </span>
          <span className="truncate font-medium text-ink">{store.name}</span>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream-100 text-muted">
            <Clock3 className="h-3.5 w-3.5" />
          </span>
          <span>Last login · not tracked</span>
        </div>
      </div>
      <Link to={profileHref} className="mt-3 inline-flex text-[11.5px] font-bold text-accent-foreground hover:underline">
        Update profile
      </Link>
    </article>
  )
}

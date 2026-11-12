import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { SOFT_TONE, type DashboardTone } from '../../lib/palette'

export function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  caption,
}: {
  icon: LucideIcon
  tone: DashboardTone
  label: string
  value: string | number
  caption: string
}) {
  return (
    <article className={cn('rounded-2xl border border-line bg-white p-4 shadow-sm dark:bg-espresso-800', 'border-t-[3px]', {
      'border-t-emerald-500': tone === 'green',
      'border-t-blue-500': tone === 'blue',
      'border-t-brand-amber': tone === 'amber',
      'border-t-rose-500': tone === 'rose',
      'border-t-violet-500': tone === 'purple',
      'border-t-teal-500': tone === 'teal',
    })}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted">{label}</div>
          <div className="mt-1.5 truncate text-[19px] font-extrabold tracking-tight text-ink tabular">{value}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted">{caption}</div>
        </div>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', SOFT_TONE[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </article>
  )
}

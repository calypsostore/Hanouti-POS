import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { SOFT_TONE, type DashboardTone } from '../../lib/palette'

export function AlertPill({
  icon: Icon,
  tone,
  label,
  count,
}: {
  icon: LucideIcon
  tone: DashboardTone
  label: string
  count: number
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold', SOFT_TONE[tone])}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
      <span className="rounded-full bg-black/10 px-1.5 py-0.5 tabular">{count}</span>
    </span>
  )
}

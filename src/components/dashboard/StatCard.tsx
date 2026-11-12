import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { SOFT_TONE, type DashboardTone } from '../../lib/palette'
import { SEMANTIC_COLORS } from '../../lib/semanticColors'

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
  const toneName = tone === 'purple' ? 'violet' : tone
  const colors = SEMANTIC_COLORS.icons[toneName]
  return (
    <article className={cn('glass rounded-3xl p-4', `glass-tint-${toneName}`)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted">{label}</div>
          <div className="mt-1.5 truncate text-[19px] font-extrabold tracking-tight text-ink tabular">{value}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted">{caption}</div>
        </div>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', SOFT_TONE[tone])} style={{ color: colors.light.solid, border: `1px solid ${colors.light.border}` }}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </article>
  )
}

import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { DASHBOARD_PALETTE, type DashboardTone } from '../../lib/palette'

export function GradientKpiCard({
  icon: Icon,
  tone,
  label,
  value,
  caption,
  trend,
}: {
  icon: LucideIcon
  tone: DashboardTone
  label: string
  value: string | number
  caption: string
  trend?: { value: string; positive: boolean }
}) {
  const palette = DASHBOARD_PALETTE[tone]
  return (
    <article className={cn('relative isolate overflow-hidden rounded-2xl bg-gradient-to-br p-4 shadow-sm sm:p-5', palette.gradient, palette.text)}>
      <span className="pointer-events-none absolute -right-7 -top-8 -z-10 h-28 w-28 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-12 right-10 -z-10 h-24 w-24 rounded-full bg-black/[0.05]" />
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', palette.icon)}>
          <Icon className={cn('h-5 w-5', palette.iconColor)} aria-hidden="true" />
        </div>
        {trend && (
          <span className="rounded-full bg-black/10 px-2 py-1 text-[10px] font-bold">
            {trend.positive ? '+' : ''}{trend.value}
          </span>
        )}
      </div>
      <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">{label}</div>
      <div className="mt-1 truncate text-[22px] font-extrabold tracking-tight tabular sm:text-[25px]">{value}</div>
      <div className="mt-1 truncate text-[11px] opacity-80">{caption}</div>
    </article>
  )
}

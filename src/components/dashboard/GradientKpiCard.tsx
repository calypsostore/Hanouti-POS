import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { DASHBOARD_PALETTE, type DashboardTone } from '../../lib/palette'
import { SEMANTIC_COLORS } from '../../lib/semanticColors'

export function GradientKpiCard({
  icon: Icon,
  tone,
  label,
  value,
  caption,
  trend,
  sparkline,
}: {
  icon: LucideIcon
  tone: DashboardTone
  label: string
  value: string | number
  caption: string
  trend?: { value: string; positive: boolean }
  sparkline?: number[]
}) {
  const [animatedValue, setAnimatedValue] = useState(() =>
    typeof value === 'number' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : value,
  )
  useEffect(() => {
    if (typeof value !== 'number' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const started = performance.now()
    let frame = 0
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / 650)
      setAnimatedValue(Math.round(value * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [value])
  const palette = DASHBOARD_PALETTE[tone]
  const toneName = tone === 'purple' ? 'violet' : tone
  const color = SEMANTIC_COLORS.icons[toneName]
  return (
    <article className={cn('glass relative isolate overflow-hidden rounded-3xl p-4 text-ink sm:p-5', palette.gradient, palette.text)}>
      <span className="pointer-events-none absolute -right-7 -top-8 -z-10 h-28 w-28 rounded-full opacity-30" style={{ background: color.light.softBackground }} />
      <span className="pointer-events-none absolute -bottom-12 right-10 -z-10 h-24 w-24 rounded-full opacity-20" style={{ background: color.light.solid }} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm" style={{
          color: color.light.solid,
          background: color.light.softBackground,
          border: `1px solid ${color.light.border}`,
        }}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        {trend && (
          <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{
            color: trend.positive ? SEMANTIC_COLORS.trends.up.light.text : SEMANTIC_COLORS.trends.down.light.text,
            background: trend.positive ? SEMANTIC_COLORS.trends.up.light.softBackground : SEMANTIC_COLORS.trends.down.light.softBackground,
          }}>
            {trend.positive ? '+' : ''}{trend.value}
          </span>
        )}
      </div>
      <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">{label}</div>
      <div className="kpi-value mt-1 truncate text-[22px] font-extrabold tracking-tight tabular sm:text-[25px]">{animatedValue}</div>
      <div className="mt-1 truncate text-[11px] opacity-80">{caption}</div>
      {sparkline && sparkline.length > 1 && (
        <Sparkline values={sparkline} color={color.light.solid} />
      )}
    </article>
  )
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values)
  const points = values.map((value, index) =>
    `${(index / (values.length - 1)) * 72},${18 - (value / max) * 16}`,
  ).join(' ')
  return (
    <svg aria-hidden="true" viewBox="0 0 72 20" className="pointer-events-none absolute bottom-3 right-3 h-5 w-[72px] opacity-45">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

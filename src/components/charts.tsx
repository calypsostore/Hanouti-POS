import { SEMANTIC_COLORS } from '../lib/semanticColors'

type TooltipPayload = Array<{ name?: string; value?: number | string; color?: string; dataKey?: string }>

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: TooltipPayload
  label?: string | number
  formatter?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip px-3 py-2">
      {label !== undefined && (
        <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[12px]">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color ?? SEMANTIC_COLORS.trends.flat.light.solid }}
          />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto font-bold text-ink tabular">
            {formatter && typeof p.value === 'number' ? formatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export const axisProps = {
  tick: { fill: SEMANTIC_COLORS.trends.flat.light.text, fontSize: 10.5 },
  axisLine: false,
  tickLine: false,
} as const

export function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-muted">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

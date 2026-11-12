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
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-lg shadow-espresso-900/5">
      {label !== undefined && (
        <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[12px]">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color ?? 'var(--color-brand-amber)' }}
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
  tick: { fill: 'var(--color-muted)', fontSize: 10.5 },
  axisLine: false,
  tickLine: false,
} as const

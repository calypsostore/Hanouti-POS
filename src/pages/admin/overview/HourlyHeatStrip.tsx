import { Clock3 } from 'lucide-react'
import type { AdminDashboardData } from '../../../lib/dashboard'
import { SectionCard } from '../../../components/dashboard/SectionCard'
import { money } from '../../../lib/utils'
import { ChartLegend } from '../../../components/charts'
import { SEMANTIC_COLORS } from '../../../lib/semanticColors'

export function HourlyHeatStrip({ data }: { data: AdminDashboardData['hourly'] }) {
  const max = Math.max(0, ...data.map((item) => item.revenue))
  if (!max) return null
  return (
    <SectionCard icon={Clock3} tone="purple" title="Hourly sales" subtitle="Today · darker cells indicate busier hours" bodyClassName="px-4 pb-4 sm:px-5">
      <div className="grid grid-cols-12 gap-1 sm:grid-cols-[repeat(24,minmax(0,1fr))]">
        {data.map((item) => {
          const ratio = item.revenue / max
          const shade = ratio === 0 ? 'bg-cream-100 dark:bg-espresso-900' : ''
          const tint = ratio === 0
            ? undefined
            : ratio < 0.34
              ? SEMANTIC_COLORS.moneyFlow.revenue.light.softBackground
              : ratio < 0.67
                ? `color-mix(in srgb, ${SEMANTIC_COLORS.moneyFlow.revenue.light.solid} 55%, transparent)`
                : SEMANTIC_COLORS.moneyFlow.revenue.light.solid
          return (
            <div key={item.hour} title={`${String(item.hour).padStart(2, '0')}:00 · ${money(item.revenue)}`} className="group relative">
              <div className={`h-7 rounded-md ${shade}`} style={tint ? { background: tint } : undefined} />
              <span className="mt-1 block text-center text-[8px] text-muted">{item.hour % 3 === 0 ? String(item.hour).padStart(2, '0') : ''}</span>
            </div>
          )
        })}
      </div>
      <ChartLegend items={[
        { label: 'Quiet', color: SEMANTIC_COLORS.trends.flat.light.softBackground },
        { label: 'Steady', color: SEMANTIC_COLORS.moneyFlow.revenue.light.softBackground },
        { label: 'Peak', color: SEMANTIC_COLORS.moneyFlow.revenue.light.solid },
      ]} />
    </SectionCard>
  )
}

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '../../../components/ui'
import { ChartLegend, ChartTooltip, axisProps } from '../../../components/charts'
import { money } from '../../../lib/utils'
import { paymentColor, SEMANTIC_COLORS } from '../../../lib/semanticColors'
import type { Period } from './reportData'

export function ReportCharts({
  period,
  series,
  seriesTotal,
  sales,
  paymentMix,
  paymentTotal,
}: {
  period: Period
  series: Array<{ label: string; value: number; current?: boolean }>
  seriesTotal: number
  sales: number
  paymentMix: Array<{ name: string; value: number; count: number }>
  paymentTotal: number
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">Sales over time</h3>
            <p className="mt-0.5 text-[12px] capitalize text-muted">{period}</p>
          </div>
          <div className="text-right">
            <div className="text-[18px] font-extrabold tabular">{money(seriesTotal)}</div>
            <div className="text-[10.5px] text-muted">{series.filter((s) => s.value > 0).length} active periods</div>
          </div>
        </div>
        <div className="mt-4 h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SEMANTIC_COLORS.moneyFlow.revenue.light.solid} />
                  <stop offset="100%" stopColor={SEMANTIC_COLORS.moneyFlow.profit.light.solid} />
                </linearGradient>
                <linearGradient id="salesBarCurrentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SEMANTIC_COLORS.moneyFlow.profit.light.solid} />
                  <stop offset="100%" stopColor={SEMANTIC_COLORS.moneyFlow.revenue.light.solid} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={SEMANTIC_COLORS.trends.flat.light.border} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} width={54} />
              <Tooltip content={<ChartTooltip formatter={(v) => money(v)} />} cursor={{ fill: SEMANTIC_COLORS.trends.flat.light.softBackground }} />
              <Bar dataKey="value" name="Sales" fill="url(#salesBarGradient)" radius={[7, 7, 0, 0]} maxBarSize={34}>
                {series.map((point) => (
                  <Cell key={point.label} fill={point.current ? 'url(#salesBarCurrentGradient)' : 'url(#salesBarGradient)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartLegend items={[
          { label: 'Sales', color: SEMANTIC_COLORS.moneyFlow.revenue.light.solid },
          { label: 'Current period', color: SEMANTIC_COLORS.moneyFlow.profit.light.solid },
        ]} />
      </Card>

      <Card className="p-5">
        <h3 className="text-[15px] font-semibold tracking-tight">Payment methods</h3>
        <p className="mt-0.5 text-[12px] text-muted">Share of collected sales</p>
        {sales > 0 ? (
          <>
            <div className="relative mx-auto mt-1 h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMix.filter((p) => p.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {paymentMix
                      .filter((p) => p.value > 0)
                      .map((p) => <Cell key={p.name} fill={paymentColor(p.name)} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatter={(v) => money(v)} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Total</span>
                <span className="text-[15px] font-extrabold tabular">{money(sales)}</span>
              </div>
            </div>
            <div className="space-y-2">
              {paymentMix.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: paymentColor(p.name) }} />
                  <span className="capitalize text-muted">{p.name}</span>
                  <span className="ml-auto font-semibold tabular">{Math.round((p.value / paymentTotal) * 100)}%</span>
                  <span className="w-[74px] text-right text-[11px] text-muted tabular">{money(p.value)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-[12.5px] text-muted">
            No sales in this period.
          </div>
        )}
      </Card>
    </div>
  )
}

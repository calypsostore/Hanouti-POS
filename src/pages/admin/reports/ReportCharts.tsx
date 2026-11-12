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
import { ChartTooltip, axisProps } from '../../../components/charts'
import { money } from '../../../lib/utils'
import type { Period } from './reportData'

const methodColors: Record<string, string> = {
  cash: '#10b981',
  card: '#0ea5e9',
  credit: '#B4652F',
}

export function ReportCharts({
  period,
  series,
  seriesTotal,
  sales,
  paymentMix,
  paymentTotal,
}: {
  period: Period
  series: Array<{ label: string; value: number }>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#eee6d9" vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} width={54} />
              <Tooltip content={<ChartTooltip formatter={(v) => money(v)} />} cursor={{ fill: '#f6efe4' }} />
              <Bar dataKey="value" name="Sales" fill="#B4652F" radius={[5, 5, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
                      .map((p) => <Cell key={p.name} fill={methodColors[p.name]} />)}
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
                  <span className="h-2 w-2 rounded-full" style={{ background: methodColors[p.name] }} />
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

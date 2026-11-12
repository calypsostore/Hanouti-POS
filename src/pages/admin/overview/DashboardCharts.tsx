import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, ChartNoAxesCombined } from 'lucide-react'
import type { AdminDashboardData } from '../../../lib/dashboard'
import { money } from '../../../lib/utils'
import { ChartTooltip, axisProps } from '../../../components/charts'
import { SectionCard } from '../../../components/dashboard/SectionCard'

export function DashboardCharts({ data }: { data: AdminDashboardData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard icon={BarChart3} tone="blue" title="Sales vs expenses" subtitle="Last six months" bodyClassName="px-3 pb-4 sm:px-4">
        <div className="h-[230px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthly} margin={{ top: 8, right: 2, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-tint)" vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} width={52} />
              <Tooltip content={<ChartTooltip formatter={money} />} />
              <Bar dataKey="sales" name="Sales" fill="var(--color-brand-navy)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="var(--color-brand-amber)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      <SectionCard icon={ChartNoAxesCombined} tone="amber" title="Sales by category" subtitle="Current month" bodyClassName="px-3 pb-4 sm:px-4">
        {data.categories.length === 0 ? (
          <div className="flex h-[230px] items-center justify-center text-xs text-muted">No category sales this month.</div>
        ) : (
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categories} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-tint)" horizontal={false} />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="name" {...axisProps} width={88} />
                <Tooltip content={<ChartTooltip formatter={money} />} />
                <Bar dataKey="revenue" name="Sales" fill="var(--color-brand-amber)" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

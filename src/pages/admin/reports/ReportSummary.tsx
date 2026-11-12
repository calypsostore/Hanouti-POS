import { Banknote, Percent, TrendingUp, Wallet } from 'lucide-react'
import { Card } from '../../../components/ui'
import { cn, money } from '../../../lib/utils'

export function ReportSummary({
  sales,
  orderCount,
  avgTicket,
  expenses,
  categoryCount,
}: {
  sales: number
  orderCount: number
  avgTicket: number
  expenses: number
  categoryCount: number
}) {
  const profit = sales - expenses
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Gross sales" value={money(sales)} sub={`${orderCount} orders`} icon={<Banknote className="h-4 w-4" />} accent />
      <Kpi label="Average ticket" value={money(avgTicket)} sub="per order" icon={<TrendingUp className="h-4 w-4" />} />
      <Kpi label="Expenses" value={money(expenses)} sub={`${categoryCount} categories`} icon={<Wallet className="h-4 w-4" />} />
      <Kpi
        label="Net profit"
        value={money(profit)}
        sub="sales − expenses"
        icon={<Percent className="h-4 w-4" />}
        tone={profit >= 0 ? 'good' : 'bad'}
      />
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  icon,
  accent,
  tone,
}: {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  accent?: boolean
  tone?: 'good' | 'bad'
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{label}</span>
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            accent ? 'bg-accent-50 text-accent-foreground' : 'bg-cream-100 text-muted',
          )}
        >
          {icon}
        </span>
      </div>
      <div
        className={cn(
          'mt-2 text-[20px] font-extrabold tracking-tight tabular',
          tone === 'good'
            ? 'text-[var(--semantic-green-text)]'
            : tone === 'bad'
              ? 'text-[var(--semantic-red-text)]'
              : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted">{sub}</div>
    </Card>
  )
}

export function ReportLine({
  label,
  value,
  valueClass,
  strong,
}: {
  label: string
  value: string
  valueClass?: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn(strong ? 'text-[14px] font-extrabold' : 'font-semibold', 'tabular', valueClass)}>
        {value}
      </span>
    </div>
  )
}

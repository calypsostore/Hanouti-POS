import { AlertTriangle, Boxes, TrendingUp } from 'lucide-react'
import { Card } from '../../../components/ui'

export default function ProductsSummary({
  productCount,
  categoryCount,
  avgMargin,
  lowStock,
}: {
  productCount: number
  categoryCount: number
  avgMargin: number
  lowStock: number
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Products" value={String(productCount)} icon={<Boxes className="h-4 w-4" />} />
      <Tile label="Categories" value={String(categoryCount)} icon={<Boxes className="h-4 w-4" />} />
      <Tile label="Average margin" value={`${avgMargin.toFixed(0)}%`} icon={<TrendingUp className="h-4 w-4" />} />
      <Tile
        label="Low stock"
        value={String(lowStock)}
        icon={<AlertTriangle className="h-4 w-4" />}
        warn={lowStock > 0}
      />
    </div>
  )
}

function Tile({
  label,
  value,
  icon,
  warn,
}: {
  label: string
  value: string
  icon: React.ReactNode
  warn?: boolean
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          warn ? 'bg-brand-amber-soft text-accent-foreground' : 'bg-cream-100 text-muted'
        }`}
      >
        {icon}
      </div>
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="text-[16px] font-extrabold tracking-tight tabular">{value}</div>
      </div>
    </Card>
  )
}

import { Card } from '../../../components/ui'
import { cn } from '../../../lib/utils'

export function Tile({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent?: boolean
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          accent ? 'bg-accent-50 text-accent-foreground' : 'bg-cream-100 text-muted',
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="truncate text-[15px] font-extrabold tracking-tight tabular">{value}</div>
      </div>
    </Card>
  )
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  )
}

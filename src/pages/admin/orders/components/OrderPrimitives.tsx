import { Banknote, Clock3, CreditCard, Wallet } from 'lucide-react'
import type { Order } from '../../../../types'
import { Badge, Card } from '../../../../components/ui'

export function MiniStat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-100 text-muted">
        {icon}
      </div>
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="text-[16px] font-extrabold tracking-tight tabular">{value}</div>
      </div>
    </Card>
  )
}

export function PaymentBadge({ method }: { method: Order['paymentMethod'] }) {
  if (method === 'unpaid')
    return (
      <Badge tone="warning">
        <Clock3 className="h-3 w-3" /> Unpaid
      </Badge>
    )
  if (method === 'credit')
    return (
      <Badge tone="accent">
        <Wallet className="h-3 w-3" /> Tab
      </Badge>
    )
  if (method === 'card')
    return (
      <Badge tone="info">
        <CreditCard className="h-3 w-3" /> Card
      </Badge>
    )
  return (
    <Badge tone="success">
      <Banknote className="h-3 w-3" /> Cash
    </Badge>
  )
}

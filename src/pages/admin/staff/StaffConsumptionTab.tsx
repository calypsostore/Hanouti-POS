import type { Order } from '../../../types'
import { money, fmtDateTime } from '../../../lib/utils'
import { Card } from '../../../components/ui'

export default function StaffConsumptionTab({ orders }: { orders: Order[] }) {
  const uses = orders
    .filter((order) => order.staffConsumption && order.status === 'completed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const charged = uses.reduce((sum, order) => sum + order.total, 0)
  const retail = uses.reduce((sum, order) =>
    sum + order.items.reduce((lineSum, item) =>
      lineSum + (item.price + (item.modifiers ?? []).reduce((value, modifier) => value + modifier.priceDelta, 0)) * item.qty, 0,
    ), 0)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3"><div className="text-[11px] text-muted">Staff item orders</div><div className="mt-1 text-lg font-bold">{uses.length}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted">Retail value</div><div className="mt-1 text-lg font-bold">{money(retail)}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted">Charged</div><div className="mt-1 text-lg font-bold">{money(charged)}</div></Card>
      </div>
      {uses.length === 0 ? (
        <Card className="p-4 text-sm text-muted">No staff items recorded.</Card>
      ) : uses.map((order) => (
        <Card key={order.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-ink">Shift item order #{order.number || order.provisionalNumber || '—'}</div>
              <div className="mt-1 text-xs text-muted">{fmtDateTime(order.createdAt)} · {order.paymentMethod}</div>
            </div>
            <div className="text-right text-sm font-bold">{money(order.total)}<div className="text-[10px] font-normal text-muted">retail {money(order.items.reduce((sum, item) => sum + item.price * item.qty, 0))}</div></div>
          </div>
          <ul className="mt-3 space-y-1 border-t border-line pt-2 text-xs">
            {order.items.map((item, index) => (
              <li key={`${order.id}:${item.lineId ?? index}`} className="flex justify-between gap-3">
                <span>{item.qty} × {item.name}{item.variantName ? ` · ${item.variantName}` : ''}</span>
                <span className="shrink-0">{money(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          {order.discount > 0 && <div className="mt-2 text-right text-xs text-muted">Discount: {money(order.discount)}</div>}
        </Card>
      ))}
    </div>
  )
}

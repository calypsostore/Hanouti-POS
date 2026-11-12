import { Printer, ShieldAlert, Trash2, UserRound } from 'lucide-react'
import type { Order, Store } from '../../../../types'
import { Badge, Button, Drawer } from '../../../../components/ui'
import { ReceiptView } from '../../../../components/ReceiptView'
import { fmtDate, fmtTime, money } from '../../../../lib/utils'
import { round } from '../../../../lib/pricing-utils'
import { PaymentBadge } from './OrderPrimitives'

type Props = {
  order: Order | null
  store: Store
  customerName: (id?: string) => string | undefined
  balanceForCustomer: (customerId: string) => number
  isAdmin: boolean
  onClose: () => void
  onVoid: () => void
  onReprint: (order: Order) => void
}

export default function OrderDetailsDrawer({
  order,
  store,
  customerName,
  balanceForCustomer,
  isAdmin,
  onClose,
  onVoid,
  onReprint,
}: Props) {
  return (
    <Drawer
      open={!!order}
      onClose={onClose}
      title={order ? `Order #${order.number}` : ''}
      subtitle={order ? `${fmtDate(order.createdAt)} · ${fmtTime(order.createdAt)}` : ''}
      footer={
        order ? (
          <div className="flex items-center justify-between gap-2">
            {order.status === 'completed' ? (
              <Button variant="ghost" onClick={onVoid} className="text-[var(--semantic-red-text)] hover:bg-[var(--semantic-red-soft)]">
                <Trash2 className="h-4 w-4" /> {isAdmin ? 'Void order' : 'Request void'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onReprint(order)}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : null
      }
    >
      {order && (
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <PaymentBadge method={order.paymentMethod} />
            <Badge tone={order.status === 'void' ? 'danger' : 'success'}>
              {order.status === 'void' ? 'Voided' : 'Completed'}
            </Badge>
            <Badge tone="neutral">{order.channel.replace('-', ' ')}</Badge>
            {order.customerId && (
              <Badge tone="accent">
                <UserRound className="h-3 w-3" />
                {customerName(order.customerId)}
              </Badge>
            )}
          </div>

          {order.status === 'void' && order.voidedByName && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--semantic-red-soft)] px-3.5 py-2.5 text-[12px] text-[var(--semantic-red-text)]">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>
                Voided by <span className="font-bold">{order.voidedByName}</span>
              </span>
            </div>
          )}

          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="space-y-2.5">
              {order.items.map((item) => (
                <div key={item.lineId ?? `${item.productId}-${item.variantId ?? ''}`} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tint text-xs font-bold text-brand-navy">
                    {item.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-ink">{item.name}</div>
                    <div className="text-[10.5px] text-muted">
                      {item.soldByWeight ? `${item.qty.toFixed(3)} ${item.saleUnit ?? 'piece'}` : `${item.qty} × ${money(item.price)}`}
                    </div>
                    {item.variantName && <div className="text-[10px] text-muted">{item.variantName}</div>}
                    {!!item.modifiers?.length && <div className="text-[10px] text-muted">{item.modifiers.map((modifier) => modifier.optionName).join(', ')}</div>}
                    {item.note && <div className="text-[10px] italic text-muted">{item.note}</div>}
                  </div>
                  <span className="text-[12.5px] font-semibold tabular">
                    {money(round(item.price * item.qty))}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 border-t border-dashed border-line pt-3 text-[12px]">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span className="tabular">{money(order.subtotal)}</span>
              </div>
              {order.service > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Service</span>
                  <span className="tabular">{money(order.service)}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Tax {store.settings.taxInclusive ? '(included)' : ''}</span>
                  <span className="tabular">{money(order.tax)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Discount</span>
                  <span className="tabular">−{money(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-[14px] font-extrabold">
                <span>Total</span>
                <span className="tabular">{money(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Served by</div>
              <div className="mt-1 text-[12.5px] font-semibold">{order.staffName}</div>
            </div>
            <div className="rounded-xl border border-line bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {order.customerId ? 'Tab balance' : 'Payment'}
              </div>
              <div className="mt-1 text-[12.5px] font-semibold">
                {order.customerId
                  ? money(balanceForCustomer(order.customerId))
                  : order.paymentMethod === 'cash'
                    ? 'Paid in cash'
                    : 'Paid by card'}
              </div>
            </div>
          </div>

          {order.note && (
            <div className="rounded-xl bg-brand-amber-soft px-3.5 py-2.5 text-[12px] text-brand-navy">
              <span className="font-semibold">Note: </span>
              {order.note}
            </div>
          )}

          <div className="rounded-2xl bg-cream-200/60 p-4">
            <div className="receipt-print">
              <ReceiptView order={order} store={store} />
            </div>
          </div>
        </div>
      )}
    </Drawer>
  )
}

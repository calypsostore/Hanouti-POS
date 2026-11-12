import type { Order, Store } from '../types'
import { fmtDateTime } from '../lib/utils'
import { round } from '../lib/pricing-utils'

export function ReceiptView({ order, store }: { order: Order; store: Store }) {
  const settings = store.settings
  return (
    <div className="receipt mx-auto shadow-sm">
      <div className="text-center">
        <div className="text-[20px]">{store.emoji}</div>
        <div className="mt-1 text-[16px] font-extrabold tracking-tight">{store.name}</div>
        <div className="mt-1 text-[10.5px] leading-relaxed text-neutral-600">
          {store.address}
          <br />
          {store.city} · {store.phone}
        </div>
      </div>
      <hr />
      <div className="flex justify-between text-[10.5px] text-neutral-600">
        <span>Order #{order.number}</span>
        <span>{fmtDateTime(order.createdAt)}</span>
      </div>
      <div className="mt-0.5 flex justify-between text-[10.5px] text-neutral-600">
        <span className="capitalize">{order.channel.replace('-', ' ')}</span>
        <span>{order.staffName}</span>
      </div>
      <hr />
      <div className="space-y-1">
        {order.items.map((item) => (
          <div key={item.lineId ?? `${item.productId}-${item.variantId ?? ''}`} className="space-y-0.5">
            <div className="flex justify-between gap-2">
              <span className="min-w-0">
                {item.soldByWeight ? item.qty.toFixed(3) : item.qty} {item.saleUnit ?? '×'} {item.name}
                {item.variantName ? ` · ${item.variantName}` : ''}
              </span>
              <span className="shrink-0 mono">{round(item.price * item.qty).toFixed(3)}</span>
            </div>
            {!!item.modifiers?.length && (
              <div className="pl-2 text-[9.5px] text-neutral-500">
                {item.modifiers.map((modifier) => modifier.optionName).join(', ')}
              </div>
            )}
            {item.note && <div className="pl-2 text-[9.5px] italic text-neutral-500">{item.note}</div>}
          </div>
        ))}
      </div>
      <hr />
      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="mono">{order.subtotal.toFixed(3)}</span>
        </div>
        {order.service > 0 && (
          <div className="flex justify-between">
            <span>Service</span>
            <span className="mono">{order.service.toFixed(3)}</span>
          </div>
        )}
        {order.tax > 0 && (
          <div className="flex justify-between text-neutral-500">
            <span>Tax ({settings.taxRate}%)</span>
            <span className="mono">{order.tax.toFixed(3)}</span>
          </div>
        )}
        {order.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span className="mono">-{order.discount.toFixed(3)}</span>
          </div>
        )}
      </div>
      <hr />
      <div className="flex items-baseline justify-between text-[15px] font-extrabold">
        <span>TOTAL</span>
        <span className="mono">{order.total.toFixed(3)} DT</span>
      </div>
      <div className="mt-1 text-right text-[10px] uppercase tracking-wide text-neutral-500">
        {order.paymentMethod === 'credit' ? 'On account' : order.paymentMethod}
      </div>
      <hr />
      <div className="text-center text-[10.5px] leading-relaxed text-neutral-600">
        {settings.receiptFooter || 'Thank you for your visit!'}
      </div>
      <div className="mt-2 text-center text-[9px] text-neutral-400">
        Powered by Kawa POS · kawa.tn
      </div>
    </div>
  )
}

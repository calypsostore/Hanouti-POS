import { Minus, Plus } from 'lucide-react'
import type { OrderItem } from '../../types'
import { Input } from '../../components/ui'
import { money } from '../../lib/utils'
import { round } from '../../lib/pricing-utils'

export function CartItemsList({
  items,
  persistedLineIds,
  changeQty,
  setLineQty,
}: {
  items: OrderItem[]
  persistedLineIds?: string[]
  changeQty: (id: string, delta: number) => void
  setLineQty: (id: string, qty: number) => void
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const persisted = !!item.lineId && persistedLineIds?.includes(item.lineId)
        return (
          <li
            key={item.lineId ?? `${item.productId}-${item.variantId ?? ''}`}
            className="glass-row group flex items-center gap-2.5 rounded-xl px-1.5 py-2"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-xs font-bold text-brand-navy">
              {item.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-ink">{item.name}</div>
              {item.variantName && <div className="truncate text-[10px] text-muted">{item.variantName}</div>}
              {!!item.modifiers?.length && (
                <div className="truncate text-[10px] text-muted">
                  {item.modifiers.map((modifier) => modifier.optionName).join(', ')}
                </div>
              )}
              {item.note && <div className="truncate text-[10px] italic text-muted">{item.note}</div>}
              <div className="text-[10.5px] text-muted tabular">{money(item.price)} each</div>
              {persisted && (
                <div className="text-[9.5px] font-semibold text-muted">
                  {item.sentAt ? 'Sent to kitchen' : 'Saved'}
                </div>
              )}
            </div>
            {item.soldByWeight ? (
              <Input
                type="number"
                min={0.001}
                step="0.001"
                value={item.qty}
                onChange={(event) => setLineQty(item.lineId ?? item.productId, Number(event.target.value))}
                className="h-7 w-[76px] px-1 text-center text-[11px] tabular"
                aria-label={`Quantity in ${item.saleUnit ?? 'piece'}`}
                disabled={persisted}
              />
            ) : (
              <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-0.5">
                <button
                  onClick={() => changeQty(item.lineId ?? item.productId, -1)}
                  disabled={persisted}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-cream-100 hover:text-ink"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-4 text-center text-[11.5px] font-bold tabular">{item.qty}</span>
                <button
                  onClick={() => changeQty(item.lineId ?? item.productId, 1)}
                  disabled={persisted}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-cream-100 hover:text-ink"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="w-[62px] text-right text-[12px] font-bold tabular">
              {money(round(item.price * item.qty))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

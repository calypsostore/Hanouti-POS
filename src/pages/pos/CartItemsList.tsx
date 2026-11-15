import { Ban, Minus, Plus } from 'lucide-react'
import { Button } from '../../components/ui'
import type { OrderItem } from '../../types'
import { Input } from '../../components/ui'
import { money } from '../../lib/utils'
import { round } from '../../lib/pricing-utils'

export function CartItemsList({
  items,
  persistedLineIds,
  changeQty,
  setLineQty,
  canVoidSentItems = false,
  onVoidSentItem,
  unavailableLineIds = [],
  issueByLine = {},
}: {
  items: OrderItem[]
  persistedLineIds?: string[]
  changeQty: (id: string, delta: number) => void
  setLineQty: (id: string, qty: number) => void
  canVoidSentItems?: boolean
  onVoidSentItem?: (lineId: string) => void
  unavailableLineIds?: string[]
  issueByLine?: Record<string, string>
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const persisted = !!item.lineId && persistedLineIds?.includes(item.lineId)
        const unavailable = !!item.lineId && unavailableLineIds.includes(item.lineId) &&
          (!persisted || item.status === 'draft')
        const issue = item.lineId ? issueByLine[item.lineId] : undefined
        return (
          <li
            key={item.lineId ?? `${item.productId}-${item.variantId ?? ''}`}
            className={`glass-row group flex items-center gap-2 rounded-xl px-1.5 py-1 ${unavailable ? 'border border-red-500 bg-red-50' : ''}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-xs font-bold text-accent-foreground">
              {item.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-ink">{item.name}</div>
              {item.variantName && <div className="truncate text-[10px] text-muted">{item.variantName}</div>}
              {unavailable && <div className="text-[10px] font-bold text-red-600">86 - remove</div>}
              {!unavailable && issue && (
                <div className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[9.5px] font-bold text-red-700">
                  {issue}
                </div>
              )}
              {!!item.modifiers?.length && (
                <div className="truncate text-[10px] text-muted">
                  {item.modifiers.map((modifier) => modifier.optionName).join(', ')}
                </div>
              )}
              {item.note && <div className="truncate text-[10px] italic text-muted">{item.note}</div>}
              <div className="text-[10.5px] text-muted tabular">{money(item.price)} each</div>
              {persisted && (
                <div className="text-[9.5px] font-semibold text-muted">
                  {item.status === 'ready' ? 'Ready' : item.status === 'served' ? 'Served' : item.status === 'preparing' ? 'Preparing' : item.status === 'void' ? 'Voided' : item.status === 'draft' ? 'Draft · saved' : 'Sent to station'}
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
                disabled={persisted && item.status !== 'draft'}
              />
            ) : (
              <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-0.5">
                <button
                  onClick={() => changeQty(item.lineId ?? item.productId, -1)}
                  disabled={persisted && item.status !== 'draft'}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-cream-100 hover:text-ink"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-4 text-center text-[11.5px] font-bold tabular">{item.qty}</span>
                <button
                  onClick={() => changeQty(item.lineId ?? item.productId, 1)}
                  disabled={persisted && item.status !== 'draft'}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-cream-100 hover:text-ink"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="w-[62px] text-right text-[12px] font-bold tabular">
              {money(round(item.price * item.qty))}
            </div>
            {persisted && item.status !== 'draft' && item.status !== 'void' && canVoidSentItems && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Void sent ${item.name}`}
                title="Void sent item"
                onClick={() => item.lineId && onVoidSentItem?.(item.lineId)}
              >
                <Ban className="h-4 w-4 text-red-600" />
              </Button>
            )}
            {unavailable && (
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => changeQty(item.lineId ?? item.productId, -item.qty)}>
                Remove
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

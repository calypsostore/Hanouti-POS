import { CheckCircle2, ChevronRight, Minus, Plus, ShoppingBag, Trash2, UserRound, Wallet, X } from 'lucide-react'
import type { OrderChannel, OrderItem } from '../../types'
import { Avatar, Button, Input, Segmented, Textarea } from '../../components/ui'
import { cn, money } from '../../lib/utils'
import { round } from '../../lib/pricing-utils'

export function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition',
        active
          ? 'border-espresso-900 bg-espresso-900 text-cream-50'
          : 'border-line bg-white text-muted hover:border-accent-foreground/40 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
export function CartPanel({
  embedded,
  cart,
  channel,
  setChannel,
  customer,
  customerId,
  balance,
  onPickCustomer,
  onClearCustomer,
  onClear,
  changeQty,
  setLineQty,
  totals,
  discount,
  setDiscount,
  canDiscount,
  note,
  setNote,
  quick,
  allowCredit,
  onCheckout,
  onAddToTab,
  count,
}: {
  embedded?: boolean
  cart: OrderItem[]
  channel: OrderChannel
  setChannel: (c: OrderChannel) => void
  customer?: { name: string; id: string; phone: string }
  customerId?: string
  balance: number
  onPickCustomer: () => void
  onClearCustomer: () => void
  onClear: () => void
  changeQty: (id: string, delta: number) => void
  setLineQty: (id: string, qty: number) => void
  totals: { subtotal: number; tax: number; service: number; total: number }
  discount: number
  setDiscount: (n: number) => void
  canDiscount: boolean
  note: string
  setNote: (s: string) => void
  quick: boolean
  allowCredit: boolean
  onCheckout: () => void
  onAddToTab: () => void
  count: number
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', embedded && 'min-h-[50vh]')}>
      <div className="flex shrink-0 items-center justify-between border-b border-brand-navy-light bg-brand-navy px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-brand-amber" />
          <span className="text-[13.5px] font-bold">Current order</span>
          {count > 0 && (
            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </div>
        {cart.length > 0 && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="shrink-0 border-b border-line/70 px-4 py-2.5">
        <Segmented
          value={channel}
          onChange={setChannel}
          size="sm"
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'takeaway', label: 'Takeaway' },
            { value: 'dine-in', label: 'Dine-in' },
          ]}
        />
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-3 thin-scrollbar', embedded && 'max-h-[36vh]')}>
        {customer ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-accent-foreground/25 bg-accent-50 px-2.5 py-2">
            <Avatar name={customer.name} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-ink">{customer.name}</div>
              <div className="text-[10.5px] text-accent-foreground">
                Tab balance · {money(balance)}
              </div>
            </div>
            <button
              onClick={onClearCustomer}
              className="rounded-md p-1 text-accent-foreground/60 hover:bg-white/60 hover:text-accent-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onPickCustomer}
            className="mb-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-2.5 py-2.5 text-left transition hover:border-accent-foreground/50 hover:bg-white"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cream-200 text-muted">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-ink">Attach a customer</div>
              <div className="text-[10.5px] text-muted">Charge to a tab or keep as guest</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted/50" />
          </button>
        )}

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-200 text-muted/70">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <p className="text-[13px] font-semibold text-ink">Nothing here yet</p>
            <p className="mt-1 max-w-[200px] text-[11.5px] leading-relaxed text-muted">
              Tap items on the menu to build the order.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {cart.map((item) => (
              <li
                key={item.lineId ?? `${item.productId}-${item.variantId ?? ''}`}
                className="group flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition hover:bg-white"
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
                  />
                ) : (
                  <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-0.5">
                    <button
                      onClick={() => changeQty(item.lineId ?? item.productId, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-cream-100 hover:text-ink"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-4 text-center text-[11.5px] font-bold tabular">{item.qty}</span>
                    <button
                      onClick={() => changeQty(item.lineId ?? item.productId, 1)}
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
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-white px-4 py-3">
        <details className="group mb-2 rounded-lg">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold text-muted transition hover:text-ink">
            <span>Add note{note ? ' · added' : ''}</span>
            <ChevronRight className="h-3.5 w-3.5 transition group-open:rotate-90" />
          </summary>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. no sugar, extra shot…"
            className="mt-2 min-h-[56px] text-[12px]"
          />
        </details>

        <div className="space-y-1.5 text-[12px]">
          <Row label="Subtotal" value={money(totals.subtotal)} />
          {totals.service > 0 && (
            <Row label="Service charge" value={money(totals.service)} />
          )}
          {totals.tax > 0 && (
            <Row label="Tax (included)" value={money(totals.tax)} muted />
          )}
          {canDiscount && (
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-muted">Discount</span>
              <div className="relative w-[88px]">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={discount || ''}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  placeholder="0.000"
                  className="h-7 pr-1 text-right text-[11.5px] tabular"
                />
              </div>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-dashed border-line pt-2">
            <span className="text-[13px] font-bold text-ink">Total</span>
            <span className="text-[20px] font-extrabold tracking-tight text-ink tabular">
              {money(totals.total)}
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <Button size="lg" className="w-full" disabled={!cart.length} onClick={onCheckout}>
            {quick ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Complete order · {money(totals.total)}
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" /> Checkout · {money(totals.total)}
              </>
            )}
          </Button>
          {allowCredit && (
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              disabled={!cart.length || !customerId}
              onClick={onAddToTab}
              title={!customerId ? 'Attach a customer to use a tab' : undefined}
            >
              <UserRound className="h-4 w-4" /> Add to tab
            </Button>
          )}
          {quick && (
            <p className="text-center text-[10.5px] leading-relaxed text-muted">
              Quick mode · choose cash or card at checkout.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-muted/70' : 'text-muted'}>{label}</span>
      <span className={cn('tabular', muted ? 'text-muted/80' : 'font-semibold text-ink')}>{value}</span>
    </div>
  )
}

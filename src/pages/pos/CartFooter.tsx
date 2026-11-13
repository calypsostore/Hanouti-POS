import { CheckCircle2, ChevronRight, UserRound, Wallet } from 'lucide-react'
import { Button, Input, Textarea } from '../../components/ui'
import { cn, money } from '../../lib/utils'

export function CartFooter({
  totals,
  discount,
  setDiscount,
  canDiscount,
  note,
  setNote,
  quick,
  allowCredit,
  customerId,
  onCheckout,
  onAddToTab,
  count,
  isOpenOrder,
  canSaveOpenOrder,
  hasUnsentItems,
  onSaveOpenOrder,
  onSendKitchen,
  onOpenFloor,
}: {
  totals: { subtotal: number; tax: number; service: number; total: number }
  discount: number
  setDiscount: (n: number) => void
  canDiscount: boolean
  note: string
  setNote: (s: string) => void
  quick: boolean
  allowCredit: boolean
  customerId?: string
  onCheckout: () => void
  onAddToTab: () => void
  count: number
  isOpenOrder?: boolean
  canSaveOpenOrder?: boolean
  hasUnsentItems?: boolean
  onSaveOpenOrder?: () => void
  onSendKitchen?: () => void
  onOpenFloor?: () => void
}) {
  const showTabButton = allowCredit && !!customerId && !(quick && isOpenOrder)

  return (
    <div className="glass-subtle flex min-h-0 max-h-32 shrink-0 flex-col overflow-hidden border-t border-line/70 px-3 py-2">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <details className="group mb-1 rounded-lg">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold text-muted transition hover:text-ink">
            <span>Add note{note ? ' · added' : ''}</span>
            <ChevronRight className="h-3.5 w-3.5 transition group-open:rotate-90" />
          </summary>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. no sugar, extra shot…"
            className="mt-2 min-h-[56px] text-[12px]"
          />
        </details>

        <div className="space-y-1 text-[11.5px]">
          <Row label="Subtotal" value={money(totals.subtotal)} />
          {totals.service > 0 && <Row label="Service charge" value={money(totals.service)} />}
          {totals.tax > 0 && <Row label="Tax (included)" value={money(totals.tax)} muted />}
          {canDiscount && (
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-muted">Discount</span>
              <div className="relative w-[88px]">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={discount || ''}
                  onChange={(event) => setDiscount(Math.max(0, Number(event.target.value)))}
                  placeholder="0.000"
                  className="h-7 pr-1 text-right text-[11.5px] tabular"
                />
              </div>
            </div>
          )}
        </div>

        {isOpenOrder && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="secondary" className="w-full" disabled={!canSaveOpenOrder} onClick={onSaveOpenOrder}>
              Save items
            </Button>
            <Button variant="secondary" className="w-full" disabled={!hasUnsentItems} onClick={onSendKitchen}>
              Send to kitchen
            </Button>
            <Button variant="ghost" className="col-span-2 w-full" onClick={onOpenFloor}>Back to tables</Button>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line/50 pt-2">
        <div className="glass-tint-green flex items-baseline justify-between rounded-2xl border-t border-dashed border-line px-3 py-1.5">
          <span className="text-[13px] font-bold text-ink">Total</span>
          <span className="text-[18px] font-extrabold tracking-tight text-ink tabular">{money(totals.total)}</span>
        </div>

        <div className={cn('mt-2', showTabButton ? 'grid grid-cols-2 gap-2' : '')}>
          <Button
            size="md"
            className={cn(
              'w-full rounded-full shadow-[0_8px_24px_var(--semantic-green-soft)]',
              showTabButton && 'px-2 text-[12px] leading-tight',
            )}
            style={{ background: 'var(--semantic-green-gradient)', color: 'white' }}
            disabled={!count}
            onClick={onCheckout}
          >
            {quick && isOpenOrder
              ? <><CheckCircle2 className="h-4 w-4" /> Done</>
              : quick
              ? <><CheckCircle2 className="h-4 w-4" /> {isOpenOrder ? 'Pay table' : 'Complete order'} · {money(totals.total)}</>
              : <><Wallet className="h-4 w-4" /> {isOpenOrder ? 'Pay table' : 'Checkout'} · {money(totals.total)}</>}
          </Button>

          {showTabButton && (
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              disabled={!count}
              onClick={onAddToTab}
            >
              <UserRound className="h-4 w-4" /> Add to tab
            </Button>
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

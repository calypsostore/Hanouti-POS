import { useState } from 'react'
import { CheckCircle2, ChevronRight, StickyNote, UserRound, Wallet } from 'lucide-react'
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
  onDone,
  count,
  isOpenOrder,
  onOpenFloor,
  hasUnavailableDraft = false,
  issueCount = 0,
  onReview,
  compact = false,
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
  onDone: () => void
  count: number
  isOpenOrder?: boolean
  onOpenFloor?: () => void
  hasUnavailableDraft?: boolean
  issueCount?: number
  onReview?: () => void
  compact?: boolean
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const showTabButton = allowCredit && !!customerId && !isOpenOrder
  const reviewLabel = issueCount && issueCount > 0 ? `Review (${issueCount} issue${issueCount === 1 ? '' : 's'})` : null

  return (
    <div className={cn(
      'glass-subtle flex min-h-0 shrink-0 flex-col overflow-hidden border-t border-line/70',
      compact ? 'px-2 py-1.5' : 'px-3 py-2',
      noteOpen || isOpenOrder ? 'max-h-[50vh]' : compact ? 'max-h-[40vh]' : 'max-h-32',
    )}>
      <button
        type="button"
        aria-expanded={noteOpen}
        onClick={() => setNoteOpen((open) => !open)}
        className={cn(
          'flex shrink-0 items-center gap-2 rounded-lg px-2 text-left font-semibold text-muted transition hover:bg-white/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-amber',
          compact ? 'min-h-8 text-[11px]' : 'min-h-9 text-xs',
        )}
      >
        <StickyNote className="h-4 w-4" />
        <span className="flex-1">{note ? 'Add note · added' : 'Add note'}</span>
        <ChevronRight className={cn('h-3.5 w-3.5 transition', noteOpen && 'rotate-90')} />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {noteOpen && (
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. no sugar, extra shot…"
            className={cn('mb-2', compact ? 'min-h-[48px] text-[11.5px]' : 'min-h-[56px] text-[12px]')}
          />
        )}

        <div className={compact
          ? 'grid grid-cols-2 gap-x-2 text-[10px] leading-tight'
          : 'space-y-1 text-[11.5px]'}>
          <Row label="Subtotal" value={money(totals.subtotal)} compact={compact} />
          {totals.service > 0 && <Row label="Service charge" value={money(totals.service)} compact={compact} />}
          {totals.tax > 0 && <Row label={compact ? 'Tax incl.' : 'Tax (included)'} value={money(totals.tax)} muted compact={compact} />}
          {canDiscount && (
            <div className={cn('flex items-center justify-between gap-2 py-0.5', compact && 'col-span-2')}>
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
      </div>

      {isOpenOrder && (
        <div className={cn('grid shrink-0 gap-2', compact ? 'py-1' : 'py-2')}>
          <Button variant="ghost" className="w-full" onClick={onOpenFloor}>Back to tables</Button>
        </div>
      )}

      {compact && !showTabButton && !isOpenOrder ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-line/50 pt-1.5">
          <div className="glass-tint-green flex min-w-0 flex-1 flex-col justify-center rounded-xl px-2 py-1 leading-tight">
            <span className="text-[10px] font-semibold text-muted">Total</span>
            <span className="truncate text-[15px] font-extrabold tracking-tight text-ink tabular">{money(totals.total)}</span>
          </div>
          <Button
            size="sm"
            className="w-auto shrink-0 rounded-full px-3 text-[11px] shadow-[0_8px_24px_var(--semantic-green-soft)]"
            style={{ background: 'var(--semantic-green-gradient)', color: 'white' }}
            disabled={hasUnavailableDraft || (!count && !isOpenOrder)}
            onClick={reviewLabel && onReview ? onReview : isOpenOrder ? onDone : onCheckout}
          >
            {reviewLabel
              ? <><CheckCircle2 className="h-3.5 w-3.5" /> {reviewLabel}</>
              : quick
              ? <><CheckCircle2 className="h-3.5 w-3.5" /> Done</>
              : <><Wallet className="h-3.5 w-3.5" /> Checkout</>}
          </Button>
        </div>
      ) : (
        <div className={cn('shrink-0 border-t border-line/50', compact ? 'pt-1.5' : 'pt-2')}>
          <div className={cn(
            'glass-tint-green flex items-baseline justify-between border-t border-dashed border-line',
            compact ? 'rounded-xl px-2 py-1' : 'rounded-2xl px-3 py-1.5',
          )}>
            <span className={cn('font-bold text-ink', compact ? 'text-[12px]' : 'text-[13px]')}>Total</span>
            <span className={cn('font-extrabold tracking-tight text-ink tabular', compact ? 'text-[16px]' : 'text-[18px]')}>{money(totals.total)}</span>
          </div>

          <div className={cn(
            compact ? 'mt-1' : 'mt-2',
            (showTabButton || (isOpenOrder && !quick)) ? 'grid grid-cols-2 gap-2' : '',
          )}>
            <Button
              size={compact ? 'sm' : 'md'}
              className={cn(
                'w-full rounded-full shadow-[0_8px_24px_var(--semantic-green-soft)]',
                showTabButton && 'px-2 text-[12px] leading-tight',
              )}
              style={{ background: 'var(--semantic-green-gradient)', color: 'white' }}
              disabled={hasUnavailableDraft || (!count && !isOpenOrder)}
              onClick={reviewLabel && onReview ? onReview : isOpenOrder ? onDone : onCheckout}
            >
              {reviewLabel
                ? <><CheckCircle2 className="h-4 w-4" /> {reviewLabel}</>
                : isOpenOrder
                ? <><CheckCircle2 className="h-4 w-4" /> Done</>
                : quick
                ? <><CheckCircle2 className="h-4 w-4" /> Done</>
                : <><Wallet className="h-4 w-4" /> Checkout · {money(totals.total)}</>}
            </Button>

            {isOpenOrder && !quick && (
              <Button
                variant="secondary"
                size={compact ? 'sm' : 'md'}
                className="w-full"
                disabled={hasUnavailableDraft || !count}
                onClick={reviewLabel && onReview ? onReview : onCheckout}
              >
                <Wallet className="h-4 w-4" /> {reviewLabel ?? <>Pay table · {money(totals.total)}</>}
              </Button>
            )}
            {showTabButton && (
              <Button
                variant="secondary"
                size={compact ? 'sm' : 'md'}
                className="w-full"
                disabled={!count}
                onClick={onAddToTab}
              >
                <UserRound className="h-4 w-4" /> Add to tab
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, muted, compact }: { label: string; value: string; muted?: boolean; compact?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between', compact && 'gap-1')}>
      <span className={muted ? 'text-muted/70' : 'text-muted'}>{label}</span>
      <span className={cn('tabular', muted ? 'text-muted/80' : 'font-semibold text-ink')}>{value}</span>
    </div>
  )
}

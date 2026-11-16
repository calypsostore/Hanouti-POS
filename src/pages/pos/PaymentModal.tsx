import { useEffect, useMemo, useState } from 'react'
import { Banknote, CheckCircle2, CreditCard } from 'lucide-react'
import type { PaymentMethod } from '../../types'
import { balanceFor } from '../../lib/selectors'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { cn, money } from '../../lib/utils'
import { SEMANTIC_COLORS } from '../../lib/semanticColors'

export function PaymentModal({
  open,
  onClose,
  total,
  customers,
  customerId,
  setCustomerId,
  ledger,
  allowCredit,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  total: number
  customers: Array<{ id: string; name: string; phone: string; limit: number }>
  customerId?: string
  setCustomerId: (id: string | undefined) => void
  ledger: Parameters<typeof balanceFor>[0]
  allowCredit: boolean
  onConfirm: (method: PaymentMethod) => string | null
  orderNo: number | null
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [received, setReceived] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (open) {
      setMethod('cash')
      setReceived('')
      setBusy(false)
      setError(undefined)
    }
  }, [open])

  const customer = customers.find((c) => c.id === customerId)
  const balance = customerId ? balanceFor(ledger, customerId) : 0
  const receivedNum = Number(received) || 0
  const change = receivedNum - total
  const cashOk = receivedNum >= total - 0.0001
  const creditBlocked = method === 'credit' && !customerId
  const overLimit = customer && balance + total > customer.limit

  const quickAmounts = useMemo(() => {
    const opts = new Set<number>()
    opts.add(Math.ceil(total))
    ;[5, 10, 20, 50].forEach((v) => {
      if (v >= total) opts.add(v)
    })
    return Array.from(opts).sort((a, b) => a - b).slice(0, 5)
  }, [total])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Take payment"
      subtitle="Choose how the customer is paying."
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11.5px] text-muted">
            {method === 'cash' && !cashOk && receivedNum > 0
              ? `Short by ${money(total - receivedNum)}`
              : method === 'credit' && customer
                ? `New tab balance · ${money(balance + total)}`
                : 'Amount due'}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Back
            </Button>
            <Button
              size="md"
              disabled={busy || (method === 'cash' && !cashOk) || creditBlocked}
              onClick={() => {
                if (busy) return
                setBusy(true)
                setError(undefined)
                const message = onConfirm(method)
                if (message) {
                  setError(message)
                  setBusy(false)
                }
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> {busy ? 'Completing…' : `Complete · ${money(total)}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="rounded-2xl bg-espresso-900 px-5 py-4 text-cream-50">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">
          Amount due
        </div>
        <div className="mt-1 text-[30px] font-extrabold tracking-tight tabular">{money(total)}</div>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-[var(--semantic-rose-border)] bg-[var(--semantic-rose-soft)] px-3.5 py-3 text-[12px] font-medium text-[var(--semantic-rose-text)]">
          {error}
        </div>
      )}

      <div className="mt-4">
        <div className="glass-subtle grid grid-cols-3 gap-1 rounded-full p-1">
          {([
            { value: 'cash', label: 'Cash', color: SEMANTIC_COLORS.payment.cash.light },
            { value: 'card', label: 'Card', color: SEMANTIC_COLORS.payment.card.light },
            { value: 'credit', label: allowCredit ? 'On tab' : 'Tab off', color: SEMANTIC_COLORS.payment.credit.light },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMethod(option.value)}
              aria-pressed={method === option.value}
              className="rounded-full px-3 py-2 text-[12px] font-bold transition"
              style={method === option.value
                ? { color: option.color.text, background: option.color.softBackground, boxShadow: `inset 0 0 0 1px ${option.color.border}` }
                : { color: 'var(--color-muted)' }}
            >
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: option.color.solid }} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {method === 'cash' && (
        <div className="mt-4">
          <Field label="Cash received" hint="Tap a note or type an amount">
            <Input
              type="number"
              inputMode="decimal"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              placeholder={total.toFixed(3)}
              className="h-12 text-lg font-bold tabular"
              autoFocus
            />
          </Field>
          <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {quickAmounts.map((v) => (
              <button
                key={v}
                onClick={() => setReceived(String(v))}
                className="glass-subtle h-9 rounded-xl border border-line/70 bg-transparent text-[12px] font-semibold tabular transition hover:border-brand-amber/50"
              >
                {v === Math.ceil(total) ? 'Exact' : v}
              </button>
            ))}
          </div>
          <div
            className={cn(
              'mt-3 flex items-center justify-between rounded-xl px-3.5 py-3',
              change >= 0
                ? 'bg-[var(--semantic-green-soft)] text-[var(--semantic-green-text)]'
                : 'bg-[var(--semantic-slate-soft)] text-[var(--semantic-slate-text)]',
            )}
          >
            <span className="text-[12px] font-semibold">Change due</span>
            <span className="text-[18px] font-extrabold tabular">
              {change >= 0 ? money(change) : '—'}
            </span>
          </div>
        </div>
      )}

      {method === 'card' && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--semantic-blue-border)] bg-[var(--semantic-blue-soft)] p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--semantic-blue-soft)] text-[var(--semantic-blue-text)] ring-1 ring-[var(--semantic-blue-border)]">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-ink">Card / bank payment</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
              Confirm once the terminal or bank transfer has gone through. No card integration is
              connected — the payment is recorded manually.
            </p>
          </div>
        </div>
      )}

      {method === 'credit' && (
        <div className="mt-4 space-y-3">
          <Field label="Customer">
            <Select
              value={customerId ?? ''}
              onChange={(e) => setCustomerId(e.target.value || undefined)}
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {money(balanceFor(ledger, c.id))} outstanding
                </option>
              ))}
            </Select>
          </Field>
          {customer ? (
            <div className="rounded-xl border border-line bg-white p-3.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted">Current balance</span>
                <span className="font-semibold tabular">{money(balance)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px]">
                <span className="text-muted">This order</span>
                <span className="font-semibold tabular">+ {money(total)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-dashed border-line pt-2 text-[13px]">
                <span className="font-bold">New balance</span>
                <span className="font-extrabold text-accent-foreground tabular">
                  {money(balance + total)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted">
                <span>Credit limit</span>
                <span className="tabular">{money(customer.limit)}</span>
              </div>
              {overLimit && (
                <div className="mt-2 rounded-lg bg-brand-amber-soft px-2.5 py-2 text-[11px] font-medium text-brand-navy">
                  This exceeds the customer&apos;s credit limit by {money(balance + total - customer.limit)}.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-4 text-center text-[11.5px] text-muted">
              {customers.length
                ? 'Select a customer to continue.'
                : 'No customers yet. Ask your manager to create one.'}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 rounded-lg px-1 text-[10.5px] text-muted">
        <Banknote className="h-3.5 w-3.5" />
        Payment is recorded instantly and appears in today&apos;s reports.
      </div>
    </Modal>
  )
}

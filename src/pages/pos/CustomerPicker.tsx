import { useState } from 'react'
import { Search } from 'lucide-react'
import { Avatar, Input, Modal } from '../../components/ui'
import { balanceFor } from '../../lib/selectors'
import { cn, money } from '../../lib/utils'

export function CustomerPicker({
  open,
  onClose,
  customers,
  ledger,
  selectedId,
  onSelect,
  allowCredit,
  isAdmin,
}: {
  open: boolean
  onClose: () => void
  customers: Array<{ id: string; name: string; phone: string; limit: number }>
  ledger: Parameters<typeof balanceFor>[0]
  selectedId?: string
  onSelect: (id: string) => void
  allowCredit: boolean
  isAdmin: boolean
}) {
  const [query, setQuery] = useState('')
  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.includes(query.trim()),
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attach a customer"
      subtitle="Find the customer to charge or add to their tab."
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone…"
          className="pl-9"
        />
      </div>
      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto thin-scrollbar">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
            <p className="text-[13px] font-semibold text-ink">No customer found</p>
            <p className="mt-1 text-[11.5px] text-muted">
              {isAdmin
                ? 'Create the customer profile from Regulars & tabs.'
                : 'Ask your manager to create the customer profile.'}
            </p>
          </div>
        )}
        {filtered.map((c) => {
          const bal = balanceFor(ledger, c.id)
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                selectedId === c.id
                  ? 'border-accent-foreground/50 bg-accent-50'
                  : 'border-line bg-white hover:border-accent-foreground/40',
              )}
            >
              <Avatar name={c.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-ink">{c.name}</div>
                <div className="text-[11px] text-muted">{c.phone || 'No phone'}</div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    'text-[12.5px] font-bold tabular',
                    bal > 0 ? 'text-accent-foreground' : 'text-muted',
                  )}
                >
                  {money(bal)}
                </div>
                <div className="text-[9.5px] uppercase tracking-wide text-muted/70">tab</div>
              </div>
            </button>
          )
        })}
      </div>
      {!allowCredit && (
        <p className="mt-4 rounded-lg bg-cream-100 px-3 py-2 text-[11.5px] text-muted">
          Credit tabs are disabled for this store. The customer can still be attached to the order.
        </p>
      )}
    </Modal>
  )
}

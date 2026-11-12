import {
  CalendarClock,
  HandCoins,
  Lock,
  Pencil,
  Plus,
  Search,
  UserPlus,
  Users,
  Wallet,
  Banknote,
} from 'lucide-react'
import type { Customer, LedgerEntry } from '../../../../types'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Segmented,
} from '../../../../components/ui'
import { balanceFor } from '../../../../lib/selectors'
import { cn, cycleLabel, money, nextDueLabel } from '../../../../lib/utils'

type CustomerView = 'all' | 'open' | 'settled'

type Props = {
  customers: Customer[]
  filtered: Customer[]
  ledger: LedgerEntry[]
  totalOutstanding: number
  debtors: number
  collectedThisMonth: number
  query: string
  onQueryChange: (query: string) => void
  view: CustomerView
  onViewChange: (view: CustomerView) => void
  isAdmin: boolean
  canSettle: boolean
  onAdd: () => void
  onSelect: (customer: Customer) => void
  onStartOrder: (customerId: string) => void
  onSettle: (customerId: string) => void
  onEdit: (customer: Customer) => void
}

export default function CustomerList({
  customers,
  filtered,
  ledger,
  totalOutstanding,
  debtors,
  collectedThisMonth,
  query,
  onQueryChange,
  view,
  onViewChange,
  isAdmin,
  canSettle,
  onAdd,
  onSelect,
  onStartOrder,
  onSettle,
  onEdit,
}: Props) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Regulars &amp; tabs</h2>
          <p className="mt-1 text-[13px] text-muted">
            Monthly customer cards for regulars who settle at the end of the month.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={onAdd}>
            <UserPlus className="h-4 w-4" /> New customer
          </Button>
        )}
      </div>

      {!isAdmin && (
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3 text-[12px] leading-relaxed text-muted">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600" />
          <span>
            {canSettle
              ? 'You can start an order or take a payment from any card.'
              : 'You can start an order from any card. Taking payments needs the settlement permission — ask your manager.'}{' '}
            Customer details and credit limits can only be edited by an admin.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Regulars" value={String(customers.length)} icon={<Users className="h-4 w-4" />} />
        <SummaryTile
          label="Outstanding"
          value={money(totalOutstanding)}
          icon={<Wallet className="h-4 w-4" />}
          accent
        />
        <SummaryTile label="Open tabs" value={String(debtors)} icon={<HandCoins className="h-4 w-4" />} />
        <SummaryTile
          label="Collected this month"
          value={money(collectedThisMonth)}
          icon={<Banknote className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by name or phone…"
            className="pl-9"
          />
        </div>
        <Segmented
          value={view}
          onChange={onViewChange}
          size="sm"
          options={[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open tabs' },
            { value: 'settled', label: 'Settled' },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={customers.length ? 'No customers match' : 'No regulars yet'}
            description={
              customers.length
                ? 'Try a different name, phone number or filter.'
                : 'Create a profile for regulars who pay at the end of the month.'
            }
            action={
              isAdmin && !customers.length ? (
                <Button size="sm" onClick={onAdd}>
                  <Plus className="h-4 w-4" /> Add customer
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((customer) => {
            const balance = balanceFor(ledger, customer.id)
            const percentage =
              customer.limit > 0 ? Math.min(100, (balance / customer.limit) * 100) : 0
            const overLimit = customer.limit > 0 && balance > customer.limit
            return (
              <div
                key={customer.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-line/80 bg-white transition hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-[0_6px_20px_rgba(36,30,25,0.06)]"
              >
                <button onClick={() => onSelect(customer)} className="flex-1 p-4 text-left">
                  <div className="flex items-start gap-3">
                    <Avatar name={customer.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-bold text-ink">{customer.name}</div>
                      <div className="mt-0.5 truncate text-[11.5px] text-muted">
                        {customer.phone || 'No phone'}
                      </div>
                    </div>
                    {balance > 0 ? (
                      <Badge tone={overLimit ? 'danger' : 'accent'}>
                        {overLimit ? 'Over limit' : 'Tab open'}
                      </Badge>
                    ) : (
                      <Badge tone="success">Settled</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">
                        Outstanding
                      </div>
                      <div
                        className={cn(
                          'text-[19px] font-extrabold tracking-tight tabular',
                          balance > 0 ? (overLimit ? 'text-red-500' : 'text-ink') : 'text-muted',
                        )}
                      >
                        {money(balance)}
                      </div>
                    </div>
                    <div className="text-right text-[10.5px] text-muted">
                      limit {money(customer.limit)}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        overLimit ? 'bg-red-400' : 'bg-accent-500',
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-dashed border-line/70 pt-2.5">
                    <span className="inline-flex min-w-0 items-center gap-1 text-[10.5px] font-semibold text-muted">
                      <CalendarClock className="h-3 w-3 shrink-0 text-accent-600" />
                      <span className="truncate">
                        {cycleLabel(customer.cycle)} · {nextDueLabel(customer.cycle)}
                      </span>
                    </span>
                    {customer.notes && (
                      <span className="max-w-[45%] truncate text-[10.5px] italic text-muted">
                        “{customer.notes}”
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-1 border-t border-line/60 bg-cream-50/70 px-2 py-1.5">
                  <button
                    onClick={() => onStartOrder(customer.id)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-ink transition hover:bg-white hover:text-accent-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> New order
                  </button>
                  {canSettle && balance > 0 && (
                    <button
                      onClick={() => onSettle(customer.id)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-accent-700 transition hover:bg-accent-50"
                    >
                      <HandCoins className="h-3.5 w-3.5" /> Take payment
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => onEdit(customer)}
                      className="rounded-lg p-1.5 text-muted transition hover:bg-white hover:text-ink"
                      title="Edit customer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function SummaryTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent?: boolean
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl',
          accent ? 'bg-accent-50 text-accent-600' : 'bg-cream-100 text-muted',
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="text-[16px] font-extrabold tracking-tight tabular">{value}</div>
      </div>
    </Card>
  )
}

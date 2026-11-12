import {
  Banknote,
  Calculator,
  CircleDollarSign,
  CreditCard,
  FileText,
  HandCoins,
  History,
  Info,
  Lock,
  Play,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '../../../components/ui'
import { money, fmtDateTime } from '../../../lib/utils'
import { registerBreakdown, sessionSnapshot } from '../../../lib/reports'
import type { RegisterSession } from '../../../types'
import { Tile } from './RegisterParts'

type Snapshot = NonNullable<ReturnType<typeof sessionSnapshot>>
type Breakdown = ReturnType<typeof registerBreakdown>

export function LiveRegister({
  open,
  anyOpen,
  canSeeAll,
  liveSnapshot,
  liveBreakdown,
  onOpen,
}: {
  open: RegisterSession | null
  anyOpen: RegisterSession | null
  canSeeAll: boolean
  liveSnapshot: Snapshot | null
  liveBreakdown: Breakdown | null
  onOpen: () => void
}) {
  if (!open || !liveSnapshot) {
    return (
      <>
        {!canSeeAll && !open && anyOpen && (
          <Card className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Info className="h-4 w-4" />
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted">
              A register session is currently open by{' '}
              <span className="font-semibold text-ink">{anyOpen.openedByName}</span>. You only see the
              sessions you open yourself. Your manager can make you a shift supervisor to see the
              whole team.
            </p>
          </Card>
        )}
        <Card>
          <EmptyState
            icon={<Lock className="h-5 w-5" />}
            title="Register is closed"
            description="Open a session with the cash in the drawer before the first sale of the day."
            action={
              <Button size="sm" onClick={onOpen}>
                <Play className="h-4 w-4" /> Open register
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-bold text-ink">Register open</span>
              <Badge tone="success">Live</Badge>
            </div>
            <div className="text-[11.5px] text-muted">
              Opened {fmtDateTime(open.openedAt)} · {open.openedByName} · opening cash{' '}
              {money(open.openingCash)}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">
            Expected cash in drawer
          </div>
          <div className="text-[22px] font-extrabold tracking-tight tabular text-ink">
            {money(liveSnapshot.expectedCash)}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Transactions" value={String(liveSnapshot.ordersCount)} icon={<FileText className="h-4 w-4" />} />
        <Tile label="Total sales" value={money(liveSnapshot.salesTotal)} icon={<Banknote className="h-4 w-4" />} accent />
        <Tile label="Cash sales" value={money(liveSnapshot.cashSales)} icon={<CircleDollarSign className="h-4 w-4" />} />
        <Tile label="Card sales" value={money(liveSnapshot.cardSales)} icon={<CreditCard className="h-4 w-4" />} />
        <Tile label="Tab sales" value={money(liveSnapshot.creditSales)} icon={<Wallet className="h-4 w-4" />} />
        <Tile label="Tab payments" value={money(liveSnapshot.cashSettlements + liveSnapshot.cardSettlements)} icon={<HandCoins className="h-4 w-4" />} />
        <Tile label="Discounts" value={money(liveSnapshot.discounts)} icon={<TrendingDown className="h-4 w-4" />} />
        <Tile label="Expenses paid" value={money(liveSnapshot.expenses)} icon={<TrendingUp className="h-4 w-4" />} />
        <Tile label="Tax collected" value={money(liveSnapshot.tax)} icon={<Calculator className="h-4 w-4" />} />
        <Tile label="Service charge" value={money(liveSnapshot.service)} icon={<Calculator className="h-4 w-4" />} />
        <Tile
          label="Voided"
          value={`${liveSnapshot.voidedCount} · ${money(liveSnapshot.voidedTotal)}`}
          icon={<History className="h-4 w-4" />}
        />
        <Tile label="Cash refunds" value={money(liveSnapshot.cashRefunds)} icon={<TrendingDown className="h-4 w-4" />} />
      </div>

      {liveBreakdown && (liveBreakdown.byEmployee.length > 0 || liveBreakdown.byCategory.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-2 text-[12.5px] font-bold text-ink">Sales by employee</div>
            {liveBreakdown.byEmployee.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-muted">No sales yet.</p>
            ) : (
              <div className="divide-y divide-line/60">
                {liveBreakdown.byEmployee.map((employee) => (
                  <div key={employee.name} className="flex items-center justify-between py-2 text-[12.5px]">
                    <span className="font-semibold text-ink">{employee.name}</span>
                    <span className="text-muted">{employee.count} orders</span>
                    <span className="font-bold tabular">{money(employee.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-[12.5px] font-bold text-ink">Sales by category</div>
            {liveBreakdown.byCategory.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-muted">No sales yet.</p>
            ) : (
              <div className="divide-y divide-line/60">
                {liveBreakdown.byCategory.map((category) => (
                  <div key={category.name} className="flex items-center justify-between py-2 text-[12.5px]">
                    <span className="font-semibold text-ink">{category.name}</span>
                    <span className="text-muted">{category.qty} items</span>
                    <span className="font-bold tabular">{money(category.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  )
}

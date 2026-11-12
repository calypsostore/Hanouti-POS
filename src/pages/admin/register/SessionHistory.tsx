import { CalendarDays, Clock, Printer } from 'lucide-react'
import { Badge, Button, Card, Drawer, EmptyState } from '../../../components/ui'
import type { RegisterSession } from '../../../types'
import { fmtDate, fmtTime, money } from '../../../lib/utils'
import { registerBreakdown } from '../../../lib/reports'
import { Row } from './RegisterParts'

type Breakdown = ReturnType<typeof registerBreakdown>

export function SessionHistory({
  closed,
  viewing,
  canSeeAll,
  viewingBreakdown,
  onView,
  onCloseView,
  onPrint,
}: {
  closed: RegisterSession[]
  viewing: RegisterSession | null
  canSeeAll: boolean
  viewingBreakdown: Breakdown | null
  onView: (sessionId: string) => void
  onCloseView: () => void
  onPrint: (session: RegisterSession) => void
}) {
  return (
    <>
      <div>
        <div className="mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted" />
          <h3 className="text-[13.5px] font-bold text-ink">
            {canSeeAll ? 'Closed sessions (Z history)' : 'Your closed shifts'}
          </h3>
          <Badge tone="neutral">{closed.length}</Badge>
        </div>
        <Card>
          {closed.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title={canSeeAll ? 'No closed sessions yet' : 'No closed shifts yet'}
              description={
                canSeeAll
                  ? 'Z reports you close will be listed here, frozen as they were printed.'
                  : 'Open the register and close it at the end of your shift — your Z reports will appear here.'
              }
            />
          ) : (
            <div className="divide-y divide-line/60">
              {closed.map((session) => {
                const difference = session.difference ?? 0
                return (
                  <div key={session.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-ink">
                        {fmtDate(session.closedAt ?? session.openedAt)} · {fmtTime(session.openedAt)} →{' '}
                        {fmtTime(session.closedAt ?? session.openedAt)}
                      </div>
                      <div className="text-[10.5px] text-muted">
                        {session.closedByName ?? ''} · expected {money(session.snapshot?.expectedCash ?? 0)} · counted{' '}
                        {money(session.countedCash ?? 0)}
                      </div>
                    </div>
                    <Badge tone={difference === 0 ? 'success' : Math.abs(difference) < 5 ? 'info' : 'danger'}>
                      {difference >= 0 ? '+' : ''}
                      {money(difference)}
                    </Badge>
                    <div className="flex gap-1">
                      <Button variant="secondary" size="sm" onClick={() => onView(session.id)}>
                        View
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onPrint(session)}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Drawer
        open={!!viewing}
        onClose={onCloseView}
        title={viewing ? `Z report · ${fmtDate(viewing.closedAt ?? viewing.openedAt)}` : ''}
        subtitle={viewing ? `Session ${viewing.id}` : ''}
        footer={
          viewing ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onCloseView}>
                Close
              </Button>
              <Button onClick={() => onPrint(viewing)}>
                <Printer className="h-4 w-4" /> Print Z report
              </Button>
            </div>
          ) : null
        }
      >
        {viewing && viewing.snapshot && (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">Counted cash</div>
                <div className="mt-1 text-[18px] font-extrabold tabular">{money(viewing.countedCash ?? 0)}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">Difference</div>
                <div
                  className={`mt-1 text-[18px] font-extrabold tabular ${
                    (viewing.difference ?? 0) === 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {(viewing.difference ?? 0) >= 0 ? '+' : ''}
                  {money(viewing.difference ?? 0)}
                </div>
              </div>
            </div>
            <div className="space-y-1 rounded-xl border border-line bg-white p-4 text-[12.5px]">
              <Row label="Opened" value={`${fmtDate(viewing.openedAt)} ${fmtTime(viewing.openedAt)} · ${viewing.openedByName}`} />
              <Row label="Closed" value={`${fmtDate(viewing.closedAt ?? '')} ${fmtTime(viewing.closedAt ?? '')} · ${viewing.closedByName ?? ''}`} />
              <Row label="Opening cash" value={money(viewing.openingCash)} />
              <Row label="Transactions" value={String(viewing.snapshot.ordersCount)} />
              <Row label="Total sales" value={money(viewing.snapshot.salesTotal)} />
              <Row label="Cash / card / tab" value={`${money(viewing.snapshot.cashSales)} / ${money(viewing.snapshot.cardSales)} / ${money(viewing.snapshot.creditSales)}`} />
              <Row label="Tab payments" value={money(viewing.snapshot.cashSettlements + viewing.snapshot.cardSettlements)} />
              <Row label="Voided orders" value={`${viewing.snapshot.voidedCount} · ${money(viewing.snapshot.voidedTotal)}`} />
              <Row label="Discounts" value={money(viewing.snapshot.discounts)} />
              <Row label="Tax / service" value={`${money(viewing.snapshot.tax)} / ${money(viewing.snapshot.service)}`} />
              <Row label="Expenses paid" value={money(viewing.snapshot.expenses)} />
              <Row label="Expected cash" value={money(viewing.snapshot.expectedCash)} />
              {viewing.note && <Row label="Note" value={viewing.note} />}
            </div>
            {viewingBreakdown && (
              <div className="space-y-1 rounded-xl border border-line bg-white p-4 text-[12.5px]">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {canSeeAll ? 'By employee' : 'Your sales in this session'}
                </div>
                {viewingBreakdown.byEmployee.length === 0 && (
                  <p className="text-muted">No sales in this window.</p>
                )}
                {viewingBreakdown.byEmployee.map((employee) => (
                  <div key={employee.name} className="flex justify-between">
                    <span>{employee.name} ({employee.count})</span>
                    <span className="font-semibold tabular">{money(employee.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  )
}

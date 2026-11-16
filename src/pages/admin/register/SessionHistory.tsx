import { CalendarDays, Clock, Printer } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '../../../components/ui'
import { RegisterItemsTable } from '../../../components/RegisterItemsTable'
import type { RegisterItemsReport, RegisterSession } from '../../../types'
import { fmtDate, fmtTime, money } from '../../../lib/utils'

export function SessionHistory({
  closed,
  canSeeAll,
  itemsForSession,
  onPrint,
}: {
  closed: RegisterSession[]
  canSeeAll: boolean
  itemsForSession: (session: RegisterSession) => {
    report: RegisterItemsReport
    rebuiltFromOrders: boolean
  }
  onPrint: (session: RegisterSession, kind: 'X' | 'Z') => void
}) {
  return (
    <>
      <div>
        <div className="mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted" />
          <h3 className="text-[13.5px] font-bold text-ink">
            {canSeeAll ? 'Closed staff shifts' : 'Your closed shifts'}
          </h3>
          <Badge tone="neutral">{closed.length}</Badge>
        </div>
        <Card>
          {closed.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="No closed shifts yet"
              description="Staff can open and close their own shifts. The owner closes and freezes the store-day Z after all shifts are finished."
            />
          ) : (
            <div className="divide-y divide-line/60">
              {closed.map((session) => {
                const difference = session.difference ?? 0
                const itemDetails = itemsForSession(session)
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
                      <Button
                        variant="secondary"
                        size="sm"
                        title="Preview or reprint this frozen shift X report"
                        onClick={() => onPrint(session, 'X')}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span className="sm:inline">X report</span>
                      </Button>
                      {session.zReportNumber !== undefined && (
                        <Button
                          variant="secondary"
                          size="sm"
                          title="Reprint this legacy frozen Z report"
                          onClick={() => onPrint(session, 'Z')}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span className="sm:inline">Z report</span>
                        </Button>
                      )}
                    </div>
                    <details className="basis-full">
                      <summary className="cursor-pointer text-[11px] font-semibold text-accent-foreground">
                        Items in this shift report
                      </summary>
                      <div className="mt-2">
                        <RegisterItemsTable
                          report={itemDetails.report}
                          title="Shift report item detail"
                          rebuiltFromOrders={itemDetails.rebuiltFromOrders}
                        />
                      </div>
                    </details>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

    </>
  )
}

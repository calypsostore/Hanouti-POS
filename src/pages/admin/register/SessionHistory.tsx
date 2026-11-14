import { CalendarDays, Clock, Printer } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '../../../components/ui'
import type { RegisterSession } from '../../../types'
import { fmtDate, fmtTime, money } from '../../../lib/utils'

export function SessionHistory({
  closed,
  canSeeAll,
  onPrint,
}: {
  closed: RegisterSession[]
  canSeeAll: boolean
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
                      <Button
                        variant="secondary"
                        size="sm"
                        title="Preview or reprint this frozen Z report"
                        onClick={() => onPrint(session)}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span className="sm:inline">Z report</span>
                      </Button>
                    </div>
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

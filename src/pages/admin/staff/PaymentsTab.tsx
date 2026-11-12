import { useMemo } from 'react'
import type { Database, User } from '../../../types'
import { Badge, Card } from '../../../components/ui'
import { getStaffPaymentTotals } from '../../../lib/staffDetails'
import { fmtDate, fmtDateTime, money } from '../../../lib/utils'

export default function PaymentsTab({ member, db, storeId }: { member: User; db: Database; storeId: string }) {
  const payrolls = useMemo(
    () => db.payrolls.filter((entry) => entry.storeId === storeId && entry.userId === member.id)
      .sort((a, b) => b.month.localeCompare(a.month)),
    [db.payrolls, member.id, storeId],
  )
  const advances = useMemo(
    () => db.advances.filter((entry) => entry.storeId === storeId && entry.userId === member.id)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [db.advances, member.id, storeId],
  )
  const totals = getStaffPaymentTotals(payrolls, advances)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Total paid</div>
          <div className="mt-1 text-[20px] font-extrabold tabular text-ink">{money(totals.totalPaid)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Outstanding advances</div>
          <div className="mt-1 text-[20px] font-extrabold tabular text-ink">{money(totals.outstandingAdvances)}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line/70 px-4 py-3">
          <h3 className="text-[13px] font-bold text-ink">Payroll history</h3>
        </div>
        {payrolls.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12px]">
              <thead className="bg-cream-100/70 text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  {['Month', 'Days', 'Earned', 'Advances deducted', 'Net paid', 'Paid at', 'Paid by'].map((label) => (
                    <th key={label} className="px-3 py-2.5 font-bold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {payrolls.map((payroll) => {
                  const paidBy = db.users.find((candidate) => candidate.id === payroll.paidBy)?.name ?? 'Unknown'
                  return (
                    <tr key={payroll.id}>
                      <td className="px-3 py-2.5 font-semibold text-ink">
                        {new Date(`${payroll.month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-2.5">{payroll.daysWorked}</td>
                      <td className="px-3 py-2.5 tabular">{money(payroll.earned)}</td>
                      <td className="px-3 py-2.5 tabular">{money(payroll.advancesDeducted)}</td>
                      <td className="px-3 py-2.5 font-semibold tabular">{money(payroll.netPaid)}</td>
                      <td className="px-3 py-2.5 text-muted">{fmtDateTime(payroll.paidAt)}</td>
                      <td className="px-3 py-2.5">{paidBy}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="p-5 text-center text-[12px] text-muted">No salary payments recorded.</p>}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line/70 px-4 py-3">
          <h3 className="text-[13px] font-bold text-ink">Advances</h3>
        </div>
        {advances.length ? (
          <div className="divide-y divide-line/60">
            {advances.map((advance) => (
              <div key={advance.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-ink">{fmtDate(advance.date)}</div>
                  {advance.note && <div className="mt-0.5 text-[11px] text-muted">{advance.note}</div>}
                </div>
                <span className="text-[12px] font-bold tabular">{money(advance.amount)}</span>
                <Badge tone={advance.status === 'open' ? 'warning' : 'neutral'}>
                  {advance.status === 'open' ? 'Open' : 'Deducted'}
                </Badge>
              </div>
            ))}
          </div>
        ) : <p className="p-5 text-center text-[12px] text-muted">No advances recorded.</p>}
      </Card>
    </div>
  )
}

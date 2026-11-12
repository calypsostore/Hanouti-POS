import { useMemo, useState } from 'react'
import type { Database, Store, User } from '../../../types'
import { Badge, Card, Field, Input } from '../../../components/ui'
import { getAttendanceMonth, getAttendanceMonthSummary } from '../../../lib/staffDetails'
import { fmtDate, fmtTime } from '../../../lib/utils'

export default function AttendanceTab({ member, db, store }: { member: User; db: Database; store: Store }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const records = useMemo(
    () => db.attendance.filter((entry) => entry.storeId === store.id && entry.userId === member.id),
    [db.attendance, member.id, store.id],
  )
  const days = getAttendanceMonth(records, store.settings.payroll, month)
  const summary = getAttendanceMonthSummary(days)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Card className="min-w-32 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Days worked</div>
            <div className="mt-1 text-[17px] font-extrabold text-ink">{summary.daysWorked}</div>
          </Card>
          <Card className="min-w-32 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Hours recorded</div>
            <div className="mt-1 text-[17px] font-extrabold text-ink">{summary.hours} h</div>
          </Card>
        </div>
        <Field label="Month">
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <Badge tone="success">Full: {summary.fullDays}</Badge>
        <Badge tone="warning">Half: {summary.halfDays}</Badge>
        <Badge tone="danger">Absent: {summary.absentDays}</Badge>
      </div>
      <Card className="overflow-hidden">
        {days.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-[12px]">
              <thead className="bg-cream-100/70 text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  {['Date', 'Clock in', 'Clock out', 'Hours', 'Status', 'Source'].map((label) => (
                    <th key={label} className="px-3 py-2.5 font-bold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {days.map((day) => (
                  <tr key={day.date}>
                    <td className="px-3 py-2.5 font-semibold text-ink">{fmtDate(`${day.date}T12:00:00`)}</td>
                    <td className="px-3 py-2.5">{day.clockIn ? fmtTime(day.clockIn) : '—'}</td>
                    <td className="px-3 py-2.5">{day.clockOut ? fmtTime(day.clockOut) : 'Open'}</td>
                    <td className="px-3 py-2.5 tabular">{day.hours} h</td>
                    <td className="px-3 py-2.5 capitalize">{day.status}</td>
                    <td className="px-3 py-2.5 capitalize text-muted">{day.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="p-8 text-center text-[12px] text-muted">No attendance for {month}.</p>}
      </Card>
      <p className="text-[11px] text-muted">Attendance corrections are available from the Payroll tab on the Expenses page.</p>
    </div>
  )
}

import { useState } from 'react'
import { CalendarDays, Clock3, Plus, Wallet, X } from 'lucide-react'
import { Avatar, Badge, Button, Card, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import { useToast } from '../../components/toast'
import { estimatePayroll, summarizeAttendanceDay } from '../../lib/payroll'
import { dateKey, money } from '../../lib/utils'
import { useApp } from '../../store/AppStore'
import type { AttendanceStatus, User } from '../../types'
import { can } from '../../lib/permissions'

const monthToday = () => dateKey(new Date()).slice(0, 7)
const monthDates = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const count = new Date(year, monthNumber, 0).getDate()
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
}
const statusLabel = (status: AttendanceStatus) =>
  status === 'present' ? 'Full day' : status === 'half' ? 'Half day' : 'Absent'

export default function PayrollTab() {
  const {
    db, store, user, addAdvance, paySalary, saveManualAttendance,
  } = useApp()
  const { push } = useToast()
  const canManagePayroll = user ? can(user, 'managePayroll') : false
  const [today] = useState(() => dateKey(new Date()))
  const [month, setMonth] = useState(monthToday)
  const [selected, setSelected] = useState<User | null>(null)
  const [advanceFromDetails, setAdvanceFromDetails] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [advanceDate, setAdvanceDate] = useState(() => dateKey(new Date()))
  const [advanceNote, setAdvanceNote] = useState('')
  const [editDay, setEditDay] = useState<string | null>(null)
  const [dayStatus, setDayStatus] = useState<AttendanceStatus>('present')
  const [clockIn, setClockIn] = useState('08:00')
  const [clockOut, setClockOut] = useState('14:00')
  const [dayNote, setDayNote] = useState('')

  const staff = db.users.filter((candidate) =>
    candidate.storeId === store?.id && candidate.role === 'staff',
  )
  const ownStaff = user?.role === 'staff'
    ? staff.filter((candidate) => candidate.id === user.id)
    : staff
  const rows = ownStaff.map((member) => {
    const records = db.attendance.filter((record) =>
      record.storeId === store?.id && record.userId === member.id && record.date.startsWith(month),
    )
    const advances = db.advances.filter((advance) =>
      advance.storeId === store?.id && advance.userId === member.id,
    )
    const openAdvances = advances.filter((advance) => advance.status === 'open')
    const estimate = estimatePayroll(
      member,
      records,
      openAdvances.map((advance) => advance.amount),
      store?.settings.payroll ?? {
        workingDaysPerMonth: 26, fullDayHours: 6, halfDayHours: 3, autoCloseHours: 14,
      },
      month,
    )
    const paid = db.payrolls.some((payroll) =>
      payroll.storeId === store?.id && payroll.userId === member.id && payroll.month === month,
    )
    const payrollRecord = db.payrolls.find((payroll) =>
      payroll.storeId === store?.id && payroll.userId === member.id && payroll.month === month,
    )
    return { member, records, advances, estimate, paid, payrollRecord }
  })

  if (!store || !user) return null

  const saveAdvance = () => {
    if (!selected) return
    const result = addAdvance(store.id, selected.id, {
      amount: Number(advanceAmount),
      date: advanceDate,
      note: advanceNote,
    })
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Advance recorded and added to expenses')
    setAdvanceOpen(false)
    if (!advanceFromDetails) setSelected(null)
    setAdvanceAmount('')
    setAdvanceNote('')
  }

  const editAttendance = (date: string, member: User) => {
    const summary = summarizeAttendanceDay(
      db.attendance.filter((record) =>
        record.storeId === store.id && record.userId === member.id && record.date === date,
      ),
      store.settings.payroll,
      date,
    )
    setDayStatus(summary?.status ?? 'present')
    const first = summary?.records[0]
    setClockIn(first ? new Date(first.clockIn).toTimeString().slice(0, 5) : '08:00')
    setClockOut(first?.clockOut ? new Date(first.clockOut).toTimeString().slice(0, 5) : '14:00')
    setDayNote(first?.note ?? '')
    setEditDay(date)
  }

  const saveAttendance = () => {
    if (!selected || !editDay) return
    const result = saveManualAttendance(store.id, selected.id, {
      date: editDay,
      status: dayStatus,
      clockIn,
      clockOut,
      note: dayNote,
    })
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Attendance updated')
    setEditDay(null)
  }

  const giveAdvance = (member: User) => {
    setAdvanceFromDetails(false)
    setSelected(member)
    setAdvanceOpen(true)
  }

  const payMember = (member: User) => {
    const result = paySalary(store.id, member.id, month)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Salary paid and recorded as an expense')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold">{canManagePayroll ? 'Team payroll' : 'My pay & attendance'}</h3>
          <p className="mt-1 text-[12px] text-muted">
            {canManagePayroll ? 'Attendance, advances and monthly salary settlement.' : 'Your attendance and open salary advances.'}
          </p>
        </div>
        <Field label="Payroll month">
          <Input className="w-[165px]" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">No active team members.</Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map(({ member, records, advances, estimate, paid, payrollRecord }) => (
            <Card key={member.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar name={member.name} photo={member.photo} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[14px] font-bold">{member.name}</div>
                    {paid && <Badge tone="success">Paid</Badge>}
                    {!member.active && <Badge tone="neutral">Inactive</Badge>}
                  </div>
                  <div className="text-[11px] text-muted">
                    {member.salaryType === 'none' ? 'Salary not set' : `${member.salaryType} · ${money(member.salaryAmount)}`}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Worked" value={String(estimate.daysWorked)} detail={`${estimate.fullDays} full · ${estimate.halfDays} half · ${estimate.absentDays} absent`} />
                <Metric label="Earned" value={money(payrollRecord?.earned ?? estimate.earned)} />
                <Metric
                  label={paid ? 'Advances deducted' : 'Open advances'}
                  value={money(payrollRecord?.advancesDeducted ?? estimate.openAdvances)}
                />
                <Metric label={paid ? 'Net paid' : 'Net due'} value={money(payrollRecord?.netPaid ?? estimate.netDue)} />
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line/60 pt-3">
                {canManagePayroll && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => giveAdvance(member)}>
                      <Plus className="h-3.5 w-3.5" /> Give advance
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setAdvanceFromDetails(true); setSelected(member) }}>
                      <CalendarDays className="h-3.5 w-3.5" /> Details
                    </Button>
                    <Button size="sm" disabled={paid || member.salaryType === 'none'} onClick={() => payMember(member)}>
                      <Wallet className="h-3.5 w-3.5" /> Pay salary
                    </Button>
                  </>
                )}
              </div>
              {user.role === 'staff' && advances.length > 0 && (
                <div className="mt-3 border-t border-line/60 pt-3 text-[12px]">
                  <div className="mb-1 font-semibold">Advances</div>
                  {advances.map((advance) => (
                    <div key={advance.id} className="flex justify-between gap-2 text-muted">
                      <span>{dateKey(advance.date)} · {advance.note || 'Salary advance'} · {advance.status}</span>
                      <strong>{money(advance.amount)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {user.role === 'staff' && (
                <div className="mt-3 border-t border-line/60 pt-3 text-[12px]">
                  <div className="mb-2 font-semibold">Attendance</div>
                  <div className="flex flex-wrap gap-1.5">
                    {monthDates(month).map((date) => {
                      const day = summarizeAttendanceDay(records, store.settings.payroll, date)
                      if (!day) return null
                      return <Badge key={date} tone={day.status === 'present' ? 'success' : day.status === 'half' ? 'warning' : 'neutral'}>{date.slice(-2)} {statusLabel(day.status)}</Badge>
                    })}
                    {!records.length && <span className="text-muted">No attendance for this month.</span>}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {selected && canManagePayroll && !advanceOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payroll-details-title"
          className="fixed inset-0 z-40 bg-black/35"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null)
          }}
        >
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-y-auto bg-white p-4 shadow-2xl dark:bg-espresso-900 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 id="payroll-details-title" className="text-[17px] font-bold">{selected.name}</h3>
                <p className="text-[12px] text-muted">{month} · Daily attendance and advances</p>
              </div>
              <Button variant="secondary" size="icon" aria-label="Close details" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {monthDates(month).map((date) => {
                const summary = summarizeAttendanceDay(
                  db.attendance.filter((record) =>
                    record.storeId === store.id && record.userId === selected.id && record.date.startsWith(month),
                  ),
                  store.settings.payroll,
                  date,
                )
                return (
                  <button
                    type="button"
                    key={date}
                    disabled={date > today}
                    onClick={() => editAttendance(date, selected)}
                    className={`min-h-[64px] rounded-xl border p-1.5 text-left text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${summary?.status === 'present' ? 'border-emerald-200 bg-emerald-50' : summary?.status === 'half' ? 'border-amber-200 bg-amber-50' : summary ? 'border-line bg-cream-50' : 'border-line/60 bg-white'}`}
                  >
                    <span className="font-bold">{date.slice(-2)}</span>
                    {summary && <span className="mt-1 block">{summary.hours}h · {statusLabel(summary.status)}</span>}
                  </button>
                )
              })}
            </div>
            <div className="mt-6 space-y-3">
              <h4 className="text-[13px] font-bold">Advances</h4>
              {db.advances.filter((advance) =>
                advance.storeId === store.id && advance.userId === selected.id,
              ).map((advance) => (
                <div key={advance.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream-50 p-2.5 text-[12px]">
                  <span>{dateKey(advance.date)} · {advance.note || 'Salary advance'} <Badge tone={advance.status === 'open' ? 'warning' : 'neutral'}>{advance.status}</Badge></span>
                  <strong>{money(advance.amount)}</strong>
                </div>
              ))}
              {!db.advances.some((advance) => advance.storeId === store.id && advance.userId === selected.id) &&
                <p className="text-[12px] text-muted">No advances recorded.</p>}
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => { setAdvanceFromDetails(true); setAdvanceOpen(true); setEditDay(null) }}><Plus className="h-4 w-4" /> Give advance</Button>
            </div>
          </aside>
        </div>
      )}

      {advanceOpen && selected && canManagePayroll && (
        <Modal
          open
          onClose={() => {
            setAdvanceOpen(false)
            if (!advanceFromDetails) setSelected(null)
          }}
          title={`Give advance · ${selected.name}`}
          subtitle="The advance is recorded in payroll and immediately added as a cash expense."
          size="sm"
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => {
            setAdvanceOpen(false)
            if (!advanceFromDetails) setSelected(null)
          }}>Cancel</Button><Button disabled={!Number(advanceAmount) || Number(advanceAmount) <= 0} onClick={saveAdvance}>Record advance</Button></div>}
        >
          <div className="space-y-3.5">
            <Field label="Amount (DT)"><Input type="number" min="0.001" step="0.001" value={advanceAmount} onChange={(event) => setAdvanceAmount(event.target.value)} autoFocus /></Field>
            <Field label="Date"><Input type="date" value={advanceDate} onChange={(event) => setAdvanceDate(event.target.value)} /></Field>
            <Field label="Note" hint="Optional"><Textarea value={advanceNote} onChange={(event) => setAdvanceNote(event.target.value)} placeholder="Advance details" /></Field>
          </div>
        </Modal>
      )}

      {editDay && selected && canManagePayroll && (
        <Modal
          open
          onClose={() => setEditDay(null)}
          title={`Edit attendance · ${editDay}`}
          subtitle="Manual changes are included in the activity log."
          size="sm"
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditDay(null)}>Cancel</Button><Button onClick={saveAttendance}>Save attendance</Button></div>}
        >
          <div className="space-y-3.5">
            <Field label="Status">
              <Select value={dayStatus} onChange={(event) => setDayStatus(event.target.value as AttendanceStatus)}>
                <option value="present">Full day</option>
                <option value="half">Half day</option>
                <option value="absent">Absent</option>
              </Select>
            </Field>
            {dayStatus !== 'absent' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Clock in"><Input type="time" value={clockIn} onChange={(event) => setClockIn(event.target.value)} /></Field>
                <Field label="Clock out"><Input type="time" value={clockOut} onChange={(event) => setClockOut(event.target.value)} /></Field>
              </div>
            )}
            <Field label="Note"><Textarea value={dayNote} onChange={(event) => setDayNote(event.target.value)} placeholder="Reason or correction" /></Field>
          </div>
        </Modal>
      )}

      {canManagePayroll && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <Clock3 className="h-3.5 w-3.5" /> Staff clock in on sign-in, clock out on logout, and refresh activity every minute.
        </p>
      )}
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-cream-50 p-2.5">
      <div className="text-[9px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 truncate text-[12px] font-extrabold tabular">{value}</div>
      {detail && <div className="mt-0.5 truncate text-[9px] text-muted">{detail}</div>}
    </div>
  )
}

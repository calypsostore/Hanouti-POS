import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Database, Shift, Store, User } from '../../../types'
import { useApp } from '../../../store/AppStore'
import { useToast } from '../../../components/toast'
import { Badge, Button, Card, Field, Input, Modal } from '../../../components/ui'
import { addDays, getAttendanceMonth, getPlannedShiftHours, getWeekDates } from '../../../lib/staffDetails'
import { dateKey, fmtDate } from '../../../lib/utils'
import { summarizeAttendanceDay } from '../../../lib/payroll'

export default function ScheduleTab({ member, db, store }: { member: User; db: Database; store: Store }) {
  const { addShift, updateShift, deleteShift } = useApp()
  const { push } = useToast()
  const [weekAnchor, setWeekAnchor] = useState(() => dateKey(new Date()))
  const [editor, setEditor] = useState<{ shift?: Shift } | null>(null)
  const dates = getWeekDates(weekAnchor)
  const records = useMemo(
    () => db.attendance.filter((entry) => entry.storeId === store.id && entry.userId === member.id),
    [db.attendance, member.id, store.id],
  )
  const shifts = useMemo(
    () => db.shifts.filter((entry) => entry.storeId === store.id && entry.userId === member.id && dates.includes(entry.date))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [db.shifts, dates, member.id, store.id],
  )
  const attendanceByDay = getAttendanceMonth(records, store.settings.payroll, weekAnchor.slice(0, 7))
  const attendanceMap = new Map(attendanceByDay.map((day) => [day.date, day]))
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('14:00')
  const [note, setNote] = useState('')

  const openEditor = (day: string, shift?: Shift) => {
    setDate(shift?.date ?? day)
    setStartTime(shift?.startTime ?? '08:00')
    setEndTime(shift?.endTime ?? '14:00')
    setNote(shift?.note ?? '')
    setEditor({ shift })
  }
  const closeEditor = () => setEditor(null)
  const save = () => {
    if (!editor) return
    const data = { date, startTime, endTime, note }
    const result = editor.shift
      ? updateShift(editor.shift.id, data)
      : addShift(store.id, member.id, data)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(editor.shift ? 'Shift updated' : 'Shift added')
    closeEditor()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-bold text-ink">Weekly schedule</h3>
          <p className="mt-1 text-[11px] text-muted">
            {fmtDate(`${dates[0]}T12:00:00`)} – {fmtDate(`${dates[6]}T12:00:00`)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="secondary" aria-label="Previous week" onClick={() => setWeekAnchor(addDays(dates[0], -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setWeekAnchor(dateKey(new Date()))}>This week</Button>
          <Button size="icon" variant="secondary" aria-label="Next week" onClick={() => setWeekAnchor(addDays(dates[0], 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {dates.map((day) => {
          const dayShifts = shifts.filter((shift) => shift.date === day)
          const attendance = summarizeAttendanceDay(records, store.settings.payroll, day)
          const actualHours = attendanceMap.get(day)?.hours ?? attendance?.hours
          return (
            <Card key={day} className="min-w-0 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-ink">
                    {new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}
                  </div>
                  <div className="text-[10px] text-muted">{fmtDate(`${day}T12:00:00`)}</div>
                </div>
                <Button size="icon" variant="ghost" aria-label={`Add shift on ${day}`} onClick={() => openEditor(day)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="my-2 rounded-lg bg-cream-100/70 p-2 text-[10px] text-muted">
                <div>Planned: <strong className="text-ink">{getPlannedShiftHours(dayShifts)} h</strong></div>
                <div>Actual: <strong className="text-ink">{actualHours === undefined ? '—' : `${actualHours} h`}</strong></div>
              </div>
              <div className="space-y-2">
                {dayShifts.map((shift) => (
                  <div key={shift.id} className="rounded-lg border border-line/70 p-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-ink">{shift.startTime}–{shift.endTime}</span>
                      <div className="flex shrink-0">
                        <button type="button" aria-label="Edit shift" onClick={() => openEditor(day, shift)} className="rounded p-1 text-muted hover:text-ink">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete shift"
                          onClick={() => {
                            const result = deleteShift(shift.id)
                            if (!result.ok) push(result.error, 'error')
                            else push('Shift deleted', 'info')
                          }}
                          className="rounded p-1 text-muted hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {shift.note && <p className="mt-1 break-words text-[10px] text-muted">{shift.note}</p>}
                    {attendance && <Badge tone="neutral">{attendance.status}</Badge>}
                  </div>
                ))}
                {!dayShifts.length && <p className="py-2 text-center text-[10px] text-muted">No planned shift</p>}
              </div>
            </Card>
          )
        })}
      </div>

      {editor && (
        <Modal
          open
          onClose={closeEditor}
          title={editor.shift ? 'Edit shift' : 'Add shift'}
          subtitle={member.name}
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeEditor}>Cancel</Button>
              <Button onClick={save}>Save shift</Button>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Start time">
              <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </Field>
            <Field label="End time">
              <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </Field>
            <Field label="Note (optional)">
              <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="e.g. Opening shift" />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}

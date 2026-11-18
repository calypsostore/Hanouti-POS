import { Square } from 'lucide-react'
import { Button, Card, Field, Input } from '../../../components/ui'
import type { QuickShiftDayEntry, QuickShiftDaySummary } from '../../../types'
import { money, fmtTime } from '../../../lib/utils'

export function QuickManagerZPanel({
  date,
  summary,
  canClose,
  blockedByOpenShifts,
  countedInput,
  openShiftCounts,
  onCountedChange,
  onOpenShiftCountChange,
  onCloseDay,
}: {
  date: string
  summary: QuickShiftDaySummary
  canClose: boolean
  blockedByOpenShifts: boolean
  countedInput: string
  openShiftCounts: Record<string, string>
  onCountedChange: (value: string) => void
  onOpenShiftCountChange: (shiftId: string, value: string) => void
  onCloseDay: () => void
}) {
  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-bold text-ink">Quick manager Z · {date}</h3>
          <p className="mt-1 text-xs text-muted">Declared shift sales plus the retained float are compared with the manager's final count.</p>
        </div>
        <Button
          variant="danger"
          disabled={!canClose || countedInput.trim() === '' ||
            !Number.isFinite(Number(countedInput)) || Number(countedInput) < 0}
          onClick={onCloseDay}
        >
          <Square className="h-4 w-4" /> Close day and lock shifts
        </Button>
      </div>
      {blockedByOpenShifts && (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Close or force-close every active staff shift before closing Z.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-2 py-2">Staff</th>
              <th className="px-2 py-2">Open</th>
              <th className="px-2 py-2">Close</th>
              <th className="px-2 py-2">Float</th>
              <th className="px-2 py-2">Counted</th>
              <th className="px-2 py-2">Declared</th>
              <th className="px-2 py-2">Difference</th>
              <th className="px-2 py-2">Corrections</th>
              <th className="px-2 py-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {summary.shifts.map((shift: QuickShiftDayEntry) => (
              <tr key={shift.shiftId}>
                <td className="px-2 py-2 font-semibold">{shift.staffName}</td>
                <td className="px-2 py-2">{fmtTime(shift.openedAt)}</td>
                <td className="px-2 py-2">{shift.closedAt ? fmtTime(shift.closedAt) : 'Open'}</td>
                <td className="px-2 py-2 tabular">{money(shift.openingFloat)}</td>
                <td className="px-2 py-2 tabular">
                  {shift.closedAt
                    ? money(shift.countedCash ?? 0)
                    : (
                      <Input
                        type="number"
                        min={0}
                        step={0.001}
                        value={openShiftCounts[shift.shiftId] ?? shift.openingFloat.toFixed(3)}
                        onChange={(event) => onOpenShiftCountChange(shift.shiftId, event.target.value)}
                        aria-label={`${shift.staffName} counted total`}
                        className="h-8 w-28"
                      />
                    )}
                </td>
                <td className="px-2 py-2 tabular">{money(shift.declaredSales)}</td>
                <td className={`px-2 py-2 font-semibold tabular ${shift.difference < 0 ? 'text-red-700' : shift.difference > 0 ? 'text-amber-700' : ''}`}>
                  {shift.difference > 0 ? '+' : ''}{money(shift.difference)}
                </td>
                <td className="px-2 py-2 text-muted">
                  {shift.correctionEntries.length
                    ? shift.correctionEntries.map((entry) => `${entry.staffName} ${money(entry.amount)}`).join(', ')
                    : '—'}
                </td>
                <td className="max-w-48 truncate px-2 py-2 text-muted">{shift.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Declared shift sales" value={money(summary.declaredSales)} />
        <Metric label="Retained float" value={money(summary.retainedFloat)} />
        <Metric label="Expected total" value={money(summary.expectedCash)} />
        <Field label="Manager counted (DT)">
          <Input
            type="number"
            min={0}
            step={0.001}
            value={countedInput}
            onChange={(event) => onCountedChange(event.target.value)}
            disabled={!canClose}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
        <span className="text-muted">Final difference</span>
        <strong className="tabular">{summary.difference > 0 ? '+' : ''}{money(summary.difference)}</strong>
        <span className="text-xs text-muted">
          {summary.staffDifferences.length
            ? summary.staffDifferences.map((staff) => `${staff.staffName} ${staff.amount > 0 ? '+' : ''}${money(staff.amount)}`).join(' · ')
            : 'No staff tally differences'}
        </span>
      </div>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-bold tabular text-ink">{value}</div>
    </div>
  )
}

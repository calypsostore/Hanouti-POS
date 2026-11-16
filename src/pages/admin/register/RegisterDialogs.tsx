import { Play, Square } from 'lucide-react'
import { Button, Field, Input, Modal, Select, Textarea } from '../../../components/ui'
import { PrintModal, type PrintJob } from '../../../components/PrintPreview'
import { RegisterItemsTable } from '../../../components/RegisterItemsTable'
import type { OpenOrder, RegisterItemsReport, RegisterSession, User } from '../../../types'
import { cn, fmtTime, money } from '../../../lib/utils'
import { shiftCashDifference } from '../../../lib/shiftCash'

type Store = NonNullable<ReturnType<typeof import('../../../store/AppStore').useApp>['store']>

export function RegisterDialogs({
  store,
  open,
  openTableCount,
  warnAboutOpenTables,
  expected,
  openingInput,
  onOpeningInputChange,
  openModal,
  onOpenModalChange,
  onOpenRegister,
  closeModal,
  onCloseModalChange,
  countedInput,
  onCountedInputChange,
  closeNote,
  onCloseNoteChange,
  itemsReport,
  onCloseRegister,
  handoverOrders,
  handoverStaff,
  handoverTargetId,
  onHandoverTargetChange,
  handoverOrderIds,
  handoverModal,
  onHandoverModalChange,
  onSubmitHandover,
  leaveFloatForNextShift,
  onLeaveFloatForNextShiftChange,
  printJob,
  onPrintClose,
}: {
  store: Store
  open: RegisterSession | null
  openTableCount: number
  warnAboutOpenTables: boolean
  expected: number
  openingInput: string
  onOpeningInputChange: (value: string) => void
  openModal: boolean
  onOpenModalChange: (open: boolean) => void
  onOpenRegister: () => void
  closeModal: boolean
  onCloseModalChange: (open: boolean) => void
  countedInput: string
  onCountedInputChange: (value: string) => void
  closeNote: string
  onCloseNoteChange: (value: string) => void
  itemsReport?: RegisterItemsReport
  onCloseRegister: () => void
  handoverOrders: OpenOrder[]
  handoverStaff: User[]
  handoverTargetId: string
  onHandoverTargetChange: (value: string) => void
  handoverOrderIds: string[]
  handoverModal: boolean
  onHandoverModalChange: (open: boolean) => void
  onSubmitHandover: () => void
  leaveFloatForNextShift: boolean
  onLeaveFloatForNextShiftChange: (value: boolean) => void
  printJob: PrintJob | null
  onPrintClose: () => void
}) {
  const countedValue = Number(countedInput) || 0
  const difference = store.settings.posMode === 'quick' ? 0 : shiftCashDifference(countedValue, expected)
  const differenceTone = difference === 0
    ? 'text-[var(--semantic-green-text)]'
    : difference > 0
      ? 'text-[var(--semantic-amber-text)]'
      : 'text-[var(--semantic-red-text)]'

  return (
    <>
      <Modal
        open={handoverModal}
        onClose={() => onHandoverModalChange(false)}
        title="Hand over open tables"
        subtitle="Your shift can close without closing these tables."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onHandoverModalChange(false)}>Cancel</Button>
            <Button disabled={handoverOrderIds.length === 0} onClick={onSubmitHandover}>Save handover</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Hand over to">
            <Select value={handoverTargetId} onChange={(event) => onHandoverTargetChange(event.target.value)}>
              <option value="">Unassigned (handover)</option>
              {handoverStaff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </Select>
          </Field>
          <div className="space-y-2">
            {handoverOrders.map((order) => (
              <label key={order.id} className="flex items-center gap-2 rounded-lg border border-line p-2 text-sm">
                <input type="checkbox" checked readOnly aria-label={`${order.tableName} included in handover`} />
                <span>{order.tableName} · {money(order.total)}</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>
      <Modal
        open={openModal}
        onClose={() => onOpenModalChange(false)}
        title="Open your shift"
        subtitle={store.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenModalChange(false)}>
              Cancel
            </Button>
            <Button disabled={!(Number(openingInput) >= 0)} onClick={onOpenRegister}>
              <Play className="h-4 w-4" /> Open shift
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label="Opening float in drawer (DT)" hint="Count the float before opening">
            <Input
              type="number"
              min={0}
              step={10}
              inputMode="decimal"
              value={openingInput}
              onChange={(event) => onOpeningInputChange(event.target.value)}
              placeholder="e.g. 120"
              className="h-12 text-lg font-bold tabular"
              autoFocus
            />
          </Field>
          <p className="text-[11.5px] leading-relaxed text-muted">
            This float is the baseline of your shift report. Opening creates a new shift; previous
            Z reports stay untouched in the history below.
          </p>
        </div>
      </Modal>

      <Modal
        open={closeModal}
        onClose={() => onCloseModalChange(false)}
        title="Close shift — X report"
        subtitle={open ? `${open.shiftNumber ?? open.id} · ${fmtTime(open.openedAt)}` : ''}
        size="sm"
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-[13px] font-bold tabular', differenceTone)}>
              Difference {difference > 0 ? '+' : ''}{money(difference)}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onCloseModalChange(false)}>
                Cancel
              </Button>
              <Button disabled={!(countedValue >= 0)} onClick={onCloseRegister}>
                <Square className="h-4 w-4" /> Close shift
              </Button>
            </div>
            <label className="flex items-start gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={leaveFloatForNextShift}
                onChange={(event) => onLeaveFloatForNextShiftChange(event.target.checked)}
              />
              Leave the counted float for the next shift
            </label>
          </div>
        }
      >
        <div className="space-y-4">
          {warnAboutOpenTables && openTableCount > 0 && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-950">
              {openTableCount} table {openTableCount === 1 ? 'order remains' : 'orders remain'} assigned to your shift. Hand them over before closing, or leave them in the handover pool.
            </div>
          )}
          <div className="rounded-2xl bg-espresso-900 px-5 py-4 text-cream-50">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">
              {store.settings.posMode === 'quick' ? 'Cash accountability is off in Quick mode' : 'Expected cash (from orders & ledger)'}
            </div>
            <div className="mt-1 text-[28px] font-extrabold tracking-tight tabular">{money(expected)}</div>
            <div className="mt-1 text-[11px] text-white/45">
              {store.settings.posMode === 'quick'
                ? 'No cash expected or cash difference is calculated.'
                : `Opening ${money(open?.openingCash ?? 0)} + cash sales + tab payments − expenses − refunds`}
            </div>
          </div>
          <Field label="Counted cash in drawer (DT)">
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="decimal"
              value={countedInput}
              onChange={(event) => onCountedInputChange(event.target.value)}
              className="h-12 text-lg font-bold tabular"
              autoFocus
            />
          </Field>
          <div className={cn('rounded-2xl border px-5 py-4 text-center', difference === 0
            ? 'border-[var(--semantic-green-border)] bg-[var(--semantic-green-soft)]'
            : difference > 0
              ? 'border-amber-300 bg-amber-50'
              : 'border-[var(--semantic-red-border)] bg-[var(--semantic-red-soft)]')}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Cash difference</div>
            <div className={cn('mt-1 text-[30px] font-extrabold tabular', differenceTone)}>
              {difference > 0 ? '+' : ''}{money(difference)}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onCountedInputChange(expected.toFixed(3))}>
              Match expected
            </Button>
          </div>
          <Field label="Note" hint="Optional — recorded on the shift X report">
            <Textarea
              value={closeNote}
              onChange={(event) => onCloseNoteChange(event.target.value)}
              placeholder="e.g. €5 coin missing, confirmed with Sami"
              rows={2}
            />
          </Field>
          {itemsReport && (
            <RegisterItemsTable
              report={itemsReport}
              title="Items in this shift report"
            />
          )}
          <p className="text-[11.5px] leading-relaxed text-muted">
            Closing ends only your shift. The owner closes and freezes the store-day Z report after all
            staff shifts are finished.
          </p>
        </div>
      </Modal>
      <PrintModal job={printJob} onClose={onPrintClose} />
    </>
  )
}

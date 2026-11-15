import { Play, Square } from 'lucide-react'
import { Button, Field, Input, Modal, Textarea } from '../../../components/ui'
import { PrintModal, type PrintJob } from '../../../components/PrintPreview'
import { RegisterItemsTable } from '../../../components/RegisterItemsTable'
import type { RegisterItemsReport, RegisterSession } from '../../../types'
import { cn, fmtTime, money } from '../../../lib/utils'

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
  printJob: PrintJob | null
  onPrintClose: () => void
}) {
  const countedValue = Number(countedInput) || 0
  const difference = store.settings.posMode === 'quick' ? 0 : countedValue - expected

  return (
    <>
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
        title="Close shift — Z report"
        subtitle={open ? `${open.shiftNumber ?? open.id} · ${fmtTime(open.openedAt)}` : ''}
        size="sm"
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-muted">
              Difference{' '}
              <span className={cn('font-bold tabular', difference === 0 ? 'text-[var(--semantic-green-text)]' : 'text-[var(--semantic-red-text)]')}>
                {difference >= 0 ? '+' : ''}
                {money(difference)}
              </span>
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onCloseModalChange(false)}>
                Cancel
              </Button>
              <Button disabled={!(countedValue >= 0)} onClick={onCloseRegister}>
                <Square className="h-4 w-4" /> Close &amp; freeze Z
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {warnAboutOpenTables && openTableCount > 0 && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-950">
              {openTableCount} table {openTableCount === 1 ? 'order is' : 'orders are'} still open. Confirm they are handed over before closing this shift; this action does not transfer table ownership.
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
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onCountedInputChange(expected.toFixed(3))}>
              Match expected
            </Button>
          </div>
          <Field label="Note" hint="Optional — recorded on the Z report">
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
              title="Items in this Z report"
            />
          )}
          <p className="text-[11.5px] leading-relaxed text-muted">
            Closing freezes this shift permanently: its Z report can be viewed or reprinted but never
            edited. The next shift gets a separate report.
          </p>
        </div>
      </Modal>
      <PrintModal job={printJob} onClose={onPrintClose} />
    </>
  )
}

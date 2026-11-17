import { useState } from 'react'
import { Button, Card, Field, Input, Modal, Select, Textarea } from '../../../components/ui'
import { DataTable, type DataTableColumn } from '../../../components/data/DataTable'
import ConfirmDeleteModal from '../../../components/data/ConfirmDeleteModal'
import { useToast } from '../../../components/toast'
import { money } from '../../../lib/utils'
import { openCashDifferenceBalance } from '../../../lib/shiftCash'
import type { CashDifference, CashDifferenceResolution, Database, User } from '../../../types'

type Props = {
  member: User
  db: Database
  canManage: boolean
  isAdmin: boolean
  canResolveOwn: boolean
  resolve: (id: string, resolution: CashDifferenceResolution, note?: string) => { ok: true } | { ok: false; error: string }
  correct: (id: string, amount: number, note?: string) => { ok: true } | { ok: false; error: string }
  accept: (id: string, note?: string) => { ok: true } | { ok: false; error: string }
  voidDifference: (id: string, reason: string) => { ok: true } | { ok: false; error: string }
  archive: (id: string) => { ok: true } | { ok: false; error: string }
  restore: (id: string) => { ok: true } | { ok: false; error: string }
}

export default function CashDifferencesTab({
  member, db, canManage, isAdmin, canResolveOwn, resolve, correct, accept,
  voidDifference, archive, restore,
}: Props) {
  const { push } = useToast()
  const [view, setView] = useState<'open' | 'archive'>('open')
  const [month, setMonth] = useState('')
  const [type, setType] = useState<'all' | 'shortage' | 'overage'>('all')
  const [selected, setSelected] = useState<CashDifference | null>(null)
  const [resolution, setResolution] = useState<CashDifferenceResolution>('paid_back')
  const [note, setNote] = useState('')
  const [voiding, setVoiding] = useState<CashDifference | null>(null)
  const [archiving, setArchiving] = useState<CashDifference | null>(null)
  const [reason, setReason] = useState('')
  const [correctionTarget, setCorrectionTarget] = useState<CashDifference | null>(null)
  const [correctionAmount, setCorrectionAmount] = useState('')
  const [correctionNote, setCorrectionNote] = useState('')
  const differences = db.cashDifferences.filter((item) => item.staffId === member.id)
  const openBalance = openCashDifferenceBalance(differences, member.id)
  const rows = differences.filter((item) => {
    const inView = view === 'open'
      ? item.status === 'open'
      : item.status !== 'open'
    return inView && (!month || item.createdAt.slice(0, 7) === month) &&
      (type === 'all' || item.type === type)
  })
  const run = (result: { ok: true } | { ok: false; error: string }, success: string) => {
    if (!result.ok) push(result.error, 'error')
    else push(success, 'success')
  }
  const columns: DataTableColumn<CashDifference>[] = [
    { key: 'date', header: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'shift', header: 'Shift', render: (row) => db.registerSessions.find((session) => session.id === row.shiftId)?.shiftNumber ?? row.shiftId },
    { key: 'type', header: 'Type', render: (row) => row.type },
    { key: 'amount', header: 'Amount', render: (row) => <span className="font-bold tabular">{money(row.amount)}</span> },
    {
      key: 'corrections',
      header: 'Corrections',
      render: (row) => (row.correctionEntries?.length
        ? <span className="text-xs text-muted">{row.correctionEntries.map((entry) =>
            `${entry.staffName}: ${money(entry.amount)} · ${new Date(entry.at).toLocaleString()}`,
          ).join('; ')}</span>
        : '—'),
    },
    { key: 'status', header: 'Status', render: (row) => row.status },
    { key: 'resolution', header: 'Resolution', render: (row) => row.resolution?.replace('_', ' ') ?? row.note ?? '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canManage && row.status === 'open' && <>
            <Button size="sm" onClick={() => { setSelected(row); setNote('') }}>Settle</Button>
            <Button size="sm" variant="danger" onClick={() => { setVoiding(row); setReason('') }}>Void</Button>
            <Button size="sm" variant="secondary" onClick={() => setArchiving(row)}>Archive</Button>
          </>}
          {canResolveOwn && row.status === 'open' && (
            <>
              {row.type === 'shortage' && (
                <Button size="sm" onClick={() => {
                  const corrected = (row.correctionEntries ?? []).reduce((total, entry) => total + entry.amount, 0)
                  setCorrectionTarget(row)
                  setCorrectionAmount(Math.max(0, Math.abs(row.amount) - corrected).toFixed(3))
                  setCorrectionNote('')
                }}>Add missing amount</Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => run(accept(row.id), 'Cash difference accepted.')}>
                Accept difference
              </Button>
            </>
          )}
          {isAdmin && row.status !== 'open' &&
            <Button size="sm" variant="secondary" onClick={() => run(restore(row.id), 'Cash difference restored.')}>Restore</Button>}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-muted">Open balance</div>
        <div className="mt-1 text-2xl font-extrabold tabular text-ink">{money(openBalance)}</div>
      </Card>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="View">
          <Select value={view} onChange={(event) => setView(event.target.value as 'open' | 'archive')}>
            <option value="open">Open</option>
            <option value="archive">Archive</option>
          </Select>
        </Field>
        <Field label="Month">
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
            <option value="all">All</option>
            <option value="shortage">Shortage</option>
            <option value="overage">Overage</option>
          </Select>
        </Field>
      </div>
      <Card><DataTable columns={columns} rows={rows} rowKey={(row) => row.id} empty="No cash differences for these filters." /></Card>
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Settle cash difference"
        size="sm"
        footer={<div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
          <Button onClick={() => {
            if (!selected) return
            run(resolve(selected.id, resolution, note), 'Cash difference settled.')
            setSelected(null)
          }}>Confirm</Button>
        </div>}
      >
        <div className="space-y-3">
          <Field label="Resolution">
            <Select value={resolution} onChange={(event) => setResolution(event.target.value as CashDifferenceResolution)}>
              <option value="paid_back">Paid back</option>
              <option value="salary_deduction">Salary deduction</option>
              <option value="waived">Waived</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Note (optional)"><Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} /></Field>
        </div>
      </Modal>
      <Modal
        open={correctionTarget !== null}
        onClose={() => setCorrectionTarget(null)}
        title="Add missing cash"
        size="sm"
        footer={<div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCorrectionTarget(null)}>Cancel</Button>
          <Button
            disabled={!Number.isFinite(Number(correctionAmount)) || Number(correctionAmount) <= 0}
            onClick={() => {
              if (!correctionTarget) return
              run(correct(correctionTarget.id, Number(correctionAmount), correctionNote), 'Cash correction recorded.')
              setCorrectionTarget(null)
            }}
          >Record correction</Button>
        </div>}
      >
        <div className="space-y-3">
          <Field label="Correction amount (DT)">
            <Input type="number" min={0.001} step={0.001} value={correctionAmount} onChange={(event) => setCorrectionAmount(event.target.value)} />
          </Field>
          <Field label="Note (optional)">
            <Textarea value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} rows={2} />
          </Field>
        </div>
      </Modal>
      <ConfirmDeleteModal
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        onConfirm={() => {
          if (!archiving) return
          run(archive(archiving.id), 'Cash difference archived.')
          setArchiving(null)
        }}
        title="Archive cash difference"
        subject={archiving ? money(archiving.amount) : undefined}
        description="This record will be retained in the archive and can be restored by an admin."
        confirmLabel="Archive"
      />
      <Modal
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        title="Void cash difference"
        size="sm"
        footer={<div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setVoiding(null)}>Cancel</Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={() => {
            if (!voiding) return
            run(voidDifference(voiding.id, reason), 'Cash difference voided.')
            setVoiding(null)
          }}>Void</Button>
        </div>}
      >
        <Field label="Reason (required)"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /></Field>
      </Modal>
    </div>
  )
}

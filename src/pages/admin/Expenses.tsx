import { useState } from 'react'
import { Download, Pencil, Plus, Receipt, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { Expense } from '../../types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '../../components/ui'
import { useToast } from '../../components/toast'
import { cn, csvDownload, dateKey, fmtDate, money, sum } from '../../lib/utils'
import PayrollTab from './PayrollTab'
import { can } from '../../lib/permissions'
import { Navigate } from 'react-router-dom'

const categories = ['Rent', 'Supplies', 'Utilities', 'Salaries', 'Salary advance', 'Internet', 'Maintenance', 'Marketing', 'Other']

const categoryColor: Record<string, string> = {
  Rent: 'bg-accent-foreground',
  Supplies: 'bg-emerald-500',
  Utilities: 'bg-sky-500',
  Salaries: 'bg-violet-500',
  'Salary advance': 'bg-indigo-500',
  Internet: 'bg-cyan-500',
  Maintenance: 'bg-brand-amber',
  Marketing: 'bg-rose-500',
  Other: 'bg-stone-400',
}

export default function Expenses() {
  const { db, store, user, addExpense, updateExpense, deleteExpense } = useApp()
  const { push } = useToast()
  const [tab, setTab] = useState<'expenses' | 'payroll'>('expenses')
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Expense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [month, setMonth] = useState(() => dateKey(new Date()).slice(0, 7))
  const [category, setCategory] = useState('all')

  if (!store || !user) return null
  if (user.role === 'staff') return <PayrollTab />
  if (user.role === 'manager' && !can(user, 'managePayroll')) return <Navigate to="/admin" replace />

  const expenses = db.expenses.filter((e) => e.storeId === store.id)

  const months = (() => {
    const set = new Set<string>()
    expenses.forEach((e) => set.add(dateKey(e.date).slice(0, 7)))
    set.add(dateKey(new Date()).slice(0, 7))
    return Array.from(set).sort().reverse().slice(0, 8)
  })()

  const monthExpenses = expenses.filter((e) => dateKey(e.date).slice(0, 7) === month)
  const filtered = monthExpenses.filter((e) => category === 'all' || e.category === category)
  const monthTotal = sum(monthExpenses, (e) => e.amount)

  const [monthYear, monthNumber] = month.split('-').map(Number)
  const prevMonthDate = new Date(monthYear, monthNumber - 1, 1, 12)
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
  const prevKey = dateKey(prevMonthDate).slice(0, 7)
  const prevTotal = sum(
    expenses.filter((e) => dateKey(e.date).slice(0, 7) === prevKey),
    (e) => e.amount,
  )
  const change = prevTotal > 0 ? ((monthTotal - prevTotal) / prevTotal) * 100 : 0

  const byCategory = categories
    .map((c) => ({
      name: c,
      amount: sum(monthExpenses.filter((e) => e.category === c), (e) => e.amount),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  const revenue = sum(
    db.orders.filter(
    (o) => o.storeId === store.id && o.status === 'completed' && dateKey(o.createdAt).slice(0, 7) === month,
    ),
    (o) => o.total,
  )

  const exportCsv = () => {
    csvDownload(`expenses-${store.slug}-${month}.csv`, [
      ['Date', 'Category', 'Note', 'Amount (DT)', 'Recorded by'],
      ...filtered.map((e) => [
        fmtDate(e.date),
        e.category,
        e.note,
        e.amount.toFixed(3),
        db.users.find((candidate) => candidate.id === e.createdBy)?.name ?? e.createdBy,
      ]),
    ])
    push('Expenses exported to CSV')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">{tab === 'expenses' ? 'Expenses' : 'Payroll'}</h2>
          <p className="mt-1 text-[13px] text-muted">
            {tab === 'expenses' ? 'Rent, supplies, salaries — keep everything in one place.' : 'Track attendance, advances and salary payments.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={tab === 'expenses' ? 'primary' : 'secondary'} onClick={() => setTab('expenses')}>Expenses</Button>
          <Button size="sm" variant={tab === 'payroll' ? 'primary' : 'secondary'} onClick={() => setTab('payroll')}>Payroll</Button>
          {tab === 'expenses' && <>
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button onClick={() => { setEditTarget(null); setOpen(true) }}>
              <Plus className="h-4 w-4" /> Add expense
            </Button>
          </>}
        </div>
      </div>

      {tab === 'payroll' ? <PayrollTab /> : <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Month total</div>
          <div className="mt-1 text-[22px] font-extrabold tracking-tight tabular">{money(monthTotal)}</div>
          <div
            className={cn(
              'mt-1 flex items-center gap-1 text-[11px] font-semibold',
              change > 0 ? 'text-red-500' : 'text-emerald-600',
            )}
          >
            {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change).toFixed(1)}% vs last month
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Sales this month</div>
          <div className="mt-1 text-[22px] font-extrabold tracking-tight tabular">{money(revenue)}</div>
          <div className="mt-1 text-[11px] text-muted">Before expenses</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Net this month</div>
          <div
            className={cn(
              'mt-1 text-[22px] font-extrabold tracking-tight tabular',
              revenue - monthTotal >= 0 ? 'text-emerald-600' : 'text-red-500',
            )}
          >
            {money(revenue - monthTotal)}
          </div>
          <div className="mt-1 text-[11px] text-muted">Sales − expenses</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Entries</div>
          <div className="mt-1 text-[22px] font-extrabold tracking-tight tabular">{monthExpenses.length}</div>
          <div className="mt-1 text-[11px] text-muted">This month</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2 border-b border-line/70 p-4">
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 w-[160px] text-[12.5px]"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {new Date(`${m}-01T12:00:00`).toLocaleDateString('en-GB', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </option>
              ))}
            </Select>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-[150px] text-[12.5px]"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="No expenses this period"
              description="Add an expense to keep your net profit accurate."
              action={
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" /> Add expense
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-line/60">
              {filtered
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((e) => (
                  <div key={e.id} className="group flex items-center gap-3 px-4 py-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl text-white',
                        categoryColor[e.category] ?? 'bg-stone-400',
                      )}
                    >
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-semibold text-ink">{e.category}</span>
                        <Badge tone="neutral">{fmtDate(e.date)}</Badge>
                      </div>
                      <div className="truncate text-[11px] text-muted">
                        {e.note} · {db.users.find((candidate) => candidate.id === e.createdBy)?.name ?? e.createdBy}
                      </div>
                    </div>
                    <span className="text-[13px] font-bold tabular">{money(e.amount)}</span>
                    <button
                      type="button"
                      onClick={() => { setEditTarget(e); setOpen(true) }}
                      aria-label={`Edit ${e.category} expense`}
                      title="Edit expense"
                      className="rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-brand-tint hover:text-accent-foreground group-hover:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(e)}
                      aria-label={`Delete ${e.category} expense`}
                      title="Delete expense"
                      className="rounded-lg p-1.5 text-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </Card>

        <Card className="h-fit min-w-0 p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Where it goes</h3>
          <p className="mt-0.5 text-[12px] text-muted">This month by category</p>
          <div className="mt-4 space-y-3.5">
            {byCategory.length === 0 && (
              <p className="py-4 text-center text-[12px] text-muted">No data for this month.</p>
            )}
            {byCategory.map((c) => {
              const pct = monthTotal > 0 ? (c.amount / monthTotal) * 100 : 0
              return (
                <div key={c.name}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-medium text-ink">{c.name}</span>
                    <span className="font-semibold tabular">{money(c.amount)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-cream-200">
                    <div
                      className={cn('h-full rounded-full', categoryColor[c.name] ?? 'bg-stone-400')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {open && (
        <ExpenseEditor
          key={editTarget?.id ?? 'new'}
          initialExpense={editTarget ?? undefined}
          onClose={() => { setOpen(false); setEditTarget(null) }}
          onSave={(data) => {
            const result = editTarget
              ? updateExpense(editTarget.id, data)
              : addExpense(store.id, data)
            if (!result.ok) {
              push(result.error, 'error')
              return
            }
            push(editTarget ? 'Expense updated' : 'Expense recorded')
            setOpen(false)
            setEditTarget(null)
          }}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete expense?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteTarget) return
                const result = deleteExpense(deleteTarget.id)
                if (!result.ok) {
                  push(result.error, 'error')
                  return
                }
                push('Expense deleted', 'info')
                setDeleteTarget(null)
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-muted">
          {deleteTarget ? `${deleteTarget.category} · ${money(deleteTarget.amount)}` : ''}
        </p>
      </Modal>
      </>}
    </div>
  )
}

function ExpenseEditor({
  initialExpense,
  onClose,
  onSave,
}: {
  initialExpense?: Expense
  onClose: () => void
  onSave: (data: { category: string; note: string; amount: number; date: string }) => void
}) {
  const [category, setCategory] = useState(initialExpense?.category ?? 'Supplies')
  const [note, setNote] = useState(initialExpense?.note ?? '')
  const [amount, setAmount] = useState(initialExpense ? String(initialExpense.amount) : '')
  const [date, setDate] = useState(initialExpense ? dateKey(initialExpense.date) : dateKey(new Date()))

  const value = Number(amount) || 0

  return (
    <Modal
      open
      onClose={onClose}
      title={initialExpense ? 'Edit expense' : 'Add expense'}
      subtitle={initialExpense ? 'Update this store expense.' : 'Record a cost against this store.'}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={value <= 0}
            onClick={() =>
              onSave({
                category,
                note: note.trim() || category,
                amount: value,
                date,
              })
            }
          >
            {initialExpense ? 'Save changes' : <><Plus className="h-4 w-4" /> Record {money(value)}</>}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Amount (DT)">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.000"
              className="tabular"
              autoFocus
            />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Description" hint="Optional">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. 10kg coffee beans from supplier"
            className="min-h-[70px]"
          />
        </Field>
      </div>
    </Modal>
  )
}

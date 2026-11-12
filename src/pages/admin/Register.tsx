import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Banknote,
  Calculator,
  CalendarDays,
  CircleDollarSign,
  Clock,
  CreditCard,
  FileText,
  HandCoins,
  History,
  Lock,
  Play,
  Printer,
  Square,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { RegisterSession } from '../../types'
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Field,
  Input,
  Modal,
  Textarea,
} from '../../components/ui'
import { PrintModal, type PrintJob } from '../../components/PrintPreview'
import { useToast } from '../../components/toast'
import { registerBreakdown, sessionSnapshot } from '../../lib/reports'
import { buildReportLines, linesToEscpos, type ReportData } from '../../lib/escpos'
import { cn, fmtDate, fmtDateTime, fmtTime, money } from '../../lib/utils'

export default function Register() {
  const { db, store, user, openRegister, closeRegister } = useApp()
  const { push } = useToast()

  const [now, setNow] = useState(new Date())
  const [openingInput, setOpeningInput] = useState('')
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [countedInput, setCountedInput] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [viewId, setViewId] = useState<string | null>(null)
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  if (!user || !store) return null
  if (user.role === 'staff' && !user.permissions.register) {
    return <Navigate to="/pos" replace />
  }

  const sessions = db.registerSessions
    .filter((s) => s.storeId === store.id)
    .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
  const open = sessions.find((s) => s.status === 'open') ?? null
  const closed = sessions.filter((s) => s.status === 'closed')
  const viewing = sessions.find((s) => s.id === viewId) ?? null

  const nowISO = now.toISOString()
  const liveSnapshot = open ? sessionSnapshot(db, open, nowISO) : null
  const liveBreakdown = open ? registerBreakdown(db, open, nowISO) : null

  const expected = liveSnapshot?.expectedCash ?? 0
  const countedValue = Number(countedInput) || 0
  const difference = countedValue - expected

  const reportData = (
    kind: 'X' | 'Z',
    session: RegisterSession,
    snapshot: NonNullable<ReturnType<typeof sessionSnapshot>>,
    endISO: string,
  ): ReportData => ({
    kind,
    store,
    session,
    snapshot,
    generatedAt: kind === 'X' ? new Date().toISOString() : session.closedAt ?? endISO,
    generatedBy: kind === 'X' ? user.name : session.closedByName ?? user.name,
    breakdown: registerBreakdown(db, session, endISO),
  })

  const printReport = (kind: 'X' | 'Z', session: RegisterSession) => {
    const snapshot =
      kind === 'X'
        ? sessionSnapshot(db, session, new Date().toISOString())
        : session.snapshot
    if (!snapshot) return
    const data = reportData(
      kind,
      session,
      snapshot,
      kind === 'X' ? new Date().toISOString() : session.closedAt ?? new Date().toISOString(),
    )
    setPrintJob({
      title: kind === 'X' ? 'X report — interim' : 'Z report — day closed',
      subtitle: `${store.name} · session ${session.id}`,
      lines: buildReportLines(data),
      bytes: linesToEscpos(buildReportLines(data), store.settings.printer.width),
      kind: 'report',
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Cash register</h2>
          <p className="mt-1 text-[13px] text-muted">
            X reports any time without closing. Z closes the day and freezes the numbers.
          </p>
        </div>
        {open ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => printReport('X', open)}>
              <Printer className="h-4 w-4" /> Print X report
            </Button>
            <Button onClick={() => { setCountedInput(expected.toFixed(3)); setCloseNote(''); setCloseModal(true) }}>
              <Square className="h-4 w-4" /> Close register (Z)
            </Button>
          </div>
        ) : (
          <Button onClick={() => setOpenModal(true)}>
            <Play className="h-4 w-4" /> Open register
          </Button>
        )}
      </div>

      {open && liveSnapshot ? (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CircleDollarSign className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold text-ink">Register open</span>
                  <Badge tone="success">Live</Badge>
                </div>
                <div className="text-[11.5px] text-muted">
                  Opened {fmtDateTime(open.openedAt)} · {open.openedByName} · opening cash{' '}
                  {money(open.openingCash)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">
                Expected cash in drawer
              </div>
              <div className="text-[22px] font-extrabold tracking-tight tabular text-ink">
                {money(expected)}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Transactions" value={String(liveSnapshot.ordersCount)} icon={<FileText className="h-4 w-4" />} />
            <Tile label="Total sales" value={money(liveSnapshot.salesTotal)} icon={<Banknote className="h-4 w-4" />} accent />
            <Tile label="Cash sales" value={money(liveSnapshot.cashSales)} icon={<CircleDollarSign className="h-4 w-4" />} />
            <Tile label="Card sales" value={money(liveSnapshot.cardSales)} icon={<CreditCard className="h-4 w-4" />} />
            <Tile label="Tab sales" value={money(liveSnapshot.creditSales)} icon={<Wallet className="h-4 w-4" />} />
            <Tile label="Tab payments" value={money(liveSnapshot.cashSettlements + liveSnapshot.cardSettlements)} icon={<HandCoins className="h-4 w-4" />} />
            <Tile label="Discounts" value={money(liveSnapshot.discounts)} icon={<TrendingDown className="h-4 w-4" />} />
            <Tile label="Expenses paid" value={money(liveSnapshot.expenses)} icon={<TrendingUp className="h-4 w-4" />} />
            <Tile label="Tax collected" value={money(liveSnapshot.tax)} icon={<ReceiptIcon />} />
            <Tile label="Service charge" value={money(liveSnapshot.service)} icon={<ReceiptIcon />} />
            <Tile
              label="Voided"
              value={`${liveSnapshot.voidedCount} · ${money(liveSnapshot.voidedTotal)}`}
              icon={<History className="h-4 w-4" />}
            />
            <Tile label="Cash refunds" value={money(liveSnapshot.cashRefunds)} icon={<TrendingDown className="h-4 w-4" />} />
          </div>

          {liveBreakdown && (liveBreakdown.byEmployee.length > 0 || liveBreakdown.byCategory.length > 0) && (
            <div className="grid gap-3 lg:grid-cols-2">
              <Card className="p-4">
                <div className="mb-2 text-[12.5px] font-bold text-ink">Sales by employee</div>
                {liveBreakdown.byEmployee.length === 0 ? (
                  <p className="py-3 text-center text-[12px] text-muted">No sales yet.</p>
                ) : (
                  <div className="divide-y divide-line/60">
                    {liveBreakdown.byEmployee.map((e) => (
                      <div key={e.name} className="flex items-center justify-between py-2 text-[12.5px]">
                        <span className="font-semibold text-ink">{e.name}</span>
                        <span className="text-muted">{e.count} orders</span>
                        <span className="font-bold tabular">{money(e.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card className="p-4">
                <div className="mb-2 text-[12.5px] font-bold text-ink">Sales by category</div>
                {liveBreakdown.byCategory.length === 0 ? (
                  <p className="py-3 text-center text-[12px] text-muted">No sales yet.</p>
                ) : (
                  <div className="divide-y divide-line/60">
                    {liveBreakdown.byCategory.map((c) => (
                      <div key={c.name} className="flex items-center justify-between py-2 text-[12.5px]">
                        <span className="font-semibold text-ink">{c.name}</span>
                        <span className="text-muted">{c.qty} items</span>
                        <span className="font-bold tabular">{money(c.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<Lock className="h-5 w-5" />}
            title="Register is closed"
            description="Open a session with the cash in the drawer before the first sale of the day."
            action={
              <Button size="sm" onClick={() => setOpenModal(true)}>
                <Play className="h-4 w-4" /> Open register
              </Button>
            }
          />
        </Card>
      )}

      <div>
        <div className="mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted" />
          <h3 className="text-[13.5px] font-bold text-ink">Closed sessions (Z history)</h3>
          <Badge tone="neutral">{closed.length}</Badge>
        </div>
        <Card>
          {closed.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="No closed sessions yet"
              description="Z reports you close will be listed here, frozen as they were printed."
            />
          ) : (
            <div className="divide-y divide-line/60">
              {closed.map((s) => {
                const diff = s.difference ?? 0
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-ink">
                        {fmtDate(s.closedAt ?? s.openedAt)} · {fmtTime(s.openedAt)} → {fmtTime(s.closedAt ?? s.openedAt)}
                      </div>
                      <div className="text-[10.5px] text-muted">
                        {s.closedByName ?? ''} · expected {money(s.snapshot?.expectedCash ?? 0)} · counted{' '}
                        {money(s.countedCash ?? 0)}
                      </div>
                    </div>
                    <Badge tone={diff === 0 ? 'success' : Math.abs(diff) < 5 ? 'info' : 'danger'}>
                      {diff >= 0 ? '+' : ''}
                      {money(diff)}
                    </Badge>
                    <div className="flex gap-1">
                      <Button variant="secondary" size="sm" onClick={() => setViewId(s.id)}>
                        View
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => printReport('Z', s)}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Open-register modal */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Open the register"
        subtitle={store.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenModal(false)}>
              Cancel
            </Button>
            <Button
              disabled={!(Number(openingInput) >= 0)}
              onClick={() => {
                const res = openRegister(store.id, Number(openingInput) || 0)
                if (!res.ok) {
                  push(res.error, 'error')
                  return
                }
                push(`Register opened with ${money(Number(openingInput) || 0)}`, 'success')
                setOpenModal(false)
                setOpeningInput('')
              }}
            >
              <Play className="h-4 w-4" /> Open register
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label="Opening cash in drawer (DT)" hint="Count the float before opening">
            <Input
              type="number"
              min={0}
              step={10}
              inputMode="decimal"
              value={openingInput}
              onChange={(e) => setOpeningInput(e.target.value)}
              placeholder="e.g. 120"
              className="h-12 text-lg font-bold tabular"
              autoFocus
            />
          </Field>
          <p className="text-[11.5px] leading-relaxed text-muted">
            This float is the baseline of today's X and Z reports. Opening creates a new session id —
            the previous Z report stays untouched in the history below.
          </p>
        </div>
      </Modal>

      {/* Z closing modal */}
      <Modal
        open={closeModal}
        onClose={() => setCloseModal(false)}
        title="Close register — Z report"
        subtitle={open ? `Session ${open.id} · ${fmtTime(open.openedAt)}` : ''}
        size="sm"
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-muted">
              Difference{' '}
              <span className={cn('font-bold tabular', difference === 0 ? 'text-emerald-600' : 'text-red-600')}>
                {difference >= 0 ? '+' : ''}
                {money(difference)}
              </span>
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCloseModal(false)}>
                Cancel
              </Button>
              <Button
                disabled={!(countedValue >= 0)}
                onClick={() => {
                  if (!open) return
                  const res = closeRegister(open.id, countedValue, closeNote)
                  if (!res.ok) {
                    push(res.error, 'error')
                    return
                  }
                  push('Register closed — Z report saved', 'success')
                  setCloseModal(false)
                }}
              >
                <Square className="h-4 w-4" /> Close &amp; freeze Z
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-espresso-900 px-5 py-4 text-cream-50">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">
              Expected cash (from orders & ledger)
            </div>
            <div className="mt-1 text-[28px] font-extrabold tracking-tight tabular">{money(expected)}</div>
            <div className="mt-1 text-[11px] text-white/45">
              Opening {money(open?.openingCash ?? 0)} + cash sales + tab payments − expenses − refunds
            </div>
          </div>
          <Field label="Counted cash in drawer (DT)">
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="decimal"
              value={countedInput}
              onChange={(e) => setCountedInput(e.target.value)}
              className="h-12 text-lg font-bold tabular"
              autoFocus
            />
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCountedInput(expected.toFixed(3))}>
              Match expected
            </Button>
          </div>
          <Field label="Note" hint="Optional — recorded on the Z report">
            <Textarea
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder="e.g. €5 coin missing, confirmed with Sami"
              rows={2}
            />
          </Field>
          <p className="text-[11.5px] leading-relaxed text-muted">
            Closing freezes this session permanently: the stored Z report can be viewed or reprinted
            but never edited. The next open register starts a new session.
          </p>
        </div>
      </Modal>

      {/* Closed-session drawer */}
      <Drawer
        open={!!viewing}
        onClose={() => setViewId(null)}
        title={viewing ? `Z report · ${fmtDate(viewing.closedAt ?? viewing.openedAt)}` : ''}
        subtitle={viewing ? `Session ${viewing.id}` : ''}
        footer={
          viewing ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setViewId(null)}>
                Close
              </Button>
              <Button onClick={() => printReport('Z', viewing)}>
                <Printer className="h-4 w-4" /> Print Z report
              </Button>
            </div>
          ) : null
        }
      >
        {viewing && viewing.snapshot && (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">Counted cash</div>
                <div className="mt-1 text-[18px] font-extrabold tabular">{money(viewing.countedCash ?? 0)}</div>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">Difference</div>
                <div
                  className={cn(
                    'mt-1 text-[18px] font-extrabold tabular',
                    (viewing.difference ?? 0) === 0 ? 'text-emerald-600' : 'text-red-600',
                  )}
                >
                  {(viewing.difference ?? 0) >= 0 ? '+' : ''}
                  {money(viewing.difference ?? 0)}
                </div>
              </div>
            </div>
            <div className="space-y-1 rounded-xl border border-line bg-white p-4 text-[12.5px]">
              <Row label="Opened" value={`${fmtDate(viewing.openedAt)} ${fmtTime(viewing.openedAt)} · ${viewing.openedByName}`} />
              <Row label="Closed" value={`${fmtDate(viewing.closedAt ?? '')} ${fmtTime(viewing.closedAt ?? '')} · ${viewing.closedByName ?? ''}`} />
              <Row label="Opening cash" value={money(viewing.openingCash)} />
              <Row label="Transactions" value={String(viewing.snapshot.ordersCount)} />
              <Row label="Total sales" value={money(viewing.snapshot.salesTotal)} />
              <Row label="Cash / card / tab" value={`${money(viewing.snapshot.cashSales)} / ${money(viewing.snapshot.cardSales)} / ${money(viewing.snapshot.creditSales)}`} />
              <Row label="Tab payments" value={money(viewing.snapshot.cashSettlements + viewing.snapshot.cardSettlements)} />
              <Row label="Voided orders" value={`${viewing.snapshot.voidedCount} · ${money(viewing.snapshot.voidedTotal)}`} />
              <Row label="Discounts" value={money(viewing.snapshot.discounts)} />
              <Row label="Tax / service" value={`${money(viewing.snapshot.tax)} / ${money(viewing.snapshot.service)}`} />
              <Row label="Expenses paid" value={money(viewing.snapshot.expenses)} />
              <Row label="Expected cash" value={money(viewing.snapshot.expectedCash)} />
              {viewing.note && <Row label="Note" value={viewing.note} />}
            </div>
            {viewing.snapshot &&
              (() => {
                const b = registerBreakdown(db, viewing, viewing.closedAt ?? nowISO)
                return (
                  <div className="space-y-1 rounded-xl border border-line bg-white p-4 text-[12.5px]">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">By employee</div>
                    {b.byEmployee.length === 0 && <p className="text-muted">No sales in this window.</p>}
                    {b.byEmployee.map((e) => (
                      <div key={e.name} className="flex justify-between">
                        <span>{e.name} ({e.count})</span>
                        <span className="font-semibold tabular">{money(e.total)}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
          </div>
        )}
      </Drawer>

      <PrintModal job={printJob} onClose={() => setPrintJob(null)} />
    </div>
  )
}

function ReceiptIcon() {
  return <Calculator className="h-4 w-4" />
}

function Tile({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent?: boolean
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          accent ? 'bg-accent-50 text-accent-600' : 'bg-cream-100 text-muted',
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="truncate text-[15px] font-extrabold tracking-tight tabular">{value}</div>
      </div>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  )
}

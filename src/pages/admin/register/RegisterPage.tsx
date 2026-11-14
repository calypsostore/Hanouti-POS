import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Play, Printer, Square } from 'lucide-react'
import { Button } from '../../../components/ui'
import type { PrintJob } from '../../../components/PrintPreview'
import { useToast } from '../../../components/toast'
import { registerBreakdown, registerReportDetails, sessionSnapshot } from '../../../lib/reports'
import { registerSessionItems } from '../../../lib/registerItems'
import { buildReportLines, linesToEscpos, type ReportData } from '../../../lib/escpos'
import type { RegisterItemsReport, RegisterSession } from '../../../types'
import { money } from '../../../lib/utils'
import { can } from '../../../lib/permissions'
import { openShiftForStaff } from '../../../lib/registerShifts'
import { useApp } from '../../../store/AppStore'
import { LiveRegister } from './LiveRegister'
import { RegisterDialogs } from './RegisterDialogs'
import { SessionHistory } from './SessionHistory'

export default function RegisterPage() {
  const { db, store, user, openRegister, closeRegister } = useApp()
  const { push } = useToast()
  const [now, setNow] = useState(new Date())
  const [openingInput, setOpeningInput] = useState('')
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [countedInput, setCountedInput] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!user || !store) return null
  if (!can(user, 'openShift') && !can(user, 'closeShift')) {
    return <Navigate to="/pos" replace />
  }

  const allSessions = db.registerSessions
    .filter((session) => session.storeId === store.id)
    .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
  const canSeeAll = user.role !== 'staff' || !!user.permissions.supervisor
  const sessions = canSeeAll ? allSessions : allSessions.filter((session) => (session.staffId ?? session.openedById) === user.id)
  const open = openShiftForStaff(db, store.id, user.id) ?? null
  const anyOpen = allSessions.find((session) => session.status === 'open') ?? null
  const closed = sessions.filter((session) => session.status === 'closed')

  const nowISO = now.toISOString()
  const itemScope = canSeeAll ? undefined : user.id
  const liveSnapshot = open ? sessionSnapshot(db, open, nowISO) : null
  const liveBreakdown = open ? registerBreakdown(db, open, nowISO, itemScope) : null
  const itemDetailsForSession = (
    session: RegisterSession,
    endISO: string,
    staffId?: string,
  ): { report: RegisterItemsReport; rebuiltFromOrders: boolean } => {
    const stored = session.reportDetails
    if (
      session.status === 'closed' &&
      stored?.itemsSold !== undefined &&
      stored.recordedItems !== undefined &&
      stored.voidedItems !== undefined
    ) {
      return {
        report: {
          itemsSold: stored.itemsSold,
          recordedItems: stored.recordedItems,
          voidedItems: stored.voidedItems,
        },
        rebuiltFromOrders: false,
      }
    }
    return {
      report: registerSessionItems(db, session, endISO, staffId),
      rebuiltFromOrders: session.status === 'closed',
    }
  }
  const liveItems = open ? itemDetailsForSession(open, nowISO, itemScope).report : null
  const expected = liveSnapshot?.expectedCash ?? 0

  const reportData = (
    kind: 'X' | 'Z',
    session: RegisterSession,
    snapshot: NonNullable<ReturnType<typeof sessionSnapshot>>,
    endISO: string,
  ): ReportData => {
    const generatedAt = kind === 'X' ? endISO : session.closedAt ?? endISO
    const itemDetails = itemDetailsForSession(
      session,
      generatedAt,
      kind === 'X' && !canSeeAll ? user.id : undefined,
    )
    const details = kind === 'Z'
      ? session.reportDetails ?? null
      : registerReportDetails(db, session, endISO, !canSeeAll ? user.id : undefined)
    return {
      kind,
      store,
      session,
      snapshot,
      itemsReport: itemDetails.report,
      itemsRebuiltFromOrders: itemDetails.rebuiltFromOrders,
      details,
      width: details?.receiptWidth ?? store.settings.printer.width,
      reportNumber: kind === 'Z'
        ? `Z-${String(session.zReportNumber).padStart(6, '0')}`
        : `X-${session.id.slice(-6)}-${Date.parse(generatedAt).toString(36).toUpperCase()}`,
      generatedAt,
      generatedBy: kind === 'X' ? user.name : session.closedByName ?? user.name,
    }
  }

  const printReport = (kind: 'X' | 'Z', session: RegisterSession) => {
    if (kind === 'Z' && session.zReportNumber === undefined) {
      push('This closed session has no Z report number.', 'error')
      return
    }
    const generatedAt = kind === 'X' ? new Date().toISOString() : session.closedAt ?? new Date().toISOString()
    const snapshot =
      kind === 'X'
        ? sessionSnapshot(db, session, generatedAt)
        : session.snapshot
    if (!snapshot) return
    const data = reportData(
      kind,
      session,
      snapshot,
      generatedAt,
    )
    const lines = buildReportLines(data)
    setPrintJob({
      title: `${kind} Report · ${data.reportNumber}`,
      subtitle: `${data.details?.storeName ?? store.name} · session ${session.id}`,
      lines,
      bytes: linesToEscpos(lines, data.width),
      kind: 'report',
      width: data.width,
      itemsReport: data.itemsReport,
      itemsRebuiltFromOrders: data.itemsRebuiltFromOrders,
    })
  }

  const handleOpenRegister = () => {
    const openingCash = Number(openingInput) || 0
    const result = openRegister(store.id, openingCash)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Register opened with ${money(openingCash)}`, 'success')
    setOpenModal(false)
    setOpeningInput('')
  }

  const handleCloseRegister = () => {
    if (!open) return
    const result = closeRegister(open.id, Number(countedInput) || 0, closeNote)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Register closed — Z report saved', 'success')
    setCloseModal(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Cash register</h2>
          <p className="mt-1 text-[13px] text-muted">
            {canSeeAll
              ? 'X reports any time without closing. Z closes the day and freezes the numbers.'
              : 'Your shifts only — open your shift, print your X report and close it.'}
          </p>
        </div>
        {open ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => printReport('X', open)}>
              <Printer className="h-4 w-4" /> Print X report
            </Button>
            <Button
              onClick={() => {
                setCountedInput(expected.toFixed(3))
                setCloseNote('')
                setCloseModal(true)
              }}
            >
              <Square className="h-4 w-4" /> Close shift (Z)
            </Button>
          </div>
        ) : (
          <Button onClick={() => setOpenModal(true)}>
            <Play className="h-4 w-4" /> Open shift
          </Button>
        )}
      </div>

      <LiveRegister
        open={open}
        anyOpen={anyOpen}
        canSeeAll={canSeeAll}
        liveSnapshot={liveSnapshot}
        liveBreakdown={liveBreakdown}
        liveItems={liveItems}
        onOpen={() => setOpenModal(true)}
      />

      <SessionHistory
        closed={closed}
        canSeeAll={canSeeAll}
        itemsForSession={(session) => itemDetailsForSession(
          session,
          session.closedAt ?? session.openedAt,
        )}
        onPrint={(session) => printReport('Z', session)}
      />

      <RegisterDialogs
        store={store}
        open={open}
        expected={expected}
        itemsReport={open ? itemDetailsForSession(open, nowISO).report : undefined}
        openingInput={openingInput}
        onOpeningInputChange={setOpeningInput}
        openModal={openModal}
        onOpenModalChange={setOpenModal}
        onOpenRegister={handleOpenRegister}
        closeModal={closeModal}
        onCloseModalChange={setCloseModal}
        countedInput={countedInput}
        onCountedInputChange={setCountedInput}
        closeNote={closeNote}
        onCloseNoteChange={setCloseNote}
        onCloseRegister={handleCloseRegister}
        printJob={printJob}
        onPrintClose={() => setPrintJob(null)}
      />
    </div>
  )
}

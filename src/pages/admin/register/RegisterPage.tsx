import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Play, Printer, Square } from 'lucide-react'
import { Button, Field, Input, Modal, Textarea } from '../../../components/ui'
import type { PrintJob } from '../../../components/PrintPreview'
import { useToast } from '../../../components/toast'
import { computeRegisterTotals, registerBreakdown, registerReportDetails, sessionSnapshot } from '../../../lib/reports'
import { registerSessionItems } from '../../../lib/registerItems'
import { buildReportLines, linesToEscpos, type ReportData } from '../../../lib/escpos'
import type { RegisterDayReport, RegisterItemsReport, RegisterSession } from '../../../types'
import { dateKey, money } from '../../../lib/utils'
import { can } from '../../../lib/permissions'
import { hasOpenShiftsRequiringManualClose, openShiftForStaff } from '../../../lib/registerShifts'
import { shiftCashDifference } from '../../../lib/shiftCash'
import { shiftOpenScheduleError } from '../../../lib/shiftAccess'
import { isQuick } from '../../../lib/posMode'
import { calculateQuickDayClose } from '../../../lib/quickShifts'
import { useApp } from '../../../store/AppStore'
import { LiveRegister } from './LiveRegister'
import { RegisterDialogs } from './RegisterDialogs'
import { QuickManagerZPanel } from './QuickManagerZPanel'
import { SessionHistory } from './SessionHistory'

export default function RegisterPage() {
  const { db, store, user, openRegister, closeRegister, closeRegisterDay, handoverTables, takeOverTables } = useApp()
  const { push } = useToast()
  const [now, setNow] = useState(new Date())
  const [openingInput, setOpeningInput] = useState('100')
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [dayCloseModal, setDayCloseModal] = useState(false)
  const [handoverModal, setHandoverModal] = useState(false)
  const [handoverTargetId, setHandoverTargetId] = useState('')
  const [handoverOrderIds, setHandoverOrderIds] = useState<string[]>([])
  const [forceSession, setForceSession] = useState<RegisterSession | null>(null)
  const [forceCountedInput, setForceCountedInput] = useState('')
  const [forceReason, setForceReason] = useState('')
  const [countedInput, setCountedInput] = useState('')
  const [expectedSalesInput, setExpectedSalesInput] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [dayStaffFloatInput, setDayStaffFloatInput] = useState('')
  const [dayCountedInput, setDayCountedInput] = useState('')
  const [dayOpenShiftCounts, setDayOpenShiftCounts] = useState<Record<string, string>>({})
  const [dayCloseNote, setDayCloseNote] = useState('')
  const [leaveFloatForNextShift, setLeaveFloatForNextShift] = useState(false)
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!user || !store) return null
  if (!can(user, 'openShift') && !can(user, 'closeShift')) {
    return <Navigate to="/pos" replace />
  }

  const beginClose = () => {
    if (!open) return
    setCountedInput((isQuick(store) ? open.openingFloat ?? open.openingCash : expected).toFixed(3))
    setExpectedSalesInput('')
    setCloseNote('')
    setLeaveFloatForNextShift(false)
    if (ownedOpenTables.length > 0) {
      setHandoverOrderIds(ownedOpenTables.map((order) => order.id))
      setHandoverTargetId('')
      setHandoverModal(true)
    } else {
      setCloseModal(true)
    }
  }

  const submitHandover = () => {
    const result = handoverTables(store.id, handoverOrderIds, handoverTargetId || undefined)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Table handover saved.', 'success')
    setHandoverModal(false)
    setCloseModal(true)
  }

  const takeAllWaitingTables = () => {
    const result = takeOverTables(waitingTables.map((order) => order.id))
    if (!result.ok) push(result.error, 'error')
    else push('Handover tables assigned to you.', 'success')
  }

  const submitForceClose = () => {
    if (!forceSession) return
    const result = closeRegister(forceSession.id, Number(forceCountedInput), undefined, forceReason)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Staff shift force-closed.', 'success')
    setForceSession(null)
    setForceReason('')
  }

  const allSessions = db.registerSessions
    .filter((session) => session.storeId === store.id)
    .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
  const canSeeAll = user.role !== 'staff' || !!user.permissions.supervisor
  const isOwner = user.role === 'admin'
  const sessions = canSeeAll ? allSessions : allSessions.filter((session) => (session.staffId ?? session.openedById) === user.id)
  const open = openShiftForStaff(db, store.id, user.id) ?? null
  const ownedOpenTables = db.openOrders.filter((order) =>
    order.storeId === store.id && order.staffId === user.id,
  )
  const waitingTables = db.openOrders.filter((order) =>
    order.storeId === store.id && order.staffId === 'unassigned-handover',
  )
  const colleagues = db.users.filter((candidate) =>
    candidate.storeId === store.id && candidate.active && candidate.id !== user.id &&
    candidate.role !== 'super' && openShiftForStaff(db, store.id, candidate.id),
  )
  const anyOpen = allSessions.find((session) => session.status === 'open') ?? null
  const closed = sessions.filter((session) => session.status === 'closed')

  const nowISO = now.toISOString()
  const today = dateKey(now)
  const todayStart = new Date(`${today}T00:00:00`).toISOString()
  const todaySessions = allSessions.filter((session) => dateKey(session.openedAt) === today)
  const quickDaySessions = isQuick(store)
    ? allSessions.filter((session) =>
        dateKey(session.openedAt) === today ||
        (!!session.closedAt && dateKey(session.closedAt) === today) ||
        session.status === 'open',
      )
    : todaySessions
  const dayReports = db.registerDayReports
    .filter((report) => report.storeId === store.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const todayDayReport = dayReports.find((report) => report.date === today)
  const firstTodaySession = quickDaySessions.reduce<RegisterSession | undefined>((first, session) =>
    !first || session.openedAt < first.openedAt ? session : first,
  undefined)
  const dayOpeningCash = firstTodaySession
    ? firstTodaySession.openingFloat ?? firstTodaySession.openingCash
    : 0
  const liveDaySnapshot = todaySessions.length
    ? computeRegisterTotals(db, store.id, todayStart, nowISO, dayOpeningCash)
    : null
  const staffFloatValue = Number(dayStaffFloatInput)
  const dayCloseSnapshot = todaySessions.length && Number.isFinite(staffFloatValue) && staffFloatValue >= 0
    ? computeRegisterTotals(db, store.id, todayStart, nowISO, staffFloatValue)
    : null
  const canManageDayZ = user.role === 'admin' ||
    (user.role === 'manager' && can(user, 'forceCloseShift'))
  const canSeeDayZ = isQuick(store) ? canManageDayZ : user.role === 'admin'
  const shiftsNeedManualClose = hasOpenShiftsRequiringManualClose(db, store.id)
  const canCloseDay = isQuick(store)
    ? canManageDayZ && !todayDayReport && quickDaySessions.length > 0 && !shiftsNeedManualClose
    : user.role === 'admin' && !todayDayReport && todaySessions.length > 0 && !shiftsNeedManualClose
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
  const quickRetainedFloat = firstTodaySession
    ? firstTodaySession.openingFloat ?? firstTodaySession.openingCash
    : 0
  const quickDayPreview = isQuick(store)
    ? calculateQuickDayClose(quickDaySessions.map((session) => {
        const openingFloat = session.openingFloat ?? session.openingCash
        const counted = session.status === 'open'
          ? Number(dayOpenShiftCounts[session.id] ?? openingFloat.toFixed(3))
          : session.countedCash
        return {
          shiftId: session.id,
          staffId: session.staffId ?? session.openedById,
          staffName: db.users.find((candidate) =>
            candidate.id === (session.staffId ?? session.openedById) && candidate.storeId === store.id,
          )?.name ?? session.openedByName,
          openedAt: session.openedAt,
          closedAt: session.closedAt,
          openingFloat,
          countedCash: counted,
          declaredSales: session.status === 'open'
            ? typeof counted === 'number' && Number.isFinite(counted) ? counted - openingFloat : 0
            : session.declaredSales,
          expectedSales: session.expectedSales,
          difference: session.expectedSales === undefined ? 0 : session.difference ?? 0,
          correctionEntries: db.cashDifferences
            .filter((difference) => difference.shiftId === session.id)
            .flatMap((difference) => difference.correctionEntries ?? []),
          note: session.note,
          forceClosed: false,
        }
      }), quickRetainedFloat, Number(dayCountedInput) || 0)
    : null
  const quickDaySummary = todayDayReport?.quickShiftSummary ?? quickDayPreview
  const dayExpectedCash = isQuick(store)
    ? quickDaySummary?.expectedCash ?? 0
    : dayCloseSnapshot?.expectedCash ?? 0
  const dayCashDifference = isQuick(store)
    ? quickDaySummary?.difference ?? 0
    : shiftCashDifference(Number(dayCountedInput) || 0, dayExpectedCash)
  const quickOpenCountsValid = quickDaySessions.filter((session) => session.status === 'open').every((session) => {
    const value = dayOpenShiftCounts[session.id] ?? (session.openingFloat ?? session.openingCash).toFixed(3)
    return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
  })
  const beginDayClose = () => {
    setDayCloseNote('')
    if (isQuick(store)) {
      setDayStaffFloatInput(quickRetainedFloat.toFixed(3))
      setDayOpenShiftCounts((previous) => {
        const next = { ...previous }
        for (const session of quickDaySessions) {
          if (session.status === 'open' && next[session.id] === undefined) {
            next[session.id] = (session.openingFloat ?? session.openingCash).toFixed(3)
          }
        }
        return next
      })
      if (dayCountedInput.trim() === '') {
        setDayCountedInput((quickDayPreview?.expectedCash ?? 0).toFixed(3))
      }
    } else {
      setDayStaffFloatInput(dayOpeningCash.toFixed(3))
      setDayCountedInput((liveDaySnapshot?.expectedCash ?? 0).toFixed(3))
    }
    setDayCloseModal(true)
  }
  const ownScheduledShifts = db.shifts.filter((shift) =>
    shift.storeId === store.id && shift.userId === user.id && shift.date === today,
  )
  const scheduleError = shiftOpenScheduleError(
    store.settings.shiftAccess,
    db.shifts,
    store.id,
    user.id,
    now,
  )

  const reportData = (
    kind: 'X' | 'Z',
    session: RegisterSession,
    snapshot: NonNullable<ReturnType<typeof sessionSnapshot>>,
    endISO: string,
  ): ReportData => {
    const frozenShiftReport = session.status === 'closed'
    const generatedAt = kind === 'X' && !frozenShiftReport
      ? endISO
      : session.closedAt ?? endISO
    const itemDetails = itemDetailsForSession(
      session,
      generatedAt,
      kind === 'X' && !canSeeAll ? user.id : undefined,
    )
    const details = kind === 'Z' || frozenShiftReport
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
      generatedBy: kind === 'X' && !frozenShiftReport ? user.name : session.closedByName ?? user.name,
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
    setOpeningInput(openingCash.toFixed(3))
  }

  const handleCloseRegister = () => {
    if (!open) return
    const expectedSales = expectedSalesInput.trim() === '' ? undefined : Number(expectedSalesInput)
    const result = closeRegister(
      open.id,
      Number(countedInput) || 0,
      closeNote,
      undefined,
      leaveFloatForNextShift,
      expectedSales,
    )
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Your shift is closed. The owner can close the day-end Z after all shifts finish.', 'success')
    setCloseModal(false)
  }

  const handleCloseRegisterDay = () => {
    const quickOpenCounts = isQuick(store)
      ? Object.fromEntries(quickDaySessions
          .filter((session) => session.status === 'open')
          .map((session) => {
            const value = dayOpenShiftCounts[session.id]
            return [session.id, value?.trim() ? Number(value) : Number.NaN]
          }))
      : undefined
    const result = closeRegisterDay(
      store.id,
      Number(dayStaffFloatInput),
      Number(dayCountedInput),
      dayCloseNote,
      quickOpenCounts,
    )
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Store-day Z report closed and frozen.', 'success')
    setDayCloseModal(false)
  }

  const printDayReport = (report: RegisterDayReport) => {
    const session: RegisterSession = {
      id: report.id,
      storeId: report.storeId,
      status: 'closed',
      openedAt: new Date(`${report.date}T00:00:00`).toISOString(),
      openedById: report.closedById,
      openedByName: report.closedByName,
      closedAt: report.closedAt,
      closedById: report.closedById,
      closedByName: report.closedByName,
      openingCash: report.openingCash,
      countedCash: report.countedCash,
      difference: report.difference,
      note: report.note,
      snapshot: report.snapshot,
      zReportNumber: report.zReportNumber,
      reportDetails: report.reportDetails,
    }
    const data = { ...reportData('Z', session, report.snapshot, report.closedAt), storeDay: true }
    const lines = buildReportLines(data)
    setPrintJob({
      title: `Z Report · ${data.reportNumber}`,
      subtitle: `${report.reportDetails.storeName} · ${report.date}`,
      lines,
      bytes: linesToEscpos(lines, data.width),
      kind: 'report',
      width: data.width,
      itemsReport: {
        itemsSold: report.reportDetails.itemsSold ?? [],
        recordedItems: report.reportDetails.recordedItems ?? [],
        voidedItems: report.reportDetails.voidedItems ?? [],
      },
    })
  }

  const beginOpen = () => {
    const previous = [...db.registerSessions]
      .filter((session) => session.storeId === store.id && session.status === 'closed' &&
        (session.openingFloat !== undefined || session.openingCash >= 0))
      .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))[0]
    const fallback = isQuick(store) ? '0.000' : '100'
    setOpeningInput(
      previous
        ? (previous.openingFloat ?? previous.openingCash).toFixed(3)
        : fallback,
    )
    setOpenModal(true)
  }

  if (user.role === 'staff' && store.settings.shiftAccess.requireOpenShiftForStoreAccess && !open) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Your shift</h2>
          <p className="mt-1 text-[13px] text-muted">
            Store orders, tables, reports, and other operations are hidden until you open your shift.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <h3 className="text-sm font-bold">Your schedule today</h3>
          {ownScheduledShifts.length ? (
            <div className="mt-2 space-y-1 text-sm text-muted">
              {ownScheduledShifts.map((shift) => (
                <p key={shift.id}>{shift.startTime}–{shift.endTime}{shift.note ? ` · ${shift.note}` : ''}</p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No shift is scheduled for you today.</p>
          )}
          {scheduleError && store.settings.shiftAccess.enforceScheduleForShiftOpen && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">{scheduleError}</p>
          )}
          <Button className="mt-4" onClick={beginOpen}>
            <Play className="h-4 w-4" /> Open my shift
          </Button>
        </div>
        <Modal
          open={openModal}
          onClose={() => setOpenModal(false)}
          title="Open your shift"
          subtitle="The store becomes available after your shift opens."
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpenModal(false)}>Cancel</Button>
              <Button onClick={handleOpenRegister}><Play className="h-4 w-4" /> Open shift</Button>
            </div>
          )}
        >
          <Field label="Opening cash">
            <Input
              type="number"
              min={0}
              step={0.001}
              value={openingInput}
              onChange={(event) => setOpeningInput(event.target.value)}
              disabled={isQuick(store) && !store.settings.allowQuickOpeningFloatEdit}
            />
          </Field>
        </Modal>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Cash register</h2>
          <p className="mt-1 text-[13px] text-muted">
            {isOwner
              ? 'Owner access does not require a personal shift or opening cash. Review active team shifts, print X reports, and close Z after shifts are closed or force-closed.'
              : isQuick(store)
              ? 'Staff declare cash at shift close. The manager Z totals declarations, differences, corrections, and the retained float.'
              : canSeeAll
              ? 'Staff can open and close shifts independently. The owner closes one frozen Z after the day’s work is finished.'
              : 'Open your own shift, print an X report any time, and close your shift when you hand over.'}
          </p>
        </div>
        {open ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => printReport('X', open)}>
              <Printer className="h-4 w-4" /> Print X report
            </Button>
            {!(isOwner && open.autoOpened) && (
              <Button
                onClick={() => {
                  beginClose()
                }}
              >
                <Square className="h-4 w-4" /> Close shift
              </Button>
            )}
            {canSeeDayZ && (
              <Button
                variant="secondary"
                disabled={!canCloseDay}
                onClick={beginDayClose}
              >
                <Square className="h-4 w-4" /> Close day (Z)
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {!isOwner && (
              <Button onClick={beginOpen}>
                <Play className="h-4 w-4" /> Open shift
              </Button>
            )}
            {canSeeDayZ && (
              <Button
                variant="secondary"
                disabled={!canCloseDay}
                onClick={beginDayClose}
              >
                <Square className="h-4 w-4" /> Close day (Z)
              </Button>
            )}
          </div>
        )}
      </div>

      <LiveRegister
        open={open}
        anyOpen={anyOpen}
        activeSessions={allSessions.filter((session) => session.status === 'open')}
        quick={isQuick(store)}
        canSeeAll={canSeeAll}
        isOwner={isOwner}
        liveSnapshot={liveSnapshot}
        liveBreakdown={liveBreakdown}
        liveItems={liveItems}
        onOpen={beginOpen}
        onPrintX={(session) => printReport('X', session)}
      />

      {isQuick(store) && canManageDayZ && quickDaySummary && (
        <QuickManagerZPanel
          date={today}
          summary={quickDaySummary}
          canClose={canCloseDay && quickOpenCountsValid}
          blockedByOpenShifts={shiftsNeedManualClose}
          countedInput={todayDayReport?.countedCash.toFixed(3) ?? dayCountedInput}
          openShiftCounts={dayOpenShiftCounts}
          onCountedChange={setDayCountedInput}
          onOpenShiftCountChange={(shiftId, value) => setDayOpenShiftCounts((previous) => ({
            ...previous,
            [shiftId]: value,
          }))}
          onCloseDay={beginDayClose}
        />
      )}

      {can(user, 'forceCloseShift') && allSessions.filter((session) =>
        session.status === 'open' && session.id !== open?.id,
      ).map((session) => (
        <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <div className="text-sm font-semibold">{session.openedByName} · {session.shiftNumber}</div>
          <Button size="sm" variant="danger" onClick={() => {
            setForceCountedInput((isQuick(store)
              ? session.openingFloat ?? session.openingCash
              : sessionSnapshot(db, session, nowISO)?.expectedCash ?? 0).toFixed(3))
            setForceReason('')
            setForceSession(session)
          }}>Force close</Button>
        </div>
      ))}

      {open && can(user, 'takeOverTables') && waitingTables.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <strong>{waitingTables.length} {waitingTables.length === 1 ? 'table' : 'tables'} waiting</strong>
          <Button size="sm" onClick={takeAllWaitingTables}>Take all</Button>
        </div>
      )}

      <SessionHistory
        closed={closed}
        canSeeAll={canSeeAll}
        roleForSession={(session) => db.users.find((candidate) =>
          candidate.id === (session.staffId ?? session.openedById) && candidate.storeId === store.id,
        )?.role ?? 'unknown'}
        itemsForSession={(session) => itemDetailsForSession(
          session,
          session.closedAt ?? session.openedAt,
        )}
        onPrint={(session, kind) => printReport(kind, session)}
      />

      {canSeeDayZ && (
        <div>
          <h3 className="mb-2 text-[13.5px] font-bold text-ink">Store-day Z reports</h3>
          <div className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
            {dayReports.length === 0 ? (
              <p className="p-4 text-sm text-muted">The owner can close today’s Z after all staff shifts are closed.</p>
            ) : dayReports.map((report) => (
              <div key={report.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-ink">{report.date} · Z-{String(report.zReportNumber).padStart(6, '0')}</div>
                  <div className="text-xs text-muted">Closed by {report.closedByName} · cash difference {money(report.difference)}</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => printDayReport(report)}>
                  <Printer className="h-4 w-4" /> Reprint Z
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <RegisterDialogs
        store={store}
        open={open}
        openTableCount={ownedOpenTables.length}
        warnAboutOpenTables={store.settings.automation.warnAboutOpenTablesAtShiftClose}
        expected={expected}
        itemsReport={open ? itemDetailsForSession(open, nowISO).report : undefined}
        openingInput={openingInput}
        canEditOpeningFloat={!isQuick(store) || user.role === 'admin' || store.settings.allowQuickOpeningFloatEdit}
        onOpeningInputChange={setOpeningInput}
        openModal={openModal}
        onOpenModalChange={setOpenModal}
        onOpenRegister={handleOpenRegister}
        closeModal={closeModal}
        onCloseModalChange={setCloseModal}
        countedInput={countedInput}
        expectedSalesInput={expectedSalesInput}
        onCountedInputChange={setCountedInput}
        onExpectedSalesInputChange={setExpectedSalesInput}
        closeNote={closeNote}
        onCloseNoteChange={setCloseNote}
        onCloseRegister={handleCloseRegister}
        leaveFloatForNextShift={leaveFloatForNextShift}
        onLeaveFloatForNextShiftChange={setLeaveFloatForNextShift}
        handoverOrders={ownedOpenTables}
        handoverStaff={colleagues}
        handoverTargetId={handoverTargetId}
        onHandoverTargetChange={setHandoverTargetId}
        handoverOrderIds={handoverOrderIds}
        handoverModal={handoverModal}
        onHandoverModalChange={setHandoverModal}
        onSubmitHandover={submitHandover}
        printJob={printJob}
        onPrintClose={() => setPrintJob(null)}
      />
      <Modal
        open={dayCloseModal}
        onClose={() => setDayCloseModal(false)}
        title={isQuick(store) ? 'Close Quick day — Z report' : 'Close store day — Z report'}
        subtitle={`${store.name} · ${today}`}
        size="sm"
        footer={<div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDayCloseModal(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={
              (!isQuick(store) && (!Number.isFinite(Number(dayStaffFloatInput)) ||
                Number(dayStaffFloatInput) < 0)) ||
              dayCountedInput.trim() === '' ||
              !Number.isFinite(Number(dayCountedInput)) ||
              (isQuick(store) && !quickOpenCountsValid) ||
              Number(dayCountedInput) < 0
            }
            onClick={handleCloseRegisterDay}
          >
            Close day and freeze Z
          </Button>
        </div>}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {isQuick(store)
              ? 'This locks the day and bulk force-closes any open shifts, retaining each shift’s staff owner.'
              : 'This closes the whole store day, not one staff shift. It is available only after every shift is closed.'}
          </p>
          <Field label="Expected day-end cash">
            <div className="text-xl font-bold text-ink">{money(dayExpectedCash)}</div>
          </Field>
          {isQuick(store) ? (
            <>
              <Field label="Retained float (DT)">
                <div className="text-sm font-bold text-ink">{money(quickDaySummary?.retainedFloat ?? 0)}</div>
              </Field>
              {quickDaySessions.filter((session) => session.status === 'open').map((session) => {
                const staffName = db.users.find((candidate) =>
                  candidate.id === (session.staffId ?? session.openedById),
                )?.name ?? session.openedByName
                return (
                  <Field
                    key={session.id}
                    label={`${staffName} · force-close counted total (DT)`}
                    hint="The shift remains attributed to its original staff member."
                  >
                    <Input
                      type="number"
                      min={0}
                      step={0.001}
                      value={dayOpenShiftCounts[session.id] ?? (session.openingFloat ?? session.openingCash).toFixed(3)}
                      onChange={(event) => setDayOpenShiftCounts((previous) => ({
                        ...previous,
                        [session.id]: event.target.value,
                      }))}
                    />
                  </Field>
                )
              })}
            </>
          ) : (
            <Field label="Staff working float (DT)" hint="Enter the amount set aside for staff to work with today. It can change each day.">
              <Input
                type="number"
                min={0}
                step={0.001}
                value={dayStaffFloatInput}
                onChange={(event) => setDayStaffFloatInput(event.target.value)}
              />
            </Field>
          )}
          <Field label="Counted cash (DT)">
            <Input type="number" min={0} step={0.001} value={dayCountedInput} onChange={(event) => setDayCountedInput(event.target.value)} />
          </Field>
          <div className="rounded-xl border border-line px-3 py-2 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted">Cash difference</span><strong>{money(dayCashDifference)}</strong></div>
          </div>
          <Field label="Day-end note" hint="Optional">
            <Textarea value={dayCloseNote} onChange={(event) => setDayCloseNote(event.target.value)} rows={3} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={forceSession !== null}
        onClose={() => setForceSession(null)}
        title="Force-close shift"
        subtitle={forceSession?.openedByName}
        size="sm"
        footer={<div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setForceSession(null)}>Cancel</Button>
          <Button variant="danger" disabled={!forceReason.trim() || !Number.isFinite(Number(forceCountedInput))} onClick={submitForceClose}>Force close</Button>
        </div>}
      >
        <div className="space-y-3">
          <Field label="Counted cash including float (DT)">
            <Input type="number" min={0} step={0.001} value={forceCountedInput} onChange={(event) => setForceCountedInput(event.target.value)} />
          </Field>
          <Field label="Reason (required)">
            <Textarea value={forceReason} onChange={(event) => setForceReason(event.target.value)} rows={3} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

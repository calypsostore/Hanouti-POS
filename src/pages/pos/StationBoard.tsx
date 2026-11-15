import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChefHat, Clock3, LogOut, Printer, Volume2, VolumeX } from 'lucide-react'
import { PrintModal, type PrintJob } from '../../components/PrintPreview'
import { AppIcon } from '../../components/AppIcon'
import { Button, Select } from '../../components/ui'
import { useToast } from '../../components/toast'
import { buildStationTicketLines, buildStationTickets } from '../../lib/tickets'
import { linesToEscpos } from '../../lib/escpos'
import { scopeOrdersToDeviceStations } from '../../lib/stationDevices'
import { useApp } from '../../store/AppStore'
import type { OpenOrder, OrderItem, OrderItemStatus } from '../../types'

type BoardStatus = 'sent' | 'preparing' | 'ready'
type TicketGroup = {
  key: string
  order: OpenOrder
  stationId: string
  status: BoardStatus
  items: OrderItem[]
}

const STATUSES: Array<{ value: BoardStatus; label: string }> = [
  { value: 'sent', label: 'New' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
]

const nextStatus: Record<BoardStatus, OrderItemStatus> = {
  sent: 'preparing',
  preparing: 'ready',
  ready: 'served',
}

const previousStatus: Partial<Record<BoardStatus, OrderItemStatus>> = {
  preparing: 'sent',
  ready: 'preparing',
}

function elapsedLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function StationBoard({
  deviceSession,
  deviceName,
  wakeLockAvailable = true,
  onExitRequest,
  hubConnected = false,
}: {
  deviceSession?: { deviceId: string; token: string; storeId: string; stationIds: string[] }
  deviceName?: string
  wakeLockAvailable?: boolean
  onExitRequest?: () => void
  hubConnected?: boolean
}) {
  const { stationId: routeStationId } = useParams()
  const { db, user, store: signedInStore, setOpenOrderItemStatus, updateDeviceOrderItemStatus } = useApp()
  const { push } = useToast()
  const [stationFilter, setStationFilter] = useState(
    deviceSession?.stationIds.length === 1 ? deviceSession.stationIds[0] : 'all',
  )
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [now, setNow] = useState(0)
  const [printJob, setPrintJob] = useState<PrintJob | null>(null)
  const [rushTickets, setRushTickets] = useState<Record<string, boolean>>({})
  const previousTickets = useRef<Set<string> | null>(null)
  const store = deviceSession
    ? db.stores.find((candidate) => candidate.id === deviceSession.storeId) ?? null
    : signedInStore
  const stations = db.stations.filter((station) =>
    station.storeId === store?.id && station.active && station.screen &&
    (!deviceSession || deviceSession.stationIds.includes(station.id)),
  ).sort((a, b) => a.sort - b.sort)
  const selectedStationId = routeStationId ?? stationFilter

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const tickets = useMemo(() => {
    const groups = new Map<string, TicketGroup>()
    const orders = deviceSession && store
      ? scopeOrdersToDeviceStations(db.openOrders, store.id, stations.map((station) => station.id))
      : db.openOrders
    for (const order of orders) {
      if (order.storeId !== store?.id) continue
      for (const item of order.items) {
        const status = item.status
        if (!item.stationId || !status || !['sent', 'preparing', 'ready'].includes(status)) continue
        if (selectedStationId !== 'all' && item.stationId !== selectedStationId) continue
        if (!stations.some((station) => station.id === item.stationId)) continue
        const key = `${order.id}:${item.stationId}:${status}`
        const group = groups.get(key)
        if (group) group.items.push(item)
        else groups.set(key, {
          key,
          order,
          stationId: item.stationId,
          status: status as BoardStatus,
          items: [item],
        })
      }
    }
    return [...groups.values()].sort((a, b) => {
      const aTime = Math.min(...a.items.map((item) => Date.parse(item.sentAt ?? item.addedAt ?? a.order.updatedAt)))
      const bTime = Math.min(...b.items.map((item) => Date.parse(item.sentAt ?? item.addedAt ?? b.order.updatedAt)))
      return aTime - bTime
    })
  }, [db.openOrders, deviceSession, selectedStationId, stations, store])

  useEffect(() => {
    const current = new Set(tickets.filter((ticket) => ticket.status === 'sent')
      .flatMap((ticket) => ticket.items.map((item) => `${ticket.order.id}:${item.lineId}`)))
    if (previousTickets.current && soundEnabled &&
      [...current].some((id) => !previousTickets.current?.has(id))) {
      const AudioContextConstructor = window.AudioContext
      if (AudioContextConstructor) {
        const context = new AudioContextConstructor()
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.frequency.value = 880
        gain.gain.value = 0.08
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.onended = () => { void context.close() }
        oscillator.start()
        oscillator.stop(context.currentTime + 0.16)
      }
    }
    previousTickets.current = current
  }, [soundEnabled, tickets])

  if (!store) return null
  const selectedStation = stations.find((station) => station.id === selectedStationId)
  const threshold = store.settings.stationTimerMinutes * 60_000

  const updateTicket = async (ticket: TicketGroup, target: OrderItemStatus) => {
    let updated = 0
    for (const item of ticket.items) {
      if (!item.lineId) continue
      const result = deviceSession
        ? await updateDeviceOrderItemStatus(deviceSession.deviceId, deviceSession.token, ticket.order.id, item.lineId, target)
        : setOpenOrderItemStatus(ticket.order.id, item.lineId, target)
      if (!result.ok) {
        push(result.error, 'error')
        return
      }
      updated += 1
    }
    if (updated) push(target === 'served' ? 'Items marked served' : `Ticket moved to ${target}`, 'success')
  }

  const reprint = (ticket: TicketGroup) => {
    const station = stations.find((item) => item.id === ticket.stationId)
    if (!station) return
    const stationTickets = buildStationTickets(
      ticket.order,
      ticket.items,
      [station],
      'REPRINT',
      rushTickets[ticket.key] === true,
    )
    if (!stationTickets.length) {
      push('This ticket has no printable station items.', 'error')
      return
    }
    const lines = buildStationTicketLines(stationTickets[0])
    setPrintJob({
      title: 'Reprint station ticket',
      subtitle: `${station.name} · ${ticket.order.tableName}`,
      lines,
      bytes: linesToEscpos(lines, store.settings.printer.width),
      kind: 'kitchen',
      stationId: station.id,
    })
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-cream-50 p-3 text-ink sm:p-5">
      <header className="mb-4 flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <ChefHat className="h-7 w-7 text-accent-foreground" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold">{selectedStation?.name ?? 'Kitchen & Bar'}</h1>
          <p className="text-xs text-muted">{deviceName ?? 'Station tickets'} · {store.name}</p>
        </div>
        {routeStationId ? (
          selectedStation && <AppIcon name={selectedStation.icon} color={selectedStation.color} size={18} className="h-10 w-10 rounded-xl" />
        ) : deviceSession ? (
          <div className="flex max-w-full gap-2 overflow-x-auto">
            {stations.length > 1 && <Button size="sm" variant={selectedStationId === 'all' ? 'primary' : 'secondary'} className="min-h-11 shrink-0" onClick={() => setStationFilter('all')}>All</Button>}
            {stations.map((station) => (
              <Button
                key={station.id}
                size="sm"
                variant={selectedStationId === station.id ? 'primary' : 'secondary'}
                className="min-h-11 shrink-0"
                onClick={() => setStationFilter(station.id)}
              >
                {station.name}
              </Button>
            ))}
          </div>
        ) : (
          <Select aria-label="Filter by station" value={selectedStationId} onChange={(event) => setStationFilter(event.target.value)} className="w-40">
            <option value="all">All stations</option>
            {stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
          </Select>
        )}
        <Button variant="secondary" onClick={() => setSoundEnabled((enabled) => !enabled)} aria-label={soundEnabled ? 'Disable new-ticket sound' : 'Enable new-ticket sound'}>
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {soundEnabled ? 'Sound on' : 'Enable sound'}
        </Button>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-900">
          {hubConnected ? 'Connected to shop hub' : 'Same device only'}
        </span>
        {!wakeLockAvailable && deviceSession && <span className="text-[10px] text-muted">Screen may sleep</span>}
        {onExitRequest && (
          <Button variant="ghost" className="min-h-11" onClick={onExitRequest}>
            <LogOut className="h-4 w-4" /> Exit kiosk
          </Button>
        )}
      </header>

      {!hubConnected && (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
          This screen only sees orders from this browser/device. Connect through the{' '}
          <a className="font-semibold underline" href="https://github.com/calypsostore/cafeteria-POS/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noreferrer">shop hub</a>
          {' '}to receive orders from other phones.
        </p>
      )}
      {!stations.length && (
        <p className="mb-3 rounded-xl border border-line bg-white px-3 py-3 text-sm text-muted">
          No station screens are enabled for this store. An admin can turn on “Has screen” in Settings → Stations.
        </p>
      )}
      {stations.length > 0 && !tickets.length && (
        <p className="mb-3 rounded-xl border border-line bg-white px-3 py-3 text-sm text-muted">
          No active tickets. Open a table order and send an item to a station; new tickets will appear here.
          {!deviceSession && ' To use another screen, add and pair it in Settings → Stations → Devices.'}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden md:grid-cols-3">
        {STATUSES.map((column) => {
          const columnTickets = tickets.filter((ticket) => ticket.status === column.value)
          return (
            <section key={column.value} className="flex min-h-0 flex-col rounded-2xl border border-line bg-white/70 p-3">
              <h2 className="mb-3 flex items-center justify-between text-sm font-bold">
                {column.label}<span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs">{columnTickets.length}</span>
              </h2>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                {columnTickets.map((ticket) => {
                  const station = stations.find((item) => item.id === ticket.stationId)
                  const recallStatus = previousStatus[ticket.status]
                  const startedAt = Math.min(...ticket.items.map((item) =>
                    Date.parse(item.updatedAt ?? item.sentAt ?? item.addedAt ?? ticket.order.updatedAt),
                  ))
                  const elapsed = now - startedAt
                  const timerStyle = elapsed >= threshold * 2
                    ? 'border-red-300 bg-red-50'
                    : elapsed >= threshold
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-emerald-200 bg-emerald-50'
                  return (
                    <article key={ticket.key} className={`rounded-xl border p-3 shadow-sm ${timerStyle}`}>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-extrabold">{ticket.order.tableName}</h3>
                          <p className="text-xs font-medium text-muted">
                            {station?.name}{ticket.order.sectionName ? ` · ${ticket.order.sectionName}` : ''}
                            {ticket.order.guests ? ` · ${ticket.order.guests} guests` : ''}
                          </p>
                          <p className="text-xs text-muted">{ticket.order.staffName} · Order #{ticket.order.number}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-bold tabular">
                          <Clock3 className="h-4 w-4" /> {elapsedLabel(elapsed)}
                        </span>
                      </div>
                      <ul className="my-3 space-y-2 border-y border-black/10 py-2">
                        {ticket.items.map((item) => (
                          <li key={item.lineId} className="text-sm">
                            <strong className="text-lg">{item.soldByWeight ? item.qty.toFixed(3) : item.qty}× {item.name}</strong>
                            {item.variantName && <span className="block text-xs">{item.variantName}</span>}
                            {!!item.modifiers?.length && <span className="block text-xs">{item.modifiers.map((modifier) => modifier.optionName).join(', ')}</span>}
                            {item.note && <span className="block text-xs font-semibold">Note: {item.note}</span>}
                          </li>
                        ))}
                      </ul>
                      {!user?.stationOnly && (
                        <label className="mb-2 flex items-center gap-2 text-xs font-semibold">
                          <input
                            type="checkbox"
                            checked={rushTickets[ticket.key] === true}
                            onChange={(event) => setRushTickets((previous) => ({ ...previous, [ticket.key]: event.target.checked }))}
                          />
                          Rush on reprint
                        </label>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {!user?.stationOnly && (
                        <Button size="sm" variant="secondary" className={deviceSession ? 'min-h-11' : undefined} onClick={() => reprint(ticket)}>
                          <Printer className="h-4 w-4" /> Reprint
                        </Button>
                        )}
                        {recallStatus && (
                          <Button size="sm" variant="ghost" className={deviceSession ? 'min-h-11' : undefined} onClick={() => { void updateTicket(ticket, recallStatus) }}>
                            Recall
                          </Button>
                        )}
                        <Button size="sm" className={`ml-auto ${deviceSession ? 'min-h-11' : ''}`} onClick={() => { void updateTicket(ticket, nextStatus[ticket.status]) }}>
                          {ticket.status === 'ready' ? 'Served' : 'Bump'}
                        </Button>
                      </div>
                    </article>
                  )
                })}
                {!columnTickets.length && <p className="py-8 text-center text-sm text-muted">No tickets</p>}
              </div>
            </section>
          )
        })}
      </div>
      <PrintModal job={printJob} onClose={() => setPrintJob(null)} />
    </main>
  )
}

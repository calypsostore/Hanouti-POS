import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChefHat, Clock3, Merge, MoveRight, Plus, Utensils } from 'lucide-react'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { useToast } from '../../components/toast'
import { can } from '../../lib/permissions'
import { guestCountError } from '../../lib/tableService'
import { openShiftForStaff } from '../../lib/registerShifts'
import { fmtTime, money } from '../../lib/utils'
import { useApp } from '../../store/AppStore'
import type { DiningTable, OpenOrder } from '../../types'

type FloorFilter = 'mine' | 'all' | 'unassigned'
type FloorItem = { key: string; name: string; sectionId?: string; table?: DiningTable; order?: OpenOrder }

const elapsedLabel = (order: OpenOrder, now: number) => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(order.createdAt)) / 60_000))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export default function TableFloor() {
  const {
    db, store, user, openTableOrder, moveOrderToTable, mergeTableOrders, cancelOpenOrder,
    takeOverTables, handoverTables,
  } = useApp()
  const { push } = useToast()
  const navigate = useNavigate()
  const [now, setNow] = useState(0)
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({})
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({})
  const [handoverTarget, setHandoverTarget] = useState<Record<string, string>>({})
  const [cancelOrder, setCancelOrder] = useState<OpenOrder | null>(null)
  const [managerPin, setManagerPin] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [startTable, setStartTable] = useState<{ id?: string; name: string } | null>(null)
  const [startGuests, setStartGuests] = useState<number>()
  const [manualName, setManualName] = useState('')
  const [filter, setFilter] = useState<FloorFilter>('all')
  const [sectionFilter, setSectionFilter] = useState('all')

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      window.clearTimeout(initialUpdate)
      window.clearInterval(timer)
    }
  }, [])

  if (!store || !user) return null
  const tables = db.tables
    .filter((table) => table.storeId === store.id && table.active)
    .sort((a, b) => a.sort - b.sort)
  const sections = db.sections
    .filter((section) => section.storeId === store.id && section.active)
    .sort((a, b) => a.sort - b.sort)
  const orders = db.openOrders.filter((order) => order.storeId === store.id)
  const canTakeHandover = can(user, 'takeOverTables') && !!openShiftForStaff(db, store.id, user.id)
  const manualMode = store.settings.tableMode === 'manual'
  const tableFilter = (item: FloorItem) =>
    sectionFilter === 'all' || item.sectionId === sectionFilter
  const ownerFilter = (item: FloorItem) => {
    if (filter === 'all') return true
    if (filter === 'mine') return !item.order || item.order.staffId === user.id
    return !!item.order && item.order.staffId === 'unassigned-handover'
  }
  const floorItems: FloorItem[] = manualMode
    ? orders.map((order) => ({ key: order.id, name: order.tableName, sectionId: order.sectionId, order }))
    : tables.map((table) => ({
        key: table.id,
        name: table.name,
        sectionId: table.sectionId,
        table,
        order: orders.find((order) => order.tableId === table.id),
      }))
  const visibleItems = floorItems.filter((item) => tableFilter(item) && ownerFilter(item))
  const groups = store.settings.tableMode === 'sections_tables'
    ? [...sections.map((section) => ({
        key: section.id,
        name: section.name,
        items: visibleItems.filter((item) => item.sectionId === section.id),
      })), {
        key: 'unsectioned',
        name: 'No section',
        items: visibleItems.filter((item) => !sections.some((section) => section.id === item.sectionId)),
      }]
    : [{ key: 'tables', name: 'Tables', items: visibleItems }]

  const beginOpenTable = (tableId?: string, name?: string) => {
    setStartTable(tableId ? { id: tableId, name: name ?? 'Table' } : { name: '' })
    setStartGuests(undefined)
    setManualName('')
  }

  const confirmOpenTable = () => {
    if (!startTable) return
    const tableName = manualMode ? manualName.trim() : startTable.name
    const guestsError = guestCountError(startGuests, store.settings.guestRequirement)
    if (guestsError) {
      push(guestsError, 'error')
      return
    }
    const result = openTableOrder(
      store.id,
      manualMode ? undefined : startTable.id,
      store.settings.guestRequirement === 'off' ? undefined : startGuests,
      tableName,
    )
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Opened ${result.order.tableName}`, 'success')
    setStartTable(null)
    navigate(`/pos?channel=dine-in&orderId=${encodeURIComponent(result.order.id)}`)
  }

  const openOrder = (order: OpenOrder) =>
    navigate(`/pos?channel=dine-in&orderId=${encodeURIComponent(order.id)}`)

  const move = (order: OpenOrder) => {
    const target = moveTarget[order.id]
    if (!target) {
      push('Choose a destination table first.', 'error')
      return
    }
    const result = moveOrderToTable(order.id, target)
    if (!result.ok) push(result.error, 'error')
    else {
      push('Table order moved.', 'success')
      setMoveTarget((current) => ({ ...current, [order.id]: '' }))
    }
  }

  const merge = (order: OpenOrder) => {
    const target = mergeTarget[order.id]
    if (!target) {
      push('Choose a table order to merge into.', 'error')
      return
    }
    const result = mergeTableOrders(order.id, target)
    if (!result.ok) push(result.error, 'error')
    else {
      push('Table orders merged.', 'success')
      setMergeTarget((current) => ({ ...current, [order.id]: '' }))
    }
  }

  const cancel = async () => {
    if (!cancelOrder) return
    setCancelling(true)
    const result = await cancelOpenOrder(cancelOrder.id, managerPin)
    setCancelling(false)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Open table order cancelled.', 'success')
    setCancelOrder(null)
    setManagerPin('')
  }

  if (!store.settings.features.tables) {
    return <div className="p-6 text-sm text-muted">Table service is disabled for this store.</div>
  }

  return (
    <main className="min-h-screen bg-canvas p-3 text-ink sm:p-6">
      <header className="mx-auto mb-5 flex max-w-6xl items-center gap-3">
        <Button variant="secondary" onClick={() => navigate('/pos?channel=dine-in&focus=table')}>
          <ArrowLeft className="h-4 w-4" /> POS
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold">Table floor</h1>
          <p className="truncate text-xs text-muted">{store.name} · Open table orders</p>
        </div>
        {manualMode && <Button onClick={() => beginOpenTable()}><Plus className="h-4 w-4" /> Start table</Button>}
      </header>

      <div className="mx-auto max-w-6xl space-y-4">
        {canTakeHandover && orders.some((order) => order.staffId === 'unassigned-handover') && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
            <strong>{orders.filter((order) => order.staffId === 'unassigned-handover').length} tables waiting</strong>
            <Button size="sm" onClick={() => {
              const result = takeOverTables(orders
                .filter((order) => order.staffId === 'unassigned-handover')
                .map((order) => order.id))
              if (!result.ok) push(result.error, 'error')
              else push('Handover tables assigned to you.', 'success')
            }}>Take all</Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {(['mine', 'all', 'unassigned'] as const).map((value) => (
            <Button key={value} variant={filter === value ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter(value)}>
              {value === 'mine' ? 'My tables' : value === 'all' ? 'All' : 'Unassigned (handover)'}
            </Button>
          ))}
        </div>
        {store.settings.tableMode === 'sections_tables' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={sectionFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setSectionFilter('all')}>All sections</Button>
            {sections.map((section) => (
              <Button key={section.id} size="sm" variant={sectionFilter === section.id ? 'primary' : 'secondary'} onClick={() => setSectionFilter(section.id)}>{section.name}</Button>
            ))}
          </div>
        )}
        {groups.map((group) => group.items.length > 0 && (
          <section key={group.key}>
            {store.settings.tableMode === 'sections_tables' && <h2 className="mb-2 text-sm font-bold text-muted">{group.name}</h2>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => {
                const order = item.order
                const allSent = !!order?.items.length && order.items.every((entry) => entry.sentAt)
                const section = sections.find((candidate) => candidate.id === item.sectionId)
                const mine = !order || order.staffId === user.id
                return (
                  <article key={item.key} className={`rounded-2xl border p-4 shadow-sm ${
                    !order
                      ? 'border-line bg-surface'
                      : mine
                        ? allSent ? 'border-[var(--semantic-green-border)] bg-[var(--semantic-green-soft)]' : 'border-brand-amber/40 bg-brand-amber-soft'
                        : 'border-[var(--semantic-blue-border)] bg-[var(--semantic-blue-soft)]'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70">
                        {order ? <Utensils className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate font-bold">{item.name}</h3>
                          {item.table && <span className="text-[11px] text-muted">{item.table.seats} seats</span>}
                        </div>
                        {order ? (
                          <>
                            <p className="mt-1 text-[13px] font-bold">{money(order.total)}</p>
                            <div className="mt-1 flex flex-wrap gap-3 text-[10.5px] text-muted">
                              <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {elapsedLabel(order, now)}</span>
                              <span>{order.items.length} lines · {fmtTime(order.createdAt)}</span>
                              {order.guests !== undefined && <span>{order.guests} guests</span>}
                              <span>{section?.name ?? 'No section'}</span>
                              <span>{order.staffName || 'Unassigned'}</span>
                              {allSent && <span className="inline-flex items-center gap-1"><ChefHat className="h-3 w-3" /> Sent</span>}
                            </div>
                          </>
                        ) : <p className="mt-1 text-xs text-muted">Available</p>}
                      </div>
                    </div>
                    {order ? (
                      <div className="mt-3 space-y-2 border-t border-line/60 pt-3">
                        <Button className="w-full" onClick={() => openOrder(order)}>Open order</Button>
                        {order.staffId === 'unassigned-handover' && canTakeHandover && (
                          <Button variant="secondary" className="w-full" onClick={() => {
                            const result = takeOverTables([order.id])
                            if (!result.ok) push(result.error, 'error')
                            else push(`${order.tableName} assigned to you.`, 'success')
                          }}>Take this table</Button>
                        )}
                        {can(user, 'manageTables') && (
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <Select value={handoverTarget[order.id] ?? ''} onChange={(event) =>
                              setHandoverTarget((current) => ({ ...current, [order.id]: event.target.value }))
                            }>
                              <option value="">Unassigned (handover)</option>
                              {db.users.filter((member) => member.storeId === store.id && member.active &&
                                member.id !== user.id && db.registerSessions.some((session) =>
                                  session.storeId === store.id && session.status === 'open' &&
                                  (session.staffId ?? session.openedById) === member.id,
                                )).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                            </Select>
                            <Button variant="secondary" size="sm" onClick={() => {
                              const result = handoverTables(store.id, [order.id], handoverTarget[order.id] || undefined)
                              if (!result.ok) push(result.error, 'error')
                              else push('Table ownership updated.', 'success')
                            }}>Reassign</Button>
                          </div>
                        )}
                        {!manualMode && (
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <Select value={moveTarget[order.id] ?? ''} onChange={(event) => setMoveTarget((current) => ({ ...current, [order.id]: event.target.value }))}>
                              <option value="">Move to table…</option>
                              {tables.filter((candidate) => candidate.id !== order.tableId && !orders.some((entry) => entry.tableId === candidate.id)).map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                              ))}
                            </Select>
                            <Button variant="secondary" aria-label="Move order" onClick={() => move(order)}><MoveRight className="h-4 w-4" /></Button>
                          </div>
                        )}
                        {orders.length > 1 && (
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <Select value={mergeTarget[order.id] ?? ''} onChange={(event) => setMergeTarget((current) => ({ ...current, [order.id]: event.target.value }))}>
                              <option value="">Merge into…</option>
                              {orders.filter((candidate) => candidate.id !== order.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.tableName}</option>)}
                            </Select>
                            <Button variant="secondary" aria-label="Merge orders" onClick={() => merge(order)}><Merge className="h-4 w-4" /></Button>
                          </div>
                        )}
                        <Button variant="danger" className="w-full" onClick={() => setCancelOrder(order)}>Cancel open order</Button>
                      </div>
                    ) : (
                      <Button className="mt-3 w-full" onClick={() => beginOpenTable(item.table?.id, item.name)}>Start table order</Button>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        ))}
        {!visibleItems.length && <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">No tables or open orders match these filters.</div>}
        {!tables.length && !manualMode && (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            {user.role === 'staff'
              ? <p>No tables yet, ask your manager.</p>
              : <div className="space-y-3"><p>No active tables yet. Add tables to use the floor view.</p>{can(user, 'manageTables') && <Button variant="secondary" onClick={() => navigate('/admin/settings?tab=tables')}>Add tables</Button>}</div>}
          </div>
        )}
      </div>

      <Modal open={!!startTable} onClose={() => setStartTable(null)} title={`Start ${manualMode ? 'table order' : startTable?.name ?? 'table order'}`} size="sm" footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setStartTable(null)}>Cancel</Button>
          <Button onClick={confirmOpenTable}>Open table</Button>
        </div>
      }>
        <div className="space-y-3">
          {manualMode && (
            <Field label="Table name or number">
              <>
                <Input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="e.g. 12 or Window" maxLength={60} list="floor-open-table-names" />
                <datalist id="floor-open-table-names">{orders.map((order) => <option key={order.id} value={order.tableName} />)}</datalist>
              </>
            </Field>
          )}
          {store.settings.guestRequirement !== 'off' && (
            <Field label="Guests" hint={store.settings.guestRequirement === 'required' ? 'required' : 'optional'}>
              <Input type="number" min={1} max={50} step={1} value={startGuests ?? ''} onChange={(event) => setStartGuests(event.target.value ? Number(event.target.value) : undefined)} />
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={!!cancelOrder}
        onClose={() => {
          if (cancelling) return
          setCancelOrder(null)
          setManagerPin('')
        }}
        title="Cancel open order"
        subtitle="An active store admin PIN is required. The order will be removed without affecting stock or sales."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={cancelling} onClick={() => setCancelOrder(null)}>Keep order</Button>
            <Button variant="danger" disabled={cancelling || !managerPin.trim()} onClick={() => void cancel()}>{cancelling ? 'Checking…' : 'Cancel order'}</Button>
          </div>
        }
      >
        <Input type="password" inputMode="numeric" autoComplete="off" value={managerPin} onChange={(event) => setManagerPin(event.target.value)} placeholder="Manager PIN" aria-label="Manager PIN" />
      </Modal>
    </main>
  )
}

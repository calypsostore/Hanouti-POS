import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChefHat, Clock3, Merge, MoveRight, Plus, Utensils } from 'lucide-react'
import { Button, Input, Modal, Select } from '../../components/ui'
import { useToast } from '../../components/toast'
import { can } from '../../lib/permissions'
import { fmtTime, money } from '../../lib/utils'
import { useApp } from '../../store/AppStore'
import type { OpenOrder } from '../../types'

const elapsedLabel = (order: OpenOrder, now: number) => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(order.createdAt)) / 60_000))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export default function TableFloor() {
  const { db, store, user, openTableOrder, moveOrderToTable, mergeTableOrders, cancelOpenOrder } = useApp()
  const { push } = useToast()
  const navigate = useNavigate()
  const [now, setNow] = useState(0)
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({})
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({})
  const [cancelOrder, setCancelOrder] = useState<OpenOrder | null>(null)
  const [managerPin, setManagerPin] = useState('')
  const [cancelling, setCancelling] = useState(false)

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
  const orders = db.openOrders.filter((order) => order.storeId === store.id)
  const zones = Array.from(new Set(tables.map((table) => table.zone?.trim() || 'Other')))

  const openTable = (tableId: string) => {
    const result = openTableOrder(store.id, tableId)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Opened ${result.order.tableName}`, 'success')
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
      </header>

      <div className="mx-auto max-w-6xl space-y-6">
        {zones.map((zone) => (
          <section key={zone}>
            <h2 className="mb-2 text-sm font-bold text-muted">{zone}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tables.filter((table) => (table.zone?.trim() || 'Other') === zone).map((table) => {
                const order = orders.find((item) => item.tableId === table.id)
                const allSent = !!order?.items.length && order.items.every((item) => item.sentAt)
                return (
                  <article
                    key={table.id}
                    className={`rounded-2xl border p-4 shadow-sm ${
                      order
                        ? allSent
                          ? 'border-[var(--semantic-blue-border)] bg-[var(--semantic-blue-soft)]'
                          : 'border-brand-amber/40 bg-brand-amber-soft'
                        : 'border-line bg-surface'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70">
                        {order ? <Utensils className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate font-bold">{table.name}</h3>
                          <span className="text-[11px] text-muted">{table.seats} seats</span>
                        </div>
                        {order ? (
                          <>
                            <p className="mt-1 text-[13px] font-bold">{money(order.total)}</p>
                            <div className="mt-1 flex flex-wrap gap-3 text-[10.5px] text-muted">
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3" /> {elapsedLabel(order, now)}
                              </span>
                              <span>{order.items.length} lines · {fmtTime(order.createdAt)}</span>
                              {allSent && <span className="inline-flex items-center gap-1"><ChefHat className="h-3 w-3" /> Sent</span>}
                            </div>
                          </>
                        ) : (
                          <p className="mt-1 text-xs text-muted">Available</p>
                        )}
                      </div>
                    </div>

                    {order ? (
                      <div className="mt-3 space-y-2 border-t border-line/60 pt-3">
                        <Button className="w-full" onClick={() => openOrder(order)}>Open order</Button>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <Select
                            value={moveTarget[order.id] ?? ''}
                            onChange={(event) => setMoveTarget((current) => ({
                              ...current,
                              [order.id]: event.target.value,
                            }))}
                          >
                            <option value="">Move to table…</option>
                            {tables.filter((candidate) =>
                              candidate.id !== order.tableId && !orders.some((item) => item.tableId === candidate.id),
                            ).map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                            ))}
                          </Select>
                          <Button variant="secondary" aria-label="Move order" onClick={() => move(order)}>
                            <MoveRight className="h-4 w-4" />
                          </Button>
                        </div>
                        {orders.length > 1 && (
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <Select
                              value={mergeTarget[order.id] ?? ''}
                              onChange={(event) => setMergeTarget((current) => ({
                                ...current,
                                [order.id]: event.target.value,
                              }))}
                            >
                              <option value="">Merge into…</option>
                              {orders.filter((candidate) => candidate.id !== order.id).map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>{candidate.tableName}</option>
                              ))}
                            </Select>
                            <Button variant="secondary" aria-label="Merge orders" onClick={() => merge(order)}>
                              <Merge className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        <Button variant="danger" className="w-full" onClick={() => setCancelOrder(order)}>
                          Cancel open order
                        </Button>
                      </div>
                    ) : (
                      <Button className="mt-3 w-full" onClick={() => openTable(table.id)}>Start table order</Button>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        ))}
        {!tables.length && (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            {user.role === 'staff'
              ? <p>No tables yet, ask your manager.</p>
              : <div className="space-y-3">
                  <p>No active tables yet. Add tables to use the floor view.</p>
                  {can(user, 'manageSettings') && (
                    <Button variant="secondary" onClick={() => navigate('/admin/settings?tab=tables')}>
                      Add tables
                    </Button>
                  )}
                </div>}
          </div>
        )}
      </div>

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
            <Button variant="danger" disabled={cancelling || !managerPin.trim()} onClick={() => void cancel()}>
              {cancelling ? 'Checking…' : 'Cancel order'}
            </Button>
          </div>
        }
      >
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={managerPin}
          onChange={(event) => setManagerPin(event.target.value)}
          placeholder="Manager PIN"
          aria-label="Manager PIN"
        />
      </Modal>
    </main>
  )
}

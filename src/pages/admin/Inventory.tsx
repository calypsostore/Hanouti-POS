import { useState } from 'react'
import { ClipboardCheck, PackagePlus, Pencil, Plus, Scale, Trash2, Wrench } from 'lucide-react'
import { Badge, Button, Card } from '../../components/ui'
import { useToast } from '../../components/toast'
import { can } from '../../lib/permissions'
import { formatInventoryQuantity } from '../../lib/inventory'
import { useApp } from '../../store/AppStore'
import type { InventoryItem } from '../../types'
import InventoryItemEditor from './inventory/InventoryItemEditor'
import StockActionModal, { type StockAction } from './inventory/StockActionModal'

const actionLabel: Record<StockAction, string> = {
  opening: 'Opening',
  waste: 'Waste',
  adjustment: 'Adjustment',
  count: 'Count',
}

export default function Inventory() {
  const {
    db,
    store,
    user,
    addInventoryItem,
    updateInventoryItem,
    recordOpeningStock,
    recordWaste,
    adjustStock,
    recordStockCount,
  } = useApp()
  const { push } = useToast()
  const [editor, setEditor] = useState<{ open: boolean; item?: InventoryItem }>({ open: false })
  const [stockAction, setStockAction] = useState<{ item: InventoryItem; action: StockAction } | null>(null)

  if (!store || !user) return null

  const items = db.inventoryItems
    .filter((item) => item.storeId === store.id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const activeItems = items.filter((item) => item.active)
  const lowStock = activeItems.filter((item) => item.onHand <= item.reorderLevel).length
  const showCosts = can(user, 'viewCosts')
  const recentMovements = db.stockMovements
    .filter((movement) => movement.storeId === store.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)

  const saveItem = (data: Parameters<typeof addInventoryItem>[1]) => {
    const result = editor.item
      ? updateInventoryItem(editor.item.id, data)
      : addInventoryItem(store.id, data)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(editor.item ? 'Inventory item updated' : 'Inventory item added')
    setEditor({ open: false })
  }

  const saveStockAction = (quantity: number, reason: string) => {
    if (!stockAction) return
    const { item, action } = stockAction
    const result = action === 'opening'
      ? recordOpeningStock(item.id, quantity, reason)
      : action === 'waste'
        ? recordWaste(item.id, quantity, reason)
        : action === 'adjustment'
          ? adjustStock(item.id, quantity, reason)
          : recordStockCount(item.id, quantity, reason)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`${actionLabel[action]} recorded`)
    setStockAction(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">Inventory</h1>
          <p className="mt-1 text-[13px] text-muted">Track ingredients and supplies in their base units.</p>
        </div>
        <Button onClick={() => setEditor({ open: true })}>
          <Plus className="h-4 w-4" /> New item
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs font-medium text-muted">Inventory items</div>
          <div className="mt-1 text-2xl font-extrabold text-ink">{activeItems.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-muted">Low stock</div>
          <div className="mt-1 text-2xl font-extrabold text-ink">{lowStock}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-muted">Stock movements</div>
          <div className="mt-1 text-2xl font-extrabold text-ink">
            {db.stockMovements.filter((movement) => movement.storeId === store.id).length}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/70 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-bold text-ink">Stock on hand</h2>
            <p className="mt-0.5 text-xs text-muted">Stock changes are recorded in an append-only ledger.</p>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">Add an inventory item to get started.</div>
        ) : (
          <>
            <div className="divide-y divide-line/70 md:hidden">
              {items.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  openingEligible={item.onHand === 0 && !db.stockMovements.some((movement) => movement.itemId === item.id)}
                  showCosts={showCosts}
                  onEdit={() => setEditor({ open: true, item })}
                  onToggle={() => {
                    const result = updateInventoryItem(item.id, { active: !item.active })
                    if (!result.ok) push(result.error, 'error')
                    else push(item.active ? 'Inventory item deactivated' : 'Inventory item activated')
                  }}
                  onAction={(action) => setStockAction({ item, action })}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-cream-100/70 text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-bold">Item</th>
                    <th className="px-3 py-3 font-bold">On hand</th>
                    <th className="px-3 py-3 font-bold">Reorder at</th>
                    {showCosts && <th className="px-3 py-3 font-bold">Avg cost / unit</th>}
                    <th className="px-3 py-3 font-bold">Status</th>
                    <th className="px-5 py-3 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {items.map((item) => (
                    <tr key={item.id} className={!item.active ? 'opacity-55' : undefined}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-ink">{item.name}</div>
                        <div className="mt-0.5 text-xs capitalize text-muted">{item.category}</div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-ink">{formatInventoryQuantity(item.onHand, item.baseUnit)}</td>
                      <td className="px-3 py-3 text-muted">{formatInventoryQuantity(item.reorderLevel, item.baseUnit)}</td>
                      {showCosts && <td className="px-3 py-3 text-muted">{item.avgCostPerBaseUnit.toFixed(4)} TND</td>}
                      <td className="px-3 py-3">
                        <Badge tone={!item.active ? 'neutral' : item.onHand <= item.reorderLevel ? 'warning' : 'success'}>
                          {!item.active ? 'Inactive' : item.onHand <= item.reorderLevel ? 'Low stock' : 'In stock'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" title="Edit item" onClick={() => setEditor({ open: true, item })}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          {item.active && <StockActions
                            openingEligible={item.onHand === 0 && !db.stockMovements.some((movement) => movement.itemId === item.id)}
                            onAction={(action) => setStockAction({ item, action })}
                          />}
                          <Button size="icon" variant="ghost" title={item.active ? 'Deactivate item' : 'Activate item'} onClick={() => {
                            const result = updateInventoryItem(item.id, { active: !item.active })
                            if (!result.ok) push(result.error, 'error')
                            else push(item.active ? 'Inventory item deactivated' : 'Inventory item activated')
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line/70 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-bold text-ink">Recent stock activity</h2>
        </div>
        {recentMovements.length === 0 ? (
          <div className="p-6 text-sm text-muted">Opening stock and adjustments will appear here.</div>
        ) : (
          <div className="divide-y divide-line/60">
            {recentMovements.map((movement) => {
              const item = items.find((candidate) => candidate.id === movement.itemId)
              return (
                <div key={movement.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{item?.name ?? 'Inventory item'}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {movement.userName} · {new Date(movement.createdAt).toLocaleString()}
                      {movement.reason ? ` · ${movement.reason}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{movement.type.replace(/_/g, ' ')}</Badge>
                    <span className="min-w-20 text-right text-sm font-bold text-ink">
                      {movement.qtyDelta > 0 ? '+' : ''}{formatInventoryQuantity(movement.qtyDelta, item?.baseUnit ?? 'piece')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {editor.open && (
        <InventoryItemEditor
          key={editor.item?.id ?? 'new'}
          item={editor.item}
          onClose={() => setEditor({ open: false })}
          onSave={saveItem}
        />
      )}
      {stockAction && (
        <StockActionModal
          item={stockAction.item}
          action={stockAction.action}
          onClose={() => setStockAction(null)}
          onSave={saveStockAction}
        />
      )}
    </div>
  )
}

function StockActions({
  openingEligible,
  onAction,
}: {
  openingEligible: boolean
  onAction: (action: StockAction) => void
}) {
  return (
    <div className="flex gap-1">
      {openingEligible && <Button size="sm" variant="ghost" title="Record opening stock" onClick={() => onAction('opening')}>
        <PackagePlus className="h-3.5 w-3.5" /> Opening
      </Button>}
      <Button size="sm" variant="ghost" title="Record stock count" onClick={() => onAction('count')}>
        <ClipboardCheck className="h-3.5 w-3.5" /> Count
      </Button>
      <Button size="sm" variant="ghost" title="Record waste or stock adjustment" onClick={() => onAction('waste')}>
        <Scale className="h-3.5 w-3.5" /> Waste
      </Button>
      <Button size="sm" variant="ghost" title="Adjust stock" onClick={() => onAction('adjustment')}>
        <Wrench className="h-3.5 w-3.5" /> Adjust
      </Button>
    </div>
  )
}

function InventoryItemCard({
  item,
  openingEligible,
  showCosts,
  onEdit,
  onToggle,
  onAction,
}: {
  item: InventoryItem
  openingEligible: boolean
  showCosts: boolean
  onEdit: () => void
  onToggle: () => void
  onAction: (action: StockAction) => void
}) {
  const low = item.onHand <= item.reorderLevel
  return (
    <div className={`p-4 ${!item.active ? 'opacity-55' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-bold text-ink">{item.name}</div>
          <div className="mt-0.5 text-xs capitalize text-muted">{item.category}</div>
        </div>
        <Badge tone={!item.active ? 'neutral' : low ? 'warning' : 'success'}>
          {!item.active ? 'Inactive' : low ? 'Low stock' : 'In stock'}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><div className="text-muted">On hand</div><div className="mt-0.5 font-semibold text-ink">{formatInventoryQuantity(item.onHand, item.baseUnit)}</div></div>
        <div><div className="text-muted">Reorder at</div><div className="mt-0.5 font-semibold text-ink">{formatInventoryQuantity(item.reorderLevel, item.baseUnit)}</div></div>
        {showCosts && <div className="col-span-2"><div className="text-muted">Average unit cost</div><div className="mt-0.5 font-semibold text-ink">{item.avgCostPerBaseUnit.toFixed(4)} TND</div></div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        {item.active && <Button size="sm" variant="ghost" onClick={() => onAction('count')}><ClipboardCheck className="h-3.5 w-3.5" /> Count</Button>}
        {item.active && <Button size="sm" variant="ghost" onClick={() => onAction('waste')}><Scale className="h-3.5 w-3.5" /> Waste</Button>}
        {item.active && <Button size="sm" variant="ghost" onClick={() => onAction('adjustment')}><Wrench className="h-3.5 w-3.5" /> Adjust</Button>}
        {item.active && openingEligible && <Button size="sm" variant="ghost" onClick={() => onAction('opening')}><PackagePlus className="h-3.5 w-3.5" /> Opening stock</Button>}
        <Button size="sm" variant="ghost" onClick={onToggle}>{item.active ? 'Deactivate' : 'Activate'}</Button>
      </div>
    </div>
  )
}

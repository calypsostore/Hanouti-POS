import { useRef, useState } from 'react'
import { Barcode, ChevronRight, Flag, LayoutGrid, Plus, Search, ShoppingBag } from 'lucide-react'
import type { Category, InventoryItem, OrderChannel, Product, Store } from '../../types'
import { Button, EmptyState, Input } from '../../components/ui'
import { cn, money } from '../../lib/utils'
import { getProductImage } from '../../lib/productDisplay'
import { CategoryChip } from './CartPanel'
import { AppIcon } from '../../components/AppIcon'
import { ChannelSwitch } from './ChannelSwitch'
import { isUnavailable } from '../../lib/availability'

type ProductCatalogProps = {
  categories: Category[]
  products: Product[]
  hiddenOutOfStockCount?: number
  categoryId: string
  setCategoryId: (id: string) => void
  search: string
  setSearch: (value: string) => void
  channel: OrderChannel
  setChannel: (channel: OrderChannel) => void
  store: Store
  qtyInCart: (productId: string) => number
  addItem: (productId: string) => void
  onBarcodeScan: (code: string) => void
  count: number
  total: number
  hasCartItems: boolean
  onOpenCart: () => void
  lockedChannel?: boolean
  tableName?: string
  inventoryItems: InventoryItem[]
  availableStockFor?: (product: Product) => number
  onUnavailable: (message: string) => void
  canManage86: boolean
  onRequest86: (product: Product) => void
}

export function ProductCatalog({
  categories, products, hiddenOutOfStockCount = 0, categoryId, setCategoryId, search, setSearch, channel, setChannel, store, qtyInCart, addItem, onBarcodeScan,
  count, total, hasCartItems, onOpenCart, lockedChannel, tableName, inventoryItems, availableStockFor, onUnavailable, canManage86, onRequest86,
}: ProductCatalogProps) {
  const [scanCode, setScanCode] = useState('')
  const pressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)
  const hiddenStockMessage = hiddenOutOfStockCount > 0
    ? `${hiddenOutOfStockCount} active item${hiddenOutOfStockCount === 1 ? ' is' : 's are'} hidden because stock is unavailable. Restock it or turn off “Hide out of stock” in Settings.`
    : undefined
  return (
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="glass-subtle shrink-0 space-y-3 border-b border-line/70 px-4 pb-3 pt-4 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search the menu…"
                  className="pl-9"
                />
              </div>
              {lockedChannel ? (
                <span className="hidden rounded-full border border-line px-3 py-2 text-[11px] font-semibold text-muted sm:inline-flex">
                  Dine-in · {tableName}
                </span>
              ) : (
                <ChannelSwitch
                  channel={channel}
                  setChannel={setChannel}
                  allowDineIn={store.settings.features.tables}
                  allowDelivery={store.settings.features.delivery}
                  className="hidden sm:inline-flex"
                />
              )}
            </div>

            {store.settings.features.barcode && (
              <form
                className="relative max-w-[320px]"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (scanCode.trim()) onBarcodeScan(scanCode.trim())
                  setScanCode('')
                }}
              >
                <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
                <Input
                  value={scanCode}
                  onChange={(event) => setScanCode(event.target.value)}
                  placeholder="Scan barcode and press Enter"
                  className="pl-9"
                />
              </form>
            )}

            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
              <CategoryChip active={categoryId === 'all'} onClick={() => setCategoryId('all')}>
                <LayoutGrid className="h-3.5 w-3.5" /> All items
              </CategoryChip>
              {categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  active={categoryId === c.id}
                  onClick={() => setCategoryId(c.id)}
                >
                  <AppIcon name={c.icon} color={c.iconColor} size={14} className="h-6 w-6 rounded-lg" /> {c.name}
                </CategoryChip>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-28 sm:px-5 lg:pb-6 thin-scrollbar">
            {hiddenStockMessage && products.length > 0 && (
              <p role="status" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {hiddenStockMessage}
              </p>
            )}
            {products.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="h-5 w-5" />}
                title="No items found"
                description={hiddenStockMessage
                  ?? (search.trim()
                    ? 'Try another search or category.'
                    : 'Check that the product is active and belongs to this store and category.')}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {products.map((p) => {
                  const qty = qtyInCart(p.id)
                  const unavailableStates = (p.variants ?? []).map((variant) =>
                    isUnavailable(p, variant, store.settings.availability, inventoryItems, new Date(), store.settings.orderRules.deductIngredientsOnSale),
                  )
                  const availability = isUnavailable(p, undefined, store.settings.availability, inventoryItems, new Date(), store.settings.orderRules.deductIngredientsOnSale)
                  const out = p.variants?.length
                    ? unavailableStates.every((state) => state.unavailable)
                    : availability.unavailable
                  const remaining = availableStockFor?.(p) ?? p.stock
                  const low = store.settings.orderRules.showLowStockHints &&
                    Number.isFinite(remaining) && remaining > 0 && remaining <= store.settings.lowStockThreshold
                  const image = getProductImage(p)
                  return (
                    <button
                      key={p.id}
                      onPointerDown={() => {
                        if (!canManage86) return
                        longPressFired.current = false
                        pressTimer.current = window.setTimeout(() => {
                          longPressFired.current = true
                          onRequest86(p)
                        }, 650)
                      }}
                      onPointerUp={() => {
                        if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
                        pressTimer.current = null
                      }}
                      onPointerLeave={() => {
                        if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
                        pressTimer.current = null
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        if (canManage86) onRequest86(p)
                      }}
                      onClick={(event) => {
                        if (longPressFired.current) {
                          longPressFired.current = false
                          return
                        }
                        const bounds = event.currentTarget.getBoundingClientRect()
                        if (canManage86 && event.clientX >= bounds.right - 42 && event.clientY <= bounds.top + 44) {
                          onRequest86(p)
                          return
                        }
                        if (out) onUnavailable(`${p.name} is 86'd (${availability.reason || unavailableStates.find((state) => state.unavailable)?.reason || 'Unavailable'}).`)
                        else addItem(p.id)
                      }}
                      className={cn(
                        'glass-tile group relative flex flex-col rounded-2xl p-3 text-left transition-all duration-150',
                        'hover:-translate-y-0.5 hover:border-accent-foreground/80 hover:shadow-[0_6px_20px_rgba(17,27,48,0.09)]',
                        qty > 0 ? 'border-accent-foreground ring-2 ring-accent-foreground/30' : 'border-line/80',
                        out && 'cursor-not-allowed opacity-55 hover:translate-y-0',
                      )}
                      title={canManage86 ? 'Tap the flag or long-press to 86 this item' : undefined}
                    >
                      <div className="mb-2 flex w-full items-start justify-between">
                        {image
                          ? <img src={image} alt="" className="h-11 w-11 rounded-xl object-cover" />
                          : <AppIcon name={p.icon} color={p.iconColor} size={21} className="h-11 w-11 rounded-xl" />}
                        {out && (
                          <span className="rounded-md bg-[var(--semantic-red-solid)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                            86
                          </span>
                        )}
                        {canManage86 && !out && <Flag className="h-4 w-4 text-muted/70" aria-label="Long-press to 86 item" />}
                        {qty > 0 && (
                          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-amber px-1.5 text-[11px] font-bold text-brand-navy">
                            {qty}
                          </span>
                        )}
                        {low && !out && (
                          <span className="rounded-md bg-[var(--semantic-amber-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--semantic-amber-text)]">
                            Only {remaining} left
                          </span>
                        )}
                        {out && store.settings.availability.displayStyle === 'big_red_x' && (
                          <svg aria-hidden="true" viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
                            <path d="M12 12L88 88M88 12L12 88" fill="none" stroke="#dc2626" strokeWidth="13" strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                      <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">
                        {p.name}
                      </span>
                      <span className="mt-1.5 text-[13px] font-bold text-accent-foreground tabular">
                        {money(p.price)}
                      </span>
                      <span className="pointer-events-none absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-cream-100 text-muted opacity-0 transition group-hover:opacity-100">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mobile cart bar */}
          <div className="glass-strong fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl border-t border-line p-3 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[11px] text-muted">{count} item{count === 1 ? '' : 's'}</div>
                <div className="text-[16px] font-bold tabular">{money(total)}</div>
              </div>
              <Button onClick={onOpenCart} disabled={!hasCartItems}>
                View cart <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

  )
}

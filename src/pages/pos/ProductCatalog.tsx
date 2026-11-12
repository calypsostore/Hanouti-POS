import { useState } from 'react'
import { Barcode, ChevronRight, LayoutGrid, Plus, Search, ShoppingBag } from 'lucide-react'
import type { Category, OrderChannel, Product, Store } from '../../types'
import { Button, EmptyState, Input, Segmented } from '../../components/ui'
import { cn, money } from '../../lib/utils'
import { CategoryChip } from './CartPanel'

type ProductCatalogProps = {
  categories: Category[]
  products: Product[]
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
}

export function ProductCatalog({
  categories, products, categoryId, setCategoryId, search, setSearch, channel, setChannel, store, qtyInCart, addItem, onBarcodeScan,
  count, total, hasCartItems, onOpenCart,
}: ProductCatalogProps) {
  const [scanCode, setScanCode] = useState('')
  return (
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 space-y-3 border-b border-line/70 px-4 pb-3 pt-4 sm:px-5">
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
              <Segmented
                value={channel}
                onChange={setChannel}
                size="sm"
                options={[
                  { value: 'takeaway', label: 'Takeaway' },
                  { value: 'dine-in', label: 'Dine-in' },
                ]}
                className="hidden sm:inline-flex"
              />
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
                  <span>{c.emoji}</span> {c.name}
                </CategoryChip>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-28 sm:px-5 lg:pb-6 thin-scrollbar">
            {products.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="h-5 w-5" />}
                title="No items found"
                description="Try a different category or search term."
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {products.map((p) => {
                  const qty = qtyInCart(p.id)
                  const out = p.variants?.length
                    ? p.variants.every((variant) => variant.trackStock && variant.stock <= 0)
                    : p.trackStock && p.stock <= 0
                  const low = p.trackStock && p.stock > 0 && p.stock <= store.settings.lowStockThreshold
                  return (
                    <button
                      key={p.id}
                      onClick={() => addItem(p.id)}
                      disabled={out}
                      className={cn(
                        'group relative flex flex-col rounded-2xl border bg-white p-3 text-left transition-all duration-150',
                        'hover:-translate-y-0.5 hover:border-accent-foreground/80 hover:shadow-[0_6px_20px_rgba(17,27,48,0.09)]',
                        qty > 0 ? 'border-accent-foreground ring-2 ring-accent-foreground/30' : 'border-line/80',
                        out && 'cursor-not-allowed hover:translate-y-0',
                      )}
                    >
                      <div className="mb-2 flex w-full items-start justify-between">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream-100 text-[24px]">
                          {p.emoji}
                        </span>
                        {out && (
                          <span className="rounded-md bg-danger-strong px-1.5 py-0.5 text-[9px] font-bold text-white">
                            Out of stock
                          </span>
                        )}
                        {qty > 0 && (
                          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-amber px-1.5 text-[11px] font-bold text-brand-navy">
                            {qty}
                          </span>
                        )}
                        {low && !out && (
                          <span className="rounded-md bg-brand-amber-soft px-1.5 py-0.5 text-[9px] font-bold text-brand-navy">
                            {p.stock} left
                          </span>
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
          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white p-3 lg:hidden">
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

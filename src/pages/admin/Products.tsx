import { useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { Category, Product } from '../../types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Toggle,
} from '../../components/ui'
import { useToast } from '../../components/toast'
import { cn, money } from '../../lib/utils'

const emojis = [
  '☕', '🫖', '🧃', '🥐', '🥪', '🍰', '🥤', '💧', '🍋', '🍊', '🍓', '🍫',
  '🫓', '🥚', '🍗', '🧊', '🌿', '🧁', '🥙', '🍔', '🍕', '🍟', '🍩', '🍪',
  '🥗', '🍝', '🍳', '🧇', '🥞', '🍦', '🍹', '🥛', '🧋', '🍵', '🫘', '🥜',
]

export default function Products() {
  const { db, store, addCategory, updateCategory, deleteCategory, addProduct, updateProduct, deleteProduct } =
    useApp()
  const { push } = useToast()
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [productEditor, setProductEditor] = useState<{ open: boolean; product?: Product }>({ open: false })
  const [categoryEditor, setCategoryEditor] = useState<{ open: boolean; category?: Category }>({
    open: false,
  })
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null)

  if (!store) return null

  const categories = db.categories.filter((c) => c.storeId === store.id).sort((a, b) => a.sort - b.sort)
  const products = db.products.filter((p) => p.storeId === store.id)

  const filtered = products
    .filter((p) => categoryFilter === 'all' || p.categoryId === categoryFilter)
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  const lowStock = products.filter(
    (p) => p.trackStock && p.stock <= store.settings.lowStockThreshold,
  ).length
  const avgMargin =
    products.length > 0
      ? products.reduce((acc, p) => acc + (p.price > 0 ? (p.price - p.cost) / p.price : 0), 0) /
        products.length *
        100
      : 0
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Products</h2>
          <p className="mt-1 text-[13px] text-muted">
            Your menu, prices and stock — fully yours to shape.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCategoryEditor({ open: true })}>
            <Plus className="h-4 w-4" /> Category
          </Button>
          <Button onClick={() => setProductEditor({ open: true })} disabled={!categories.length}>
            <Plus className="h-4 w-4" /> New product
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Products" value={String(products.length)} icon={<Boxes className="h-4 w-4" />} />
        <Tile label="Categories" value={String(categories.length)} icon={<Boxes className="h-4 w-4" />} />
        <Tile label="Average margin" value={`${avgMargin.toFixed(0)}%`} icon={<TrendingUp className="h-4 w-4" />} />
        <Tile
          label="Low stock"
          value={String(lowStock)}
          icon={<AlertTriangle className="h-4 w-4" />}
          warn={lowStock > 0}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit p-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-semibold transition',
              categoryFilter === 'all' ? 'bg-espresso-900 text-cream-50' : 'text-muted hover:bg-cream-100 hover:text-ink',
            )}
          >
            <span>All items</span>
            <span className={cn('text-[10.5px] font-bold', categoryFilter === 'all' ? 'text-white/50' : 'text-muted/60')}>
              {products.length}
            </span>
          </button>
          <div className="mt-1 space-y-0.5">
            {categories.map((c) => {
              const count = products.filter((p) => p.categoryId === c.id).length
              const active = categoryFilter === c.id
              return (
                <div
                  key={c.id}
                  className={cn(
                    'group flex items-center gap-1 rounded-xl px-1 transition',
                    active ? 'bg-cream-200' : 'hover:bg-cream-100',
                  )}
                >
                  <button
                    onClick={() => setCategoryFilter(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-[12.5px] font-medium"
                  >
                    <span>{c.emoji}</span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="text-[10.5px] font-semibold text-muted/60">{count}</span>
                  </button>
                  <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => setCategoryEditor({ open: true, category: c })}
                      className="rounded-md p-1 text-muted hover:bg-white hover:text-ink"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setDeleteCategoryTarget(c)}
                      className="rounded-md p-1 text-muted hover:bg-white hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {!categories.length && (
            <p className="px-3 py-4 text-center text-[11px] text-muted">
              Create a category first.
            </p>
          )}
        </Card>

        <Card>
          <div className="border-b border-line/70 p-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="pl-9"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="No products here"
              description="Add your first item to start selling."
              action={
                categories.length ? (
                  <Button size="sm" onClick={() => setProductEditor({ open: true })}>
                    <Plus className="h-4 w-4" /> New product
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line/70 text-[10.5px] uppercase tracking-wider text-muted">
                      <th className="px-4 py-2.5 font-semibold">Product</th>
                      <th className="px-4 py-2.5 font-semibold">Category</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Price</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Cost</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Margin</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Stock</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Active</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0
                      const low = p.trackStock && p.stock <= store.settings.lowStockThreshold
                      return (
                        <tr key={p.id} className="border-b border-line/50 text-[12.5px]">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-100 text-base">
                                {p.emoji}
                              </span>
                              <span className="font-semibold text-ink">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-muted">{catName(p.categoryId)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular">{money(p.price)}</td>
                          <td className="px-4 py-2.5 text-right text-muted tabular">{money(p.cost)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={cn('font-semibold tabular', margin >= 50 ? 'text-emerald-600' : 'text-ink')}>
                              {margin.toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {p.trackStock ? (
                              <Badge tone={p.stock === 0 ? 'danger' : low ? 'warning' : 'neutral'}>
                                {p.stock}
                              </Badge>
                            ) : (
                              <span className="text-[10.5px] text-muted/60">untracked</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => updateProduct(p.id, { active: !p.active })}
                              className={cn(
                                'relative inline-flex h-[20px] w-[34px] rounded-full transition-colors',
                                p.active ? 'bg-accent-600' : 'bg-espresso-900/15',
                              )}
                              aria-label="Toggle active"
                            >
                              <span
                                className={cn(
                                  'absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-all',
                                  p.active ? 'left-[16px]' : 'left-[2px]',
                                )}
                              />
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setProductEditor({ open: true, product: p })}
                                className="rounded-lg p-1.5 text-muted transition hover:bg-cream-200 hover:text-ink"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteProductTarget(p)}
                                className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-line/60 md:hidden">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProductEditor({ open: true, product: p })}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-100 text-base">
                      {p.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold">{p.name}</div>
                      <div className="text-[10.5px] text-muted">
                        {catName(p.categoryId)} · {p.trackStock ? `${p.stock} in stock` : 'untracked'}
                      </div>
                    </div>
                    <span className="text-[12.5px] font-bold tabular">{money(p.price)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {productEditor.open && (
        <ProductEditor
          key={productEditor.product?.id ?? 'new'}
          product={productEditor.product}
          categories={categories}
          onClose={() => setProductEditor({ open: false })}
          onSave={(data) => {
            if (productEditor.product) {
              updateProduct(productEditor.product.id, data)
              push('Product updated')
            } else {
              addProduct(store.id, data)
              push('Product added')
            }
            setProductEditor({ open: false })
          }}
        />
      )}

      {categoryEditor.open && (
        <CategoryEditor
          key={categoryEditor.category?.id ?? 'new'}
          category={categoryEditor.category}
          onClose={() => setCategoryEditor({ open: false })}
          onSave={(data) => {
            if (categoryEditor.category) {
              updateCategory(categoryEditor.category.id, data)
              push('Category updated')
            } else {
              addCategory(store.id, data)
              push('Category added')
            }
            setCategoryEditor({ open: false })
          }}
        />
      )}

      <Modal
        open={!!deleteProductTarget}
        onClose={() => setDeleteProductTarget(null)}
        title="Delete product?"
        subtitle={deleteProductTarget?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteProductTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteProductTarget) return
                deleteProduct(deleteProductTarget.id)
                push('Product deleted', 'info')
                setDeleteProductTarget(null)
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-muted">
          Past orders keep their copy of this item, so your reports stay accurate.
        </p>
      </Modal>

      <Modal
        open={!!deleteCategoryTarget}
        onClose={() => setDeleteCategoryTarget(null)}
        title="Delete category?"
        subtitle={deleteCategoryTarget?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteCategoryTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteCategoryTarget) return
                const res = deleteCategory(deleteCategoryTarget.id)
                if (!res.ok) {
                  push(res.error, 'error')
                  return
                }
                push('Category deleted', 'info')
                if (categoryFilter === deleteCategoryTarget.id) setCategoryFilter('all')
                setDeleteCategoryTarget(null)
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-muted">
          Categories can only be deleted once they are empty. Move its products elsewhere first.
        </p>
      </Modal>
    </div>
  )
}

function Tile({
  label,
  value,
  icon,
  warn,
}: {
  label: string
  value: string
  icon: React.ReactNode
  warn?: boolean
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl',
          warn ? 'bg-amber-50 text-amber-600' : 'bg-cream-100 text-muted',
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="text-[16px] font-extrabold tracking-tight tabular">{value}</div>
      </div>
    </Card>
  )
}

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="max-h-[120px] overflow-y-auto rounded-xl border border-line p-2 thin-scrollbar">
      <div className="grid grid-cols-9 gap-1 sm:grid-cols-12">
        {emojis.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChange(e)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-lg transition',
              value === e ? 'bg-accent-50 ring-1 ring-accent-500/40' : 'hover:bg-cream-100',
            )}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

function ProductEditor({
  product,
  categories,
  onClose,
  onSave,
}: {
  product?: Product
  categories: Category[]
  onClose: () => void
  onSave: (data: Omit<Product, 'id' | 'storeId'>) => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [emoji, setEmoji] = useState(product?.emoji ?? '☕')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? '')
  const [price, setPrice] = useState(String(product?.price ?? ''))
  const [cost, setCost] = useState(String(product?.cost ?? ''))
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? false)
  const [stock, setStock] = useState(String(product?.stock ?? '0'))
  const [active, setActive] = useState(product?.active ?? true)

  const priceNum = Number(price) || 0
  const costNum = Number(cost) || 0
  const margin = priceNum > 0 ? ((priceNum - costNum) / priceNum) * 100 : 0
  const valid = name.trim() && categoryId && priceNum > 0

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? 'Edit product' : 'New product'}
      subtitle={product ? product.name : 'Add something delicious to the menu.'}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11.5px] text-muted">
            {priceNum > 0 && (
              <>
                Margin <span className="font-semibold text-ink">{margin.toFixed(0)}%</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!valid}
              onClick={() =>
                onSave({
                  name: name.trim(),
                  emoji,
                  categoryId,
                  price: priceNum,
                  cost: costNum,
                  trackStock,
                  stock: trackStock ? Math.max(0, Number(stock) || 0) : 0,
                  active,
                })
              }
            >
              {product ? 'Save changes' : 'Add product'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-cream-50 p-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
            {emoji}
          </span>
          <div>
            <div className="text-[12.5px] font-semibold text-ink">Icon</div>
            <div className="text-[11px] text-muted">Pick an emoji that fits the item.</div>
          </div>
        </div>
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cappuccino" autoFocus />
          </Field>
          <Field label="Category" className="sm:col-span-2">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Selling price (DT)">
            <Input
              type="number"
              min={0}
              step={0.1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.000"
              className="tabular"
            />
          </Field>
          <Field label="Cost price (DT)" hint="For margin only">
            <Input
              type="number"
              min={0}
              step={0.1}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.000"
              className="tabular"
            />
          </Field>
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <Toggle
            checked={trackStock}
            onChange={setTrackStock}
            label="Track stock for this item"
            description="Decreases automatically with every sale and warns when low."
          />
          {trackStock && (
            <div className="mt-3 flex items-end gap-3">
              <Field label="Current stock" className="w-32">
                <Input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="tabular"
                />
              </Field>
              <p className="pb-2.5 text-[11px] text-muted">Units remaining</p>
            </div>
          )}
        </div>
        <Toggle
          checked={active}
          onChange={setActive}
          label="Visible on the register"
          description="Turn off to hide without deleting."
        />
      </div>
    </Modal>
  )
}

function CategoryEditor({
  category,
  onClose,
  onSave,
}: {
  category?: Category
  onClose: () => void
  onSave: (data: { name: string; emoji: string }) => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [emoji, setEmoji] = useState(category?.emoji ?? '🍽️')

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), emoji })}>
            {category ? 'Save' : 'Create category'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <Field label="Category name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cold Drinks" autoFocus />
        </Field>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold">Icon</span>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>
      </div>
    </Modal>
  )
}

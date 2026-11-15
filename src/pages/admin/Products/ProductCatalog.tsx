import { useState } from 'react'
import { Boxes, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { Category, Product } from '../../../types'
import { Badge, Button, Card, EmptyState, Input, Select } from '../../../components/ui'
import { cn, money } from '../../../lib/utils'
import { getProductImage } from '../../../lib/productDisplay'
import { AppIcon } from '../../../components/AppIcon'

export default function ProductCatalog({
  categories,
  products,
  filtered,
  lowStockThreshold,
  categoryFilter,
  onCategoryFilter,
  query,
  onQuery,
  categoryName,
  onEditCategory,
  onDeleteCategory,
  onEditProduct,
  onDeleteProduct,
  onToggleProduct,
  onNewProduct,
  stations,
  onBulkAssignProducts,
  onBulkAssignCategories,
}: {
  categories: Category[]
  products: Product[]
  filtered: Product[]
  lowStockThreshold: number
  categoryFilter: string
  onCategoryFilter: (id: string) => void
  query: string
  onQuery: (query: string) => void
  categoryName: (id: string) => string
  onEditCategory: (category: Category) => void
  onDeleteCategory: (category: Category) => void
  onEditProduct: (product: Product) => void
  onDeleteProduct: (product: Product) => void
  onToggleProduct: (product: Product) => void
  onNewProduct: () => void
  stations: Array<{ id: string; name: string }>
  onBulkAssignProducts: (ids: string[], stationId?: string) => boolean
  onBulkAssignCategories: (ids: string[], stationId?: string) => boolean
}) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [productStationId, setProductStationId] = useState('')
  const [categoryStationId, setCategoryStationId] = useState('')
  const toggle = (ids: string[], id: string, setIds: (ids: string[]) => void) =>
    setIds(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <Card className="h-fit p-2">
        <button
          onClick={() => onCategoryFilter('all')}
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
          {selectedCategories.length > 0 && (
            <div className="space-y-2 border-b border-line/60 p-2">
              <p className="text-[11px] font-semibold">{selectedCategories.length} categories selected</p>
              <Select value={categoryStationId} onChange={(event) => setCategoryStationId(event.target.value)}>
                <option value="">No station</option>
                {stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
              </Select>
              <Button size="sm" className="w-full" onClick={() => {
                if (onBulkAssignCategories(selectedCategories, categoryStationId || undefined)) setSelectedCategories([])
              }}>Assign station</Button>
            </div>
          )}
          {categories.map((category) => {
            const count = products.filter((p) => p.categoryId === category.id).length
            const active = categoryFilter === category.id
            return (
              <div
                key={category.id}
                className={cn(
                  'group flex items-center gap-1 rounded-xl px-1 transition',
                  active ? 'bg-cream-200' : 'hover:bg-cream-100',
                )}
              >
                <input
                  type="checkbox"
                  aria-label={`Select category ${category.name}`}
                  checked={selectedCategories.includes(category.id)}
                  onChange={() => toggle(selectedCategories, category.id, setSelectedCategories)}
                  className="ml-1 accent-brand-amber"
                />
                <button
                  onClick={() => onCategoryFilter(category.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-[12.5px] font-medium"
                >
                  <AppIcon name={category.icon} color={category.iconColor} size={14} className="h-6 w-6 rounded-lg" />
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  <span className="text-[10.5px] font-semibold text-muted/60">{count}</span>
                </button>
                <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => onEditCategory(category)}
                    className="rounded-md p-1 text-muted hover:bg-white hover:text-ink"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onDeleteCategory(category)}
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
          {selectedProducts.length > 0 && (
            <div className="mb-3 grid gap-2 rounded-xl bg-cream-100 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="mb-1.5 text-xs font-semibold">{selectedProducts.length} products selected</p>
                <Select value={productStationId} onChange={(event) => setProductStationId(event.target.value)}>
                  <option value="">No station</option>
                  {stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
                </Select>
              </div>
              <Button size="sm" onClick={() => {
                if (onBulkAssignProducts(selectedProducts, productStationId || undefined)) setSelectedProducts([])
              }}>Assign station</Button>
            </div>
          )}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
            <Input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
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
                <Button size="sm" onClick={onNewProduct}>
                  <Plus className="h-4 w-4" /> New product
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <thead className="glass-subtle sticky top-0 z-10">
                  <tr className="border-b border-line/70 text-[10.5px] uppercase tracking-wider text-muted">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select all visible products"
                        checked={filtered.length > 0 && filtered.every((product) => selectedProducts.includes(product.id))}
                        onChange={(event) => setSelectedProducts(event.target.checked
                          ? [...new Set([...selectedProducts, ...filtered.map((product) => product.id)])]
                          : selectedProducts.filter((id) => !filtered.some((product) => product.id === id)))}
                        className="accent-brand-amber"
                      />
                    </th>
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
                  {filtered.map((product) => {
                    const margin = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0
                    const low = product.trackStock && product.stock <= lowStockThreshold
                    const image = getProductImage(product)
                    return (
                      <tr key={product.id} className="border-b border-line/50 text-[12.5px]">
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            aria-label={`Select product ${product.name}`}
                            checked={selectedProducts.includes(product.id)}
                            onChange={() => toggle(selectedProducts, product.id, setSelectedProducts)}
                            className="accent-brand-amber"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {image
                              ? <img src={image} alt="" className="h-8 w-8 rounded-lg object-cover" />
                              : <AppIcon name={product.icon} color={product.iconColor} size={15} className="h-8 w-8 rounded-lg" />}
                            <span className="font-semibold text-ink">{product.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted">{categoryName(product.categoryId)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular">{money(product.price)}</td>
                        <td className="px-4 py-2.5 text-right text-muted tabular">{money(product.cost)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={cn('font-semibold tabular', margin >= 50 ? 'text-emerald-600' : 'text-ink')}>
                            {margin.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {product.trackStock ? (
                            <Badge tone={product.stock === 0 ? 'danger' : low ? 'warning' : 'neutral'}>
                              {product.stock}
                            </Badge>
                          ) : (
                            <span className="text-[10.5px] text-muted/60">untracked</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => onToggleProduct(product)}
                            className={cn(
                              'relative inline-flex h-[20px] w-[34px] rounded-full transition-colors',
                              product.active ? 'bg-accent-600' : 'bg-espresso-900/15',
                            )}
                            aria-label="Toggle active"
                          >
                            <span
                              className={cn(
                                'absolute top-[2px] h-4 w-4 rounded-full bg-white shadow transition-all',
                                product.active ? 'left-[16px]' : 'left-[2px]',
                              )}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onEditProduct(product)}
                              className="rounded-lg p-1.5 text-muted transition hover:bg-cream-200 hover:text-ink"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteProduct(product)}
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
              {filtered.map((product) => {
                const image = getProductImage(product)
                return (
                <div
                  key={product.id}
                  className="flex w-full items-center gap-3 px-4 py-3"
                >
                  <input
                    type="checkbox"
                    aria-label={`Select product ${product.name}`}
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => toggle(selectedProducts, product.id, setSelectedProducts)}
                    className="accent-brand-amber"
                  />
                  <button
                    type="button"
                    onClick={() => onEditProduct(product)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {image
                      ? <img src={image} alt="" className="h-9 w-9 rounded-xl object-cover" />
                      : <AppIcon name={product.icon} color={product.iconColor} size={17} className="h-9 w-9 rounded-xl" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold">{product.name}</div>
                      <div className="text-[10.5px] text-muted">
                        {categoryName(product.categoryId)} · {product.trackStock ? `${product.stock} in stock` : 'untracked'}
                      </div>
                    </div>
                    <span className="text-[12.5px] font-bold tabular">{money(product.price)}</span>
                  </button>
                </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

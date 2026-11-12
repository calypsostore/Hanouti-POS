import { Boxes, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { Category, Product } from '../../../types'
import { Badge, Button, Card, EmptyState, Input } from '../../../components/ui'
import { cn, money } from '../../../lib/utils'
import { getProductImage } from '../../../lib/productDisplay'

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
}) {
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
                <button
                  onClick={() => onCategoryFilter(category.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-[12.5px] font-medium"
                >
                  <span>{category.emoji}</span>
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
                  {filtered.map((product) => {
                    const margin = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0
                    const low = product.trackStock && product.stock <= lowStockThreshold
                    const image = getProductImage(product)
                    return (
                      <tr key={product.id} className="border-b border-line/50 text-[12.5px]">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-brand-tint text-sm font-bold text-brand-navy">
                              {image ? <img src={image} alt={product.name} className="h-full w-full object-cover" /> : product.emoji || product.name.slice(0, 1).toUpperCase()}
                            </span>
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
                <button
                  key={product.id}
                  onClick={() => onEditProduct(product)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-brand-tint text-sm font-bold text-brand-navy">
                    {image ? <img src={image} alt={product.name} className="h-full w-full object-cover" /> : product.emoji || product.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold">{product.name}</div>
                    <div className="text-[10.5px] text-muted">
                      {categoryName(product.categoryId)} · {product.trackStock ? `${product.stock} in stock` : 'untracked'}
                    </div>
                  </div>
                  <span className="text-[12.5px] font-bold tabular">{money(product.price)}</span>
                </button>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

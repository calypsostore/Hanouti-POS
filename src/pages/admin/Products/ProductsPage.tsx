import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../../../store/AppStore'
import type { Category, Product } from '../../../types'
import { Button, Input, Modal } from '../../../components/ui'
import ConfirmDeleteModal from '../../../components/data/ConfirmDeleteModal'
import { useToast } from '../../../components/toast'
import ProductCatalog from './ProductCatalog'
import { CategoryEditor, ProductEditor } from './ProductEditors'
import ProductsSummary from './ProductsSummary'
import { isUnavailable } from '../../../lib/availability'

export default function ProductsPage() {
  const {
    db, store, user, addCategory, updateCategory, deleteCategory, addProduct, updateProduct, deleteProduct,
    bulkAssignProductStation, bulkAssignCategoryStation,
  } =
    useApp()
  const { push } = useToast()
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | '86'>('all')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyItem, setHistoryItem] = useState('')
  const [historyUser, setHistoryUser] = useState('')
  const [historyDate, setHistoryDate] = useState('')
  const [productEditor, setProductEditor] = useState<{ open: boolean; product?: Product }>({ open: false })
  const [categoryEditor, setCategoryEditor] = useState<{ open: boolean; category?: Category }>({
    open: false,
  })
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null)

  if (!store) return null

  const categories = db.categories.filter((c) => c.storeId === store.id).sort((a, b) => a.sort - b.sort)
  const stations = db.stations.filter((station) => station.storeId === store.id).sort((a, b) => a.sort - b.sort)
  const products = db.products.filter((p) => p.storeId === store.id)
  const filtered = products
    .filter((p) => categoryFilter === 'all' || p.categoryId === categoryFilter)
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((p) => {
      if (availabilityFilter === 'all') return true
      const inventoryItem = db.inventoryItems.find((item) => item.id === p.inventoryItemId)
      return isUnavailable(p, undefined, store.settings.availability, inventoryItem).unavailable ||
        (p.variants ?? []).some((variant) => isUnavailable(p, variant, store.settings.availability, inventoryItem).unavailable)
    })
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

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—'

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
          <Button variant="secondary" onClick={() => setHistoryOpen((open) => !open)}>
            {historyOpen ? 'Products' : '86 history'}
          </Button>
          <Button variant="secondary" onClick={() => setCategoryEditor({ open: true })}>
            <Plus className="h-4 w-4" /> Category
          </Button>
          <Button onClick={() => setProductEditor({ open: true })} disabled={!categories.length}>
            <Plus className="h-4 w-4" /> New product
          </Button>
        </div>
      </div>

      <ProductsSummary
        productCount={products.length}
        categoryCount={categories.length}
        avgMargin={avgMargin}
        lowStock={lowStock}
      />

      {historyOpen ? (
        <section className="glass rounded-3xl p-4">
          <h3 className="mb-3 text-sm font-bold">86 history</h3>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <Input value={historyItem} onChange={(event) => setHistoryItem(event.target.value)} placeholder="Filter item" />
            <Input value={historyUser} onChange={(event) => setHistoryUser(event.target.value)} placeholder="Filter user" />
            <Input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} />
          </div>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {db.auditLogs.filter((log) =>
              log.storeId === store.id && log.entity === 'product' &&
              (log.summary.startsWith('86d ') || log.summary.startsWith('Returned ')) &&
              log.summary.toLowerCase().includes(historyItem.trim().toLowerCase()) &&
              log.userName.toLowerCase().includes(historyUser.trim().toLowerCase()) &&
              (!historyDate || log.createdAt.slice(0, 10) === historyDate),
            ).slice().reverse().map((log) => (
              <div key={log.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-line p-3 text-xs">
                <span className="font-semibold">{log.summary}</span>
                <span className="text-muted">{log.userName} · {new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      ) : <ProductCatalog
        categories={categories}
        products={products}
        filtered={filtered}
        lowStockThreshold={store.settings.lowStockThreshold}
        categoryFilter={categoryFilter}
        onCategoryFilter={setCategoryFilter}
        query={query}
        onQuery={setQuery}
        categoryName={categoryName}
        onEditCategory={(category) => setCategoryEditor({ open: true, category })}
        onDeleteCategory={setDeleteCategoryTarget}
        onEditProduct={(product) => setProductEditor({ open: true, product })}
        onDeleteProduct={setDeleteProductTarget}
        onToggleProduct={(product) => {
          const result = updateProduct(product.id, { active: !product.active })
          if (!result.ok) push(result.error, 'error')
        }}
        availabilityFilter={availabilityFilter}
        onAvailabilityFilterChange={setAvailabilityFilter}
        onToggle86={(product) => {
          const current = product.eightySix?.active || product.variants?.some((variant) => variant.eightySix?.active)
          const result = updateProduct(product.id, current
            ? {
                eightySix: undefined,
                variants: product.variants?.map((variant) =>
                  variant.eightySix?.active ? { ...variant, eightySix: undefined } : variant,
                ),
              }
            : {
                eightySix: {
                  active: true,
                  at: new Date().toISOString(),
                  byId: user?.id ?? '',
                  reason: store.settings.availability.reasons[0] ?? '',
                  returnMode: store.settings.availability.defaultReturnMode,
                  backAt: undefined,
                },
              })
          if (!result.ok) push(result.error, 'error')
          else push(current ? `${product.name} returned` : `${product.name} 86'd`)
        }}
        onNewProduct={() => setProductEditor({ open: true })}
        stations={stations}
        onBulkAssignProducts={(ids, stationId) => {
          const result = bulkAssignProductStation(store.id, ids, stationId)
          if (!result.ok) {
            push(result.error, 'error')
            return false
          }
          push(`Assigned ${ids.length} product${ids.length === 1 ? '' : 's'}`)
          return true
        }}
        onBulkAssignCategories={(ids, stationId) => {
          const result = bulkAssignCategoryStation(store.id, ids, stationId)
          if (!result.ok) {
            push(result.error, 'error')
            return false
          }
          push(`Assigned ${ids.length} categor${ids.length === 1 ? 'y' : 'ies'}`)
          return true
        }}
      />}

      {productEditor.open && (
        <ProductEditor
          key={productEditor.product?.id ?? 'new'}
          product={productEditor.product}
          categories={categories}
          stations={stations}
          inventoryItems={db.inventoryItems.filter((item) => item.storeId === store.id && item.active)}
          onClose={() => setProductEditor({ open: false })}
          onSave={(data) => {
            if (productEditor.product) {
              const result = updateProduct(productEditor.product.id, data)
              if (!result.ok) {
                push(result.error, 'error')
                return
              }
              push('Product updated')
            } else {
              const result = addProduct(store.id, data)
              if (!result.ok) {
                push(result.error, 'error')
                return
              }
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
          stations={stations}
          onClose={() => setCategoryEditor({ open: false })}
          onSave={(data) => {
            if (categoryEditor.category) {
              const result = updateCategory(categoryEditor.category.id, data)
              if (!result.ok) {
                push(result.error, 'error')
                return
              }
              push('Category updated')
            } else {
              const result = addCategory(store.id, data)
              if (!result.ok) {
                push(result.error, 'error')
                return
              }
              push('Category added')
            }
            setCategoryEditor({ open: false })
          }}
        />
      )}

      <ConfirmDeleteModal
        open={!!deleteProductTarget}
        onClose={() => setDeleteProductTarget(null)}
        title="Delete product?"
        subject={deleteProductTarget?.name}
        description="Past orders keep their copy of this item, so your reports stay accurate."
        onConfirm={() => {
          if (!deleteProductTarget) return
          const result = deleteProduct(deleteProductTarget.id)
          if (!result.ok) {
            push(result.error, 'error')
            return
          }
          push('Product deleted', 'info')
          setDeleteProductTarget(null)
        }}
      />

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
                const result = deleteCategory(deleteCategoryTarget.id)
                if (!result.ok) {
                  push(result.error, 'error')
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

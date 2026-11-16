import { useState } from 'react'
import { Button, Field, Input, Toggle } from '../../../components/ui'
import { formatInventoryQuantity } from '../../../lib/inventory'
import type { Category, InventoryItem, InventoryYieldTracker, InventoryYieldTrackingSettings, Product } from '../../../types'

const itemUnitAmount = (item: InventoryItem) => item.baseUnit === 'piece' ? 1 : 1000
const formatUnit = (item: InventoryItem) => item.baseUnit === 'g' ? 'kg' : item.baseUnit === 'ml' ? 'L' : 'piece'

function TrackerEditor({
  tracker,
  item,
  products,
  categories,
  onChange,
  onRemove,
}: {
  tracker: InventoryYieldTracker
  item: InventoryItem
  products: Product[]
  categories: Category[]
  onChange: (value: InventoryYieldTracker) => void
  onRemove: () => void
}) {
  const [productQuery, setProductQuery] = useState('')
  const [categoryQuery, setCategoryQuery] = useState('')
  const update = (patch: Partial<InventoryYieldTracker>) => onChange({ ...tracker, ...patch })
  const selectedProducts = tracker.productIds.flatMap((id) => {
    const product = products.find((candidate) => candidate.id === id)
    return [{ id, label: product?.name ?? 'Unavailable product' }]
  })
  const selectedCategories = tracker.categoryIds.flatMap((id) => {
    const category = categories.find((candidate) => candidate.id === id)
    return [{ id, label: category?.name ?? 'Unavailable category' }]
  })
  const productMatches = productQuery.trim()
    ? products.filter((product) => product.name.toLowerCase().includes(productQuery.trim().toLowerCase())).slice(0, 30)
    : []
  const categoryMatches = categoryQuery.trim()
    ? categories.filter((category) => category.name.toLowerCase().includes(categoryQuery.trim().toLowerCase())).slice(0, 30)
    : []

  return (
    <section className="space-y-4 rounded-2xl border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-ink">{item.name}</h4>
          <p className="text-xs text-muted">Inventory on hand: {formatInventoryQuantity(item.onHand, item.baseUnit)}</p>
        </div>
        <Button type="button" size="sm" variant="danger" onClick={onRemove}>Remove tracker</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={`Reference stock (${formatUnit(item)})`}>
          <Input type="number" min={0.001} step={0.001} value={tracker.referenceQuantity / itemUnitAmount(item)}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isFinite(value) && value > 0) update({ referenceQuantity: value * itemUnitAmount(item) })
            }} />
        </Field>
        <Field label="Minimum servings from this amount">
          <Input type="number" min={1} max={100000} step={1} value={tracker.servingsMin}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isSafeInteger(value) && value >= 1 && value <= tracker.servingsMax) {
                update({ servingsMin: value })
              }
            }} />
        </Field>
        <Field label="Maximum servings from this amount">
          <Input type="number" min={tracker.servingsMin} max={100000} step={1} value={tracker.servingsMax}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isSafeInteger(value) && value >= tracker.servingsMin && value <= 100000) {
                update({ servingsMax: value })
              }
            }} />
        </Field>
      </div>
      <p className="text-[11px] text-muted">
        Amounts are saved in inventory base units: 1 kg = 1000 g and 1 L = 1000 ml.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Field label="Products that consume this inventory">
            <Input value={productQuery} onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Search products to add" />
          </Field>
          {selectedProducts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedProducts.map((selected) => (
                <button key={selected.id} type="button"
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-ink hover:border-brand-amber/60"
                  onClick={() => update({ productIds: tracker.productIds.filter((id) => id !== selected.id) })}
                  aria-label={`Remove ${selected.label}`}>
                  {selected.label} ×
                </button>
              ))}
            </div>
          )}
          {productQuery.trim() && (
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {productMatches.map((product) => {
                const checked = tracker.productIds.includes(product.id)
                return (
                  <label key={product.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/40">
                    <input type="checkbox" checked={checked} onChange={(event) => update({
                      productIds: event.target.checked
                        ? [...tracker.productIds, product.id]
                        : tracker.productIds.filter((id) => id !== product.id),
                    })} />
                    <span className="truncate">{product.name}</span>
                  </label>
                )
              })}
              {productMatches.length === 0 && <p className="px-2 py-1.5 text-xs text-muted">No matching products.</p>}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Field label="Categories that consume this inventory">
            <Input value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)}
              placeholder="Search categories to add" />
          </Field>
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map((selected) => (
                <button key={selected.id} type="button"
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-ink hover:border-brand-amber/60"
                  onClick={() => update({ categoryIds: tracker.categoryIds.filter((id) => id !== selected.id) })}
                  aria-label={`Remove ${selected.label}`}>
                  {selected.label} ×
                </button>
              ))}
            </div>
          )}
          {categoryQuery.trim() && (
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {categoryMatches.map((category) => {
                const checked = tracker.categoryIds.includes(category.id)
                return (
                  <label key={category.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/40">
                    <input type="checkbox" checked={checked} onChange={(event) => update({
                      categoryIds: event.target.checked
                        ? [...tracker.categoryIds, category.id]
                        : tracker.categoryIds.filter((id) => id !== category.id),
                    })} />
                    <span className="truncate">{category.name}</span>
                  </label>
                )
              })}
              {categoryMatches.length === 0 && <p className="px-2 py-1.5 text-xs text-muted">No matching categories.</p>}
            </div>
          )}
        </div>
      </div>
      {!tracker.productIds.length && !tracker.categoryIds.length && (
        <p className="text-xs text-brand-rose">Choose at least one product or category to include in this estimate.</p>
      )}
    </section>
  )
}

export default function InventoryYieldTracking({
  settings,
  items,
  products,
  categories,
  onChange,
}: {
  settings: InventoryYieldTrackingSettings
  items: InventoryItem[]
  products: Product[]
  categories: Category[]
  onChange: (value: InventoryYieldTrackingSettings) => void
}) {
  const [inventoryQuery, setInventoryQuery] = useState('')
  const trackers = settings.trackers
  const inventoryMatches = inventoryQuery.trim()
    ? items.filter((item) =>
        !trackers.some((tracker) => tracker.inventoryItemId === item.id) &&
        item.name.toLowerCase().includes(inventoryQuery.trim().toLowerCase()),
      ).slice(0, 20)
    : []

  const addItem = (item: InventoryItem) => {
    const tracker: InventoryYieldTracker = {
      inventoryItemId: item.id,
      referenceQuantity: itemUnitAmount(item),
      servingsMin: 1,
      servingsMax: 1,
      productIds: [],
      categoryIds: [],
    }
    onChange({ ...settings, trackers: [...trackers, tracker] })
    setInventoryQuery('')
  }

  return (
    <section className="glass space-y-4 rounded-3xl p-5">
      <div>
        <h3 className="text-sm font-bold text-ink">Inventory yield tracking</h3>
        <p className="mt-1 text-xs text-muted">
          Estimate how much of any inventory item sales consume, then compare the estimate with recipe use and the stock ledger.
        </p>
      </div>
      <Toggle checked={settings.enabled}
        onChange={(enabled) => onChange({ ...settings, enabled })}
        label="Enable inventory yield tracking"
        description="Use this for beans, juice, milk, or any g, ml, or piece inventory item." />
      {settings.enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Field label="Add inventory item to track">
              <Input value={inventoryQuery} onChange={(event) => setInventoryQuery(event.target.value)}
                placeholder="Search inventory items" />
            </Field>
            {inventoryQuery.trim() && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                {inventoryMatches.map((item) => (
                  <button key={item.id} type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-white/40"
                    onClick={() => addItem(item)}>
                    <span className="truncate font-medium text-ink">{item.name}</span>
                    <span className="shrink-0 text-muted">{formatInventoryQuantity(item.onHand, item.baseUnit)}</span>
                  </button>
                ))}
                {inventoryMatches.length === 0 && <p className="px-3 py-2 text-xs text-muted">No matching inventory items.</p>}
              </div>
            )}
          </div>

          {trackers.map((tracker) => {
            const item = items.find((candidate) => candidate.id === tracker.inventoryItemId)
            if (!item) return (
              <section key={tracker.inventoryItemId} className="flex items-center justify-between gap-3 rounded-xl border border-brand-rose/30 p-3">
                <span className="text-xs text-muted">Inventory item unavailable</span>
                <Button type="button" size="sm" variant="danger" onClick={() => onChange({
                  ...settings,
                  trackers: trackers.filter((entry) => entry.inventoryItemId !== tracker.inventoryItemId),
                })}>Remove</Button>
              </section>
            )
            return (
              <TrackerEditor key={tracker.inventoryItemId} tracker={tracker} item={item}
                products={products} categories={categories}
                onChange={(value) => onChange({
                  ...settings,
                  trackers: trackers.map((entry) => entry.inventoryItemId === value.inventoryItemId ? value : entry),
                })}
                onRemove={() => onChange({
                  ...settings,
                  trackers: trackers.filter((entry) => entry.inventoryItemId !== tracker.inventoryItemId),
                })} />
            )
          })}
          {trackers.length === 0 && (
            <p className="rounded-xl border border-dashed border-line p-4 text-xs text-muted">
              Search for an inventory item above to start tracking it.
            </p>
          )}
          <p className="text-[11px] text-muted">
            Set starting stock or correct a manual count in Admin → Inventory. Record new deliveries in Admin → Purchases; both update the tracked remainder.
          </p>
        </div>
      )}
    </section>
  )
}

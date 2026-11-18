import { useState } from 'react'
import { Button, Field, Input, Select, Toggle } from '../../../components/ui'
import type { Product, StoreSettings } from '../../../types'

export default function StaffItemsSettingsSection({
  settings,
  products,
  onChange,
}: {
  settings: StoreSettings['staffConsumption']
  products: Product[]
  onChange: (value: StoreSettings['staffConsumption']) => void
}) {
  const [productQuery, setProductQuery] = useState('')
  const update = (patch: Partial<StoreSettings['staffConsumption']>) =>
    onChange({ ...settings, ...patch })
  const matchingProducts = productQuery.trim()
    ? products.filter((product) =>
        !settings.allowances.some((allowance) => allowance.productId === product.id) &&
        product.name.toLowerCase().includes(productQuery.trim().toLowerCase()),
      ).slice(0, 30)
    : []

  return (
    <section className="glass max-w-3xl rounded-3xl p-5">
      <h3 className="text-sm font-bold text-ink">Staff items</h3>
      <p className="mt-1 text-xs text-muted">
        Allow staff to record their own items during an open shift; stock and Z reports include them.
      </p>
      <div className="mt-4 space-y-3">
        <Toggle
          checked={settings.enabled}
          onChange={(value) => update({ enabled: value })}
          label="Enable staff items"
          description="Only listed items and shift quantities are allowed."
        />
        {settings.enabled && (
          <>
            <Field label="Staff item pricing" hint="This separate staff-item checkout accepts cash or card; free items are recorded as zero-value cash transactions.">
              <Select value={settings.pricing} onChange={(event) => update({
                pricing: event.target.value as StoreSettings['staffConsumption']['pricing'],
              })}>
                <option value="full_price">Full price</option>
                <option value="discount">Staff discount</option>
                <option value="free">Free</option>
              </Select>
            </Field>
            {settings.pricing === 'discount' && (
              <Field label="Staff discount (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.discountPercent}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (Number.isFinite(value) && value >= 0 && value <= 100) {
                      update({ discountPercent: value })
                    }
                  }}
                />
              </Field>
            )}
            <div className="space-y-2">
              <Field label="Search products to allow">
                <Input
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Type a product name"
                />
              </Field>
              <div className="text-xs font-semibold text-ink">Allowed items and per-shift limits</div>
              {settings.allowances.map((allowance) => {
                const product = products.find((candidate) => candidate.id === allowance.productId)
                return (
                  <div key={allowance.productId} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {product?.name ?? 'Unavailable product'}
                      {product && !product.active && <span className="ml-1 text-muted">(inactive)</span>}
                    </span>
                    <Field label="Max per shift" className="w-28">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        value={allowance.maxPerShift}
                        onChange={(event) => {
                          const value = Number(event.target.value)
                          if (Number.isSafeInteger(value) && value >= 1 && value <= 100) {
                            update({
                              allowances: settings.allowances.map((entry) => entry.productId === allowance.productId
                                ? { ...entry, maxPerShift: value }
                                : entry),
                            })
                          }
                        }}
                      />
                    </Field>
                    <Button type="button" size="sm" variant="danger" onClick={() => update({
                      allowances: settings.allowances.filter((entry) => entry.productId !== allowance.productId),
                    })}>Remove</Button>
                  </div>
                )
              })}
              {matchingProducts.map((product) => (
                <label key={product.id} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                  <input
                    type="checkbox"
                    disabled={!product.active}
                    aria-label={`Allow staff to take ${product.name}`}
                    onChange={(event) => {
                      if (event.target.checked) {
                        update({ allowances: [...settings.allowances, { productId: product.id, maxPerShift: 1 }] })
                      }
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{product.name}</span>
                </label>
              ))}
              {productQuery.trim() && matchingProducts.length === 0 && (
                <p className="text-xs text-muted">No matching products.</p>
              )}
              {!settings.allowances.length && (
                <p className="text-xs text-muted">Search for a product to allow staff items.</p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

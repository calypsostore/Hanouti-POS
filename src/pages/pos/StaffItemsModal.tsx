import { useState } from 'react'
import type { Order, OrderItem, Product, StaffConsumptionSettings, StoreSettings } from '../../types'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { computeTotals } from '../../lib/pricing'
import { staffConsumptionDiscount } from '../../lib/staffConsumption'
import { money } from '../../lib/utils'

export function StaffItemsModal({
  open,
  onClose,
  products,
  orders,
  shiftId,
  canAutoOpenShift,
  staffId,
  settings,
  policy,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  products: Product[]
  orders: Order[]
  shiftId?: string
  canAutoOpenShift: boolean
  staffId: string
  settings: StoreSettings
  policy: StaffConsumptionSettings
  onSubmit: (items: OrderItem[], method: 'cash' | 'card') => boolean
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [variants, setVariants] = useState<Record<string, string>>({})
  const [method, setMethod] = useState<'cash' | 'card'>('cash')
  const [received, setReceived] = useState('')
  const [cardConfirmed, setCardConfirmed] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const reset = () => {
    setQuantities({})
    setVariants({})
    setReceived('')
    setMethod('cash')
    setCardConfirmed(false)
    setProductQuery('')
  }
  const close = () => {
    reset()
    onClose()
  }
  const submit = () => {
    if (onSubmit(items, method)) reset()
  }
  const items = products.flatMap((product) => {
    const qty = quantities[product.id] ?? 0
    if (qty <= 0) return []
    const variant = product.variants?.find((entry) =>
      entry.id === (variants[product.id] ?? product.variants?.[0]?.id),
    )
    return [{
      productId: product.id,
      name: product.name,
      price: variant?.price ?? product.price,
      qty,
      variantId: variant?.id,
      variantName: variant?.name,
    }]
  })
  const base = computeTotals(items, settings)
  const total = computeTotals(items, settings, staffConsumptionDiscount(items, settings, policy)).total
  const cashReady = total === 0 || Number(received) >= total
  const matchingProducts = productQuery.trim()
    ? products.filter((product) => product.name.toLowerCase().includes(productQuery.trim().toLowerCase())).slice(0, 50)
    : []

  return (
    <Modal
      open={open}
      onClose={close}
      title="Staff items"
      subtitle="Choose your own items. The administrator's per-shift limits and pricing apply."
      footer={(
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Payment method">
              <Select value={method} onChange={(event) => {
                setMethod(event.target.value === 'card' ? 'card' : 'cash')
                setCardConfirmed(false)
              }}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </Select>
            </Field>
            {method === 'cash' ? (
              <Field label="Cash received">
                <Input type="number" min={total} step="0.001" value={received} onChange={(event) => setReceived(event.target.value)}
                  placeholder={total.toFixed(3)} />
              </Field>
            ) : (
              <label className="flex items-center gap-2 self-end pb-2 text-xs text-ink">
                <input type="checkbox" checked={cardConfirmed} onChange={(event) => setCardConfirmed(event.target.checked)} />
                Card payment received
              </label>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted">
              {policy.pricing === 'free' ? 'Free' : policy.pricing === 'discount'
                ? `${policy.discountPercent}% staff discount`
                : 'Full price'} · {money(total)}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button disabled={!items.length || (!shiftId && !canAutoOpenShift) || (method === 'cash' && !cashReady) ||
                (method === 'card' && !cardConfirmed)} onClick={submit}>
                Record items
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      {!shiftId && !canAutoOpenShift ? (
        <p className="rounded-xl bg-brand-amber-soft p-3 text-sm text-brand-navy">Open your shift before recording staff items.</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted">The administrator has not allowed any staff items for this shift.</p>
      ) : (
        <div className="space-y-2">
          <Field label="Search allowed items">
            <Input value={productQuery} onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Type an item name" />
          </Field>
          {items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <button key={item.productId} type="button"
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-ink hover:border-brand-amber/60"
                  onClick={() => setQuantities((current) => ({ ...current, [item.productId]: 0 }))}>
                  {item.qty} × {item.name} · Remove
                </button>
              ))}
            </div>
          )}
          <div className="max-h-[48vh] space-y-2 overflow-y-auto">
          {matchingProducts.map((product) => {
            const allowance = policy.allowances.find((entry) => entry.productId === product.id)
            const used = orders
              .filter((order) => order.staffConsumption && order.status === 'completed' &&
                order.shiftId === shiftId && order.staffId === staffId)
              .flatMap((order) => order.items)
              .filter((item) => item.productId === product.id)
              .reduce((sum, item) => sum + item.qty, 0)
            const remaining = Math.max(0, (allowance?.maxPerShift ?? 0) - used)
            return (
              <div key={product.id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[minmax(0,1fr)_8rem_6rem] sm:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{product.name}</div>
                  <div className="text-xs text-muted">{remaining} left this shift · {money(product.price)}</div>
                  {(product.variants?.length ?? 0) > 0 && (
                    <Field label="Size" className="mt-2">
                      <Select value={variants[product.id] ?? product.variants?.[0]?.id ?? ''}
                        onChange={(event) => setVariants((current) => ({ ...current, [product.id]: event.target.value }))}>
                        {product.variants?.map((variant) => (
                          <option key={variant.id} value={variant.id}>{variant.name} · {money(variant.price)}</option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </div>
                <Field label="Quantity">
                  <Input
                    type="number"
                    min={0}
                    max={remaining}
                    step={1}
                    value={quantities[product.id] ?? 0}
                    disabled={remaining === 0}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (Number.isSafeInteger(value) && value >= 0 && value <= remaining) {
                        setQuantities((current) => ({ ...current, [product.id]: value }))
                      }
                    }}
                  />
                </Field>
              </div>
            )
          })}
          {!productQuery.trim() && (
            <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">
              Search for an allowed item to add it.
            </p>
          )}
          {productQuery.trim() && matchingProducts.length === 0 && (
            <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">
              No allowed items match that search.
            </p>
          )}
          </div>
        </div>
      )}
      {items.length > 0 && (
        <p className="mt-3 text-right text-xs text-muted">
          Before staff pricing: {money(base.total)}
        </p>
      )}
    </Modal>
  )
}

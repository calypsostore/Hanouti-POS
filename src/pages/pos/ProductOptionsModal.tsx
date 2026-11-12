import { useState } from 'react'
import { Button, Field, Input, Modal, Textarea } from '../../components/ui'
import { money } from '../../lib/utils'
import { round } from '../../lib/pricing-utils'
import type { OrderModifier, Product, ProductVariant } from '../../types'

export interface ProductSelection {
  variantId?: string
  modifiers: OrderModifier[]
  note: string
  qty: number
}

export function ProductOptionsModal({
  product,
  initialVariantId,
  onClose,
  onAdd,
}: {
  product: Product | null
  initialVariantId?: string
  onClose: () => void
  onAdd: (selection: ProductSelection) => void
}) {
  const [variantId, setVariantId] = useState(initialVariantId ?? '')
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [qty, setQty] = useState('1.000')
  const [note, setNote] = useState('')
  if (!product) return null

  const variants = product.variants ?? []
  const variant = variants.find((item) => item.id === variantId)
  const basePrice = variant?.price ?? product.price
  const selectedModifiers = (product.modifiers ?? []).flatMap((group) =>
    (selected[group.id] ?? []).flatMap((optionId) => {
      const option = group.options.find((item) => item.id === optionId)
      return option ? [{
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDelta: option.priceDelta,
      }] : []
    }),
  )
  const unitPrice = round(basePrice + selectedModifiers.reduce((total, item) => total + item.priceDelta, 0))
  const quantity = Number(qty)
  const valid = (!variants.length || !!variant) &&
    (product.modifiers ?? []).every((group) => !group.required || (selected[group.id]?.length ?? 0) > 0) &&
    Number.isFinite(quantity) && quantity > 0 &&
    (product.soldByWeight ? round(quantity) === quantity : Number.isSafeInteger(quantity)) &&
    (!variant?.trackStock || variant.stock > 0)

  const toggleOption = (groupId: string, optionId: string, selection: 'single' | 'multiple') => {
    setSelected((current) => {
      const currentOptions = current[groupId] ?? []
      const next = selection === 'single'
        ? currentOptions.includes(optionId) ? [] : [optionId]
        : currentOptions.includes(optionId)
          ? currentOptions.filter((id) => id !== optionId)
          : [...currentOptions, optionId]
      return { ...current, [groupId]: next }
    })
  }

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={product.name}
      subtitle="Choose the options for this item."
      size="sm"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold tabular">{money(round(unitPrice * (product.soldByWeight ? quantity || 0 : 1)))}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!valid}
              onClick={() => onAdd({
                variantId: variant?.id,
                modifiers: selectedModifiers,
                note: note.trim(),
                qty: product.soldByWeight ? Math.round(quantity * 1000) / 1000 : 1,
              })}
            >
              Add to order
            </Button>
          </div>
        </div>
      }
    >
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        {variants.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-ink">Variant</legend>
            <div className="space-y-2">
              {variants.map((item: ProductVariant) => (
                <label key={item.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-line p-3 text-xs">
                  <span className="flex items-center gap-2">
                    <input type="radio" name={`variant-${product.id}`} checked={variantId === item.id} disabled={item.trackStock && item.stock <= 0} onChange={() => setVariantId(item.id)} />
                    {item.name}
                    {item.trackStock && <span className="text-muted">({item.stock} left)</span>}
                  </span>
                  <span className="font-semibold tabular">{money(item.price)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {(product.modifiers ?? []).map((group) => (
          <fieldset key={group.id}>
            <legend className="mb-2 text-xs font-semibold text-ink">
              {group.name}{group.required ? ' · required' : ''}
            </legend>
            <div className="space-y-2">
              {group.options.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-line p-3 text-xs">
                  <span className="flex items-center gap-2">
                    <input
                      type={group.selection === 'single' ? 'radio' : 'checkbox'}
                      name={`modifier-${product.id}-${group.id}`}
                      checked={(selected[group.id] ?? []).includes(option.id)}
                      onChange={() => toggleOption(group.id, option.id, group.selection)}
                    />
                    {option.name}
                  </span>
                  <span className="font-semibold tabular">{option.priceDelta > 0 ? `+${money(option.priceDelta)}` : money(option.priceDelta)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {product.soldByWeight && (
          <Field label={`Quantity (${product.saleUnit ?? 'piece'})`} hint="Use up to three decimal places.">
            <Input type="number" min={0.001} step="0.001" value={qty} onChange={(event) => setQty(event.target.value)} />
          </Field>
        )}
        <Field label="Item note">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. no ice" className="min-h-[64px]" />
        </Field>
      </div>
    </Modal>
  )
}

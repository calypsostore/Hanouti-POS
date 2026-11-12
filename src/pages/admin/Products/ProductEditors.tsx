import { useState } from 'react'
import type { Category, Product, ProductModifierGroup, ProductVariant, SaleUnit } from '../../../types'
import { Button, Field, Input, Modal, Select, Toggle } from '../../../components/ui'
import { cn } from '../../../lib/utils'
import { ProductOptionsEditor } from './ProductOptionsEditor'

const EMOJIS = [
  '☕', '🫖', '🧃', '🥐', '🥪', '🍰', '🥤', '💧', '🍋', '🍊', '🍓', '🍫',
  '🫓', '🥚', '🍗', '🧊', '🌿', '🧁', '🥙', '🍔', '🍕', '🍟', '🍩', '🍪',
  '🥗', '🍝', '🍳', '🧇', '🥞', '🍦', '🍹', '🥛', '🧋', '🍵', '🫘', '🥜',
]

function EmojiPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="max-h-[120px] overflow-y-auto rounded-xl border border-line p-2 thin-scrollbar">
      <div className="grid grid-cols-9 gap-1 sm:grid-cols-12">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-lg transition',
              value === emoji ? 'bg-accent-50 ring-1 ring-accent-500/40' : 'hover:bg-cream-100',
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
export function ProductEditor({
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
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [modifiers, setModifiers] = useState<ProductModifierGroup[]>(product?.modifiers ?? [])
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? [])
  const [soldByWeight, setSoldByWeight] = useState(product?.soldByWeight ?? false)
  const [saleUnit, setSaleUnit] = useState<SaleUnit>(product?.saleUnit ?? 'kg')

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
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
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
                  barcode: barcode.trim(),
                  modifiers,
                  variants,
                  soldByWeight,
                  saleUnit,
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
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.emoji} {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Selling price (DT)">
            <Input type="number" min={0} step={0.1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.000" className="tabular" />
          </Field>
          <Field label="Cost price (DT)" hint="For margin only">
            <Input type="number" min={0} step={0.1} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.000" className="tabular" />
          </Field>
          <Field label="Barcode" hint="Optional product barcode">
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or enter code" />
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
                <Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} className="tabular" />
              </Field>
              <p className="pb-2.5 text-[11px] text-muted">Units remaining</p>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-line bg-white p-3.5">
          <Toggle
            checked={soldByWeight}
            onChange={setSoldByWeight}
            label="Sell by weight or fractional quantity"
            description="Enter a quantity to three decimal places at checkout."
          />
          {soldByWeight && (
            <Field label="Sale unit" className="mt-3 max-w-[180px]">
              <Select value={saleUnit} onChange={(event) => setSaleUnit(event.target.value as SaleUnit)}>
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
                <option value="piece">Piece</option>
              </Select>
            </Field>
          )}
        </div>
        <ProductOptionsEditor
          modifiers={modifiers}
          variants={variants}
          onModifiersChange={setModifiers}
          onVariantsChange={setVariants}
        />
        <Toggle checked={active} onChange={setActive} label="Visible on the register" description="Turn off to hide without deleting." />
      </div>
    </Modal>
  )
}

export function CategoryEditor({
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
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
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

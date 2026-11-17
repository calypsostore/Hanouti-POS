import { Plus, Trash2 } from 'lucide-react'
import { Button, Field, Input, Select, Toggle } from '../../../components/ui'
import { uid } from '../../../lib/utils'
import type { InventoryItem, ProductModifierGroup, ProductModifierOption, ProductVariant } from '../../../types'
import { RecipeEditor } from './RecipeEditor'

export function ProductOptionsEditor({
  modifiers,
  variants,
  inventoryItems,
  quick,
  onModifiersChange,
  onVariantsChange,
}: {
  modifiers: ProductModifierGroup[]
  variants: ProductVariant[]
  inventoryItems: InventoryItem[]
  quick: boolean
  onModifiersChange: (groups: ProductModifierGroup[]) => void
  onVariantsChange: (items: ProductVariant[]) => void
}) {
  const patchGroup = (id: string, patch: Partial<ProductModifierGroup>) =>
    onModifiersChange(modifiers.map((group) => group.id === id ? { ...group, ...patch } : group))

  const patchOption = (groupId: string, optionId: string, patch: Partial<ProductModifierOption>) =>
    onModifiersChange(modifiers.map((group) => group.id === groupId
      ? { ...group, options: group.options.map((option) => option.id === optionId ? { ...option, ...patch } : option) }
      : group))

  const patchVariant = (id: string, patch: Partial<ProductVariant>) =>
    onVariantsChange(variants.map((variant) => variant.id === id ? { ...variant, ...patch } : variant))

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-xl border border-line p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[12.5px] font-semibold text-ink">Modifier groups</h3>
            <p className="text-[10.5px] text-muted">Options such as size, sugar or extras.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onModifiersChange([...modifiers, {
              id: uid('mod'),
              name: 'New group',
              selection: 'single',
              required: false,
              options: [{ id: uid('opt'), name: 'Option', priceDelta: 0 }],
            }])}
          >
            <Plus className="h-3.5 w-3.5" /> Group
          </Button>
        </div>
        {modifiers.map((group) => (
          <div key={group.id} className="space-y-2 rounded-lg bg-cream-50 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
              <Input value={group.name} onChange={(event) => patchGroup(group.id, { name: event.target.value })} placeholder="Group name" />
              <Select value={group.selection} onChange={(event) => patchGroup(group.id, { selection: event.target.value as 'single' | 'multiple' })}>
                <option value="single">Choose one</option>
                <option value="multiple">Choose multiple</option>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onModifiersChange(modifiers.filter((item) => item.id !== group.id))}
                aria-label="Remove modifier group"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Toggle checked={group.required} onChange={(required) => patchGroup(group.id, { required })} label="Require a selection" />
            <div className="space-y-2">
              {group.options.map((option) => (
                <div key={option.id} className="space-y-2 rounded-lg border border-line p-2">
                  <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
                    <Input value={option.name} onChange={(event) => patchOption(group.id, option.id, { name: event.target.value })} placeholder="Option name" />
                    <Field label="Price change (DT)">
                      <Input
                        type="number"
                        step="0.001"
                        value={option.priceDelta}
                        onChange={(event) => patchOption(group.id, option.id, { priceDelta: Number(event.target.value) || 0 })}
                      />
                    </Field>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => patchGroup(group.id, { options: group.options.filter((item) => item.id !== option.id) })}
                      aria-label="Remove modifier option"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {!quick && <RecipeEditor
                    recipe={option.recipe ?? []}
                    inventoryItems={inventoryItems}
                    onChange={(recipe) => patchOption(group.id, option.id, { recipe: recipe.length ? recipe : undefined })}
                  />}
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => patchGroup(group.id, { options: [...group.options, { id: uid('opt'), name: '', priceDelta: 0 }] })}
              >
                <Plus className="h-3.5 w-3.5" /> Option
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-xl border border-line p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[12.5px] font-semibold text-ink">Variants</h3>
            <p className="text-[10.5px] text-muted">
              {quick ? 'Size/color options with their own price and barcode.' : 'Size/color options with their own price, cost, barcode and stock.'}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onVariantsChange([...variants, {
              id: uid('var'),
              name: '',
              price: 0,
              cost: 0,
              barcode: '',
              trackStock: false,
              stock: 0,
            }])}
          >
            <Plus className="h-3.5 w-3.5" /> Variant
          </Button>
        </div>
        {variants.map((variant) => (
          <div key={variant.id} className="space-y-2 rounded-lg bg-cream-50 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Variant name">
                <Input value={variant.name} onChange={(event) => patchVariant(variant.id, { name: event.target.value })} placeholder="e.g. 500 ml / Blue" />
              </Field>
              <Field label="Size">
                <Input value={variant.size ?? ''} onChange={(event) => patchVariant(variant.id, { size: event.target.value })} placeholder="Optional" />
              </Field>
              <Field label="Color">
                <Input value={variant.color ?? ''} onChange={(event) => patchVariant(variant.id, { color: event.target.value })} placeholder="Optional" />
              </Field>
              <Field label="Barcode">
                <Input value={variant.barcode ?? ''} onChange={(event) => patchVariant(variant.id, { barcode: event.target.value })} />
              </Field>
              <Field label="Selling price (DT)">
                <Input type="number" min={0} step="0.001" value={variant.price} onChange={(event) => patchVariant(variant.id, { price: Number(event.target.value) || 0 })} />
              </Field>
              {!quick && <Field label="Cost price (DT)">
                <Input type="number" min={0} step="0.001" value={variant.cost} onChange={(event) => patchVariant(variant.id, { cost: Number(event.target.value) || 0 })} />
              </Field>}
            </div>
            {!quick && <Toggle
              checked={variant.trackStock}
              onChange={(trackStock) => patchVariant(variant.id, { trackStock })}
              label="Track variant stock"
            />}
            {!quick && variant.trackStock && (
              <Field label="Variant stock">
                <Input type="number" min={0} step="0.001" value={variant.stock} onChange={(event) => patchVariant(variant.id, { stock: Number(event.target.value) || 0 })} />
              </Field>
            )}
            {!quick && <RecipeEditor
              recipe={variant.recipe ?? []}
              inventoryItems={inventoryItems}
              onChange={(recipe) => patchVariant(variant.id, { recipe: recipe.length ? recipe : undefined })}
            />}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onVariantsChange(variants.filter((item) => item.id !== variant.id))}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove variant
            </Button>
          </div>
        ))}
      </section>
    </div>
  )
}

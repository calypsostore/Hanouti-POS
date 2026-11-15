import { Plus, Trash2 } from 'lucide-react'
import { Button, Field, Input, Select } from '../../../components/ui'
import type { InventoryItem, RecipeLine } from '../../../types'

export function RecipeEditor({
  recipe,
  inventoryItems,
  onChange,
}: {
  recipe: RecipeLine[]
  inventoryItems: InventoryItem[]
  onChange: (recipe: RecipeLine[]) => void
}) {
  const patchLine = (index: number, patch: Partial<RecipeLine>) =>
    onChange(recipe.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))

  return (
    <section className="space-y-2 rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-[12.5px] font-semibold text-ink">Recipe</h3>
          <p className="text-[10.5px] text-muted">Inventory amount consumed per sold unit when ingredient deduction is on.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!inventoryItems.length}
          onClick={() => {
            const firstItem = inventoryItems[0]
            if (firstItem) onChange([...recipe, { inventoryItemId: firstItem.id, qtyPerUnit: 1 }])
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Ingredient
        </Button>
      </div>
      {!inventoryItems.length && <p className="text-[11px] text-muted">Add an active inventory item before defining a recipe.</p>}
      {recipe.map((line, index) => (
        <div key={`${line.inventoryItemId}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
          <Field label="Inventory item">
            <Select value={line.inventoryItemId} onChange={(event) => patchLine(index, { inventoryItemId: event.target.value })}>
              {inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Quantity per unit">
            <Input
              type="number"
              min="0.001"
              step="0.001"
              value={line.qtyPerUnit}
              onChange={(event) => {
                const qtyPerUnit = Number(event.target.value)
                if (Number.isFinite(qtyPerUnit) && qtyPerUnit > 0) patchLine(index, { qtyPerUnit })
              }}
            />
          </Field>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="self-end"
            onClick={() => onChange(recipe.filter((_, lineIndex) => lineIndex !== index))}
            aria-label="Remove recipe ingredient"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </section>
  )
}

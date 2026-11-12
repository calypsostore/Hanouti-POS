import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, Field, Input, Modal, Select } from '../../../components/ui'
import type { InventoryItem, InventoryUnit } from '../../../types'
import type { InventoryItemInput } from '../../../store/types'

type PackageDraft = { label: string; quantity: string }

export default function InventoryItemEditor({
  item,
  onClose,
  onSave,
}: {
  item?: InventoryItem
  onClose: () => void
  onSave: (data: InventoryItemInput) => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? 'other')
  const [baseUnit, setBaseUnit] = useState<InventoryUnit>(item?.baseUnit ?? 'piece')
  const [reorderLevel, setReorderLevel] = useState(String(item?.reorderLevel ?? 0))
  const [packages, setPackages] = useState<PackageDraft[]>(
    item?.packages.map((pkg) => ({ label: pkg.label, quantity: String(pkg.baseQtyPerPackage) })) ??
      [{ label: '', quantity: '' }],
  )

  const save = () => {
    onSave({
      name,
      category,
      baseUnit,
      reorderLevel: Number(reorderLevel),
      packages: packages.map((pkg) => ({
        label: pkg.label,
        baseQtyPerPackage: Number(pkg.quantity),
      })),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? 'Edit inventory item' : 'New inventory item'}
      subtitle="Set a base unit and the package sizes used to enter stock."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{item ? 'Save changes' : 'Add item'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Item name">
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Coffee beans" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category">
            <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. coffee" />
          </Field>
          <Field label="Base unit">
            <Select value={baseUnit} onChange={(event) => setBaseUnit(event.target.value as InventoryUnit)}>
              <option value="g">Grams (g)</option>
              <option value="ml">Millilitres (ml)</option>
              <option value="piece">Pieces</option>
            </Select>
          </Field>
        </div>
        <Field label={`Reorder alert (${baseUnit})`}>
          <Input type="number" min="0" step="any" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} />
        </Field>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12.5px] font-semibold text-ink">Package sizes</div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setPackages((current) => [...current, { label: '', quantity: '' }])}
            >
              <Plus className="h-3.5 w-3.5" /> Add size
            </Button>
          </div>
          <div className="space-y-2">
            {packages.map((pkg, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <Field label={index === 0 ? 'Package label' : undefined}>
                  <Input
                    value={pkg.label}
                    onChange={(event) => setPackages((current) => current.map((entry, i) =>
                      i === index ? { ...entry, label: event.target.value } : entry,
                    ))}
                    placeholder="Bag 1 kg"
                  />
                </Field>
                <Field label={index === 0 ? `Quantity (${baseUnit})` : undefined}>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={pkg.quantity}
                    onChange={(event) => setPackages((current) => current.map((entry, i) =>
                      i === index ? { ...entry, quantity: event.target.value } : entry,
                    ))}
                    placeholder="1000"
                  />
                </Field>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove package size"
                  disabled={packages.length === 1}
                  onClick={() => setPackages((current) => current.filter((_, i) => i !== index))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

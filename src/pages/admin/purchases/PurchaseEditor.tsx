import { useMemo, useRef, useState } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { Button, Field, Input, Modal, Select, Textarea } from '../../../components/ui'
import { calculatePurchaseLine, calculatePurchaseSubtotal } from '../../../lib/purchases'
import type { Purchase, InventoryItem } from '../../../types'
import type { PurchaseInput, PurchaseLineInput } from '../../../store/types'

type DraftLine = {
  inventoryItemId: string
  packageId: string
  packageCount: string
  unitCost: string
}

const blankLine = (): DraftLine => ({ inventoryItemId: '', packageId: '', packageCount: '1', unitCost: '' })

export default function PurchaseEditor({
  suppliers,
  inventoryItems,
  purchase,
  onClose,
  onSave,
  onImageError,
}: {
  suppliers: Array<{ id: string; name: string }>
  inventoryItems: InventoryItem[]
  purchase?: Purchase
  onClose: () => void
  onSave: (data: PurchaseInput) => void
  onImageError: (message: string) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [supplierId, setSupplierId] = useState(purchase?.supplierId ?? suppliers[0]?.id ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState(purchase?.invoiceNumber ?? '')
  const [receivedAt, setReceivedAt] = useState(purchase?.receivedAt ?? '')
  const [note, setNote] = useState(purchase?.note ?? '')
  const [receiptImage, setReceiptImage] = useState(purchase?.receiptImage)
  const [lines, setLines] = useState<DraftLine[]>(purchase?.lines.map((line) => ({
    inventoryItemId: line.inventoryItemId,
    packageId: line.packageId,
    packageCount: String(line.packageCount),
    unitCost: String(line.unitCost),
  })) ?? [blankLine()])
  const subtotal = useMemo(() => calculatePurchaseSubtotal(lines.map((line) => {
    const item = inventoryItems.find((candidate) => candidate.id === line.inventoryItemId)
    const pkg = item?.packages.find((candidate) => candidate.id === line.packageId)
    if (!pkg) return 0
    return calculatePurchaseLine(Number(line.packageCount), pkg.baseQtyPerPackage, Number(line.unitCost)).lineTotal
  })), [inventoryItems, lines])

  const updateLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line, row) => row === index ? { ...line, ...patch } : line))

  const chooseImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 512_000) {
      onImageError('Choose a JPEG, PNG, or WebP receipt image under 500 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string' || reader.result.length > 700_000) {
        onImageError('This receipt image is too large to store.')
        return
      }
      setReceiptImage(reader.result)
    }
    reader.onerror = () => onImageError('Could not read the selected receipt image.')
    reader.readAsDataURL(file)
  }

  const save = () => {
    const purchaseLines: PurchaseLineInput[] = lines.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      packageId: line.packageId,
      packageCount: Number(line.packageCount),
      unitCost: Number(line.unitCost),
    }))
    onSave({
      supplierId,
      invoiceNumber,
      receivedAt,
      lines: purchaseLines,
      note,
      receiptImage,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={purchase ? 'Edit purchase' : 'Receive purchase'}
      subtitle="Received quantities are added to stock and update average cost."
      size="lg"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>{purchase ? 'Save changes' : 'Receive purchase'}</Button>
      </div>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Supplier">
            <Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </Select>
          </Field>
          <Field label="Invoice number" hint="Optional">
            <Input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} maxLength={100} />
          </Field>
          <Field label="Received date">
            <Input required type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">Purchase items</h3>
            <Button size="sm" variant="secondary" onClick={() => setLines((current) => [...current, blankLine()])}>
              <Plus className="h-3.5 w-3.5" /> Add line
            </Button>
          </div>
          {lines.map((line, index) => {
            const item = inventoryItems.find((candidate) => candidate.id === line.inventoryItemId)
            const packages = item?.packages ?? []
            const pkg = packages.find((candidate) => candidate.id === line.packageId)
            const lineTotal = pkg
              ? calculatePurchaseLine(Number(line.packageCount), pkg.baseQtyPerPackage, Number(line.unitCost)).lineTotal
              : 0
            return (
              <div key={index} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1.4fr_1.2fr_.8fr_.9fr_.9fr_auto]">
                <Field label={index === 0 ? 'Inventory item' : undefined}>
                  <Select value={line.inventoryItemId} onChange={(event) => {
                    const next = inventoryItems.find((candidate) => candidate.id === event.target.value)
                    updateLine(index, { inventoryItemId: event.target.value, packageId: next?.packages[0]?.id ?? '' })
                  }}>
                    <option value="">Choose item</option>
                    {inventoryItems.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}{candidate.active ? '' : ' (inactive)'}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={index === 0 ? 'Package' : undefined}>
                  <Select value={line.packageId} onChange={(event) => updateLine(index, { packageId: event.target.value })}>
                    <option value="">Choose package</option>
                    {packages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </Select>
                </Field>
                <Field label={index === 0 ? 'Packages' : undefined}>
                  <Input type="number" min="0.001" step="any" value={line.packageCount} onChange={(event) => updateLine(index, { packageCount: event.target.value })} />
                </Field>
                <Field label={index === 0 ? 'Cost / package' : undefined}>
                  <Input type="number" min="0" step="0.001" value={line.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} />
                </Field>
                <Field label={index === 0 ? 'Line total' : undefined}>
                  <div className="flex h-10 items-center text-sm font-bold text-ink">{lineTotal.toFixed(3)} TND</div>
                </Field>
                <Button size="icon" variant="ghost" aria-label="Remove purchase line" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, row) => row !== index))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
              <ImagePlus className="h-4 w-4" /> {receiptImage ? 'Replace receipt image' : 'Add receipt image'}
            </Button>
            {receiptImage && <Button type="button" size="sm" variant="ghost" onClick={() => setReceiptImage(undefined)}>Remove image</Button>}
            <input ref={fileInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} />
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">Purchase total</div>
            <div className="text-xl font-extrabold text-ink">{subtotal.toFixed(3)} TND</div>
          </div>
        </div>
        {receiptImage && <img src={receiptImage} alt="Purchase receipt" className="max-h-44 max-w-full rounded-lg border border-line object-contain" />}
        <Field label="Notes" hint="Optional">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
        </Field>
      </div>
    </Modal>
  )
}

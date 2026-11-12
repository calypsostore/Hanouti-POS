import { useState } from 'react'
import { Button, Field, Input, Modal, Textarea } from '../../../components/ui'
import type { InventoryItem } from '../../../types'

export type StockAction = 'opening' | 'waste' | 'adjustment' | 'count'

const actionLabels: Record<StockAction, string> = {
  opening: 'Record opening stock',
  waste: 'Record waste',
  adjustment: 'Adjust stock',
  count: 'Record stock count',
}

export default function StockActionModal({
  item,
  action,
  onClose,
  onSave,
}: {
  item: InventoryItem
  action: StockAction
  onClose: () => void
  onSave: (quantity: number, reason: string) => void
}) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const quantityLabel = action === 'count'
    ? `Counted quantity (${item.baseUnit})`
    : action === 'adjustment'
      ? `Quantity change (+/- ${item.baseUnit})`
      : `Quantity (${item.baseUnit})`

  return (
    <Modal
      open
      onClose={onClose}
      title={actionLabels[action]}
      subtitle={`${item.name} · current stock ${item.onHand} ${item.baseUnit}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(Number(quantity), reason)}>{actionLabels[action]}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={quantityLabel}>
          <Input
            autoFocus
            type="number"
            step="any"
            min={action === 'adjustment' ? undefined : '0'}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Reason">
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={action === 'opening' ? 'Initial stock count' : 'Add a short explanation'}
          />
        </Field>
      </div>
    </Modal>
  )
}

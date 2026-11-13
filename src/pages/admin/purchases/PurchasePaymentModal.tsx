import { useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '../../../components/ui'
import type { Purchase } from '../../../types'

export default function PurchasePaymentModal({
  purchase,
  balance,
  onClose,
  onSave,
}: {
  purchase: Purchase
  balance: number
  onClose: () => void
  onSave: (data: { amount: number; method: 'cash' | 'card' | 'bank_transfer' | 'other'; note: string }) => void
}) {
  const [amount, setAmount] = useState(String(balance))
  const [method, setMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'other'>('cash')
  const [note, setNote] = useState('')

  return (
    <Modal
      open
      onClose={onClose}
      title="Record supplier payment"
      subtitle={`${purchase.supplierName} · ${balance.toFixed(3)} TND remaining`}
      size="sm"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ amount: Number(amount), method, note })}>Record payment</Button>
      </div>}
    >
      <div className="space-y-3">
        <Field label="Amount (TND)">
          <Input autoFocus type="number" min="0.001" max={balance} step="0.001" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Payment method">
          <Select value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Note" hint="Optional">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} />
        </Field>
      </div>
    </Modal>
  )
}

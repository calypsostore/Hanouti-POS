import { useState } from 'react'
import { Button, Field, Modal, Textarea } from '../../../components/ui'
import type { Purchase } from '../../../types'

export default function VoidPurchaseModal({
  purchase,
  onClose,
  onConfirm,
}: {
  purchase: Purchase
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  return (
    <Modal
      open
      onClose={onClose}
      title="Void purchase"
      subtitle={`This reverses ${purchase.lines.length} stock line${purchase.lines.length === 1 ? '' : 's'} from ${purchase.supplierName}.`}
      size="sm"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Keep purchase</Button>
        <Button variant="danger" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Void purchase</Button>
      </div>}
    >
      <Field label="Reason" hint="Required for the audit log">
        <Textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} />
      </Field>
    </Modal>
  )
}

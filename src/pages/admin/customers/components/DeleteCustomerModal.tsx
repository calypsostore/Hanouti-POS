import { Button, Modal } from '../../../../components/ui'
import type { Customer } from '../../../../types'

type Props = {
  customer: Customer | null
  onClose: () => void
  onConfirm: () => void
}

export default function DeleteCustomerModal({ customer, onClose, onConfirm }: Props) {
  return (
    <Modal
      open={!!customer}
      onClose={onClose}
      title="Remove customer?"
      subtitle={customer?.name}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Remove customer
          </Button>
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">
        This removes the profile and its tab history. Customers with an outstanding balance cannot
        be removed.
      </p>
    </Modal>
  )
}

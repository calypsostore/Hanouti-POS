import ConfirmDeleteModal from '../../../../components/data/ConfirmDeleteModal'
import type { Customer } from '../../../../types'

type Props = {
  customer: Customer | null
  onClose: () => void
  onConfirm: () => void
}

export default function DeleteCustomerModal({ customer, onClose, onConfirm }: Props) {
  return (
    <ConfirmDeleteModal
      open={!!customer}
      onClose={onClose}
      title="Remove customer?"
      subject={customer?.name}
      confirmLabel="Remove customer"
      description="This removes the profile and its tab history. Customers with an outstanding balance cannot be removed."
      onConfirm={onConfirm}
    />
  )
}

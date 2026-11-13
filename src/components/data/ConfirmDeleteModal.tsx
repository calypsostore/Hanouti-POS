import { Button, Modal } from '../ui'

export default function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  subject,
  description,
  confirmLabel = 'Delete',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  subject?: string
  description: string
  confirmLabel?: string
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subject}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">{description}</p>
    </Modal>
  )
}

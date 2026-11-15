import { KeyRound, Trash2 } from 'lucide-react'
import type { Order } from '../../../../types'
import { Button, Field, Input, Modal, Textarea } from '../../../../components/ui'
import { money } from '../../../../lib/utils'
import { orderNumberLabel } from '../../../../lib/orderNumber'

type Props = {
  order: Order | null
  isAdmin: boolean
  pin: string
  reason: string
  onPinChange: (pin: string) => void
  onReasonChange: (reason: string) => void
  onClose: () => void
  onConfirm: () => void
}

export default function VoidOrderModal({
  order,
  isAdmin,
  pin,
  reason,
  onPinChange,
  onReasonChange,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title="Void this order?"
      subtitle={order ? `Order #${orderNumberLabel(order)} · ${money(order.total)}` : ''}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim() || (!isAdmin && !/^\d{4,6}$/.test(pin.trim()))}
            onClick={onConfirm}
          >
            <Trash2 className="h-4 w-4" /> Void order
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <p className="text-[13px] leading-relaxed text-muted">
          The sale will be marked as void and excluded from reports. If it was charged to a tab,
          the charge is reversed automatically. This cannot be undone.
        </p>
        <Field label="Reason" hint={`${reason.length}/240`}>
          <Textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value.slice(0, 240))}
            placeholder="Why is this order being voided?"
            rows={3}
            autoFocus={isAdmin}
          />
        </Field>
        {isAdmin ? (
          <div className="flex items-center gap-2 rounded-lg bg-cream-100 px-3 py-2 text-[11.5px] text-muted">
            <KeyRound className="h-3.5 w-3.5" />
            You are the store admin — the void is recorded under your name.
          </div>
        ) : (
          <Field label="Manager PIN" hint="Ask a manager to authorize this void">
            <Input
              value={pin}
              onChange={(event) => onPinChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="••••"
              className="font-mono text-center text-lg tracking-[0.4em]"
              autoFocus
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}

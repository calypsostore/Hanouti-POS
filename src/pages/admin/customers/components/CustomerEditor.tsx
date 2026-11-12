import { useState } from 'react'
import type { Customer, SettlementCycle } from '../../../../types'
import { Button, Field, Input, Modal, Select, Textarea } from '../../../../components/ui'

type Props = {
  open: boolean
  customer?: Customer
  onClose: () => void
  onSave: (data: {
    name: string
    phone: string
    limit: number
    notes: string
    cycle: SettlementCycle
  }) => void
}

export default function CustomerEditor({ open, customer, onClose, onSave }: Props) {
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [limit, setLimit] = useState(String(customer?.limit ?? 150))
  const [notes, setNotes] = useState(customer?.notes ?? '')
  const [cycle, setCycle] = useState<SettlementCycle>(customer?.cycle ?? 'monthly')

  const key = customer?.id ?? 'new'
  const [lastKey, setLastKey] = useState(key)
  if (lastKey !== key) {
    setLastKey(key)
    setName(customer?.name ?? '')
    setPhone(customer?.phone ?? '')
    setLimit(String(customer?.limit ?? 150))
    setNotes(customer?.notes ?? '')
    setCycle(customer?.cycle ?? 'monthly')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit customer' : 'New customer'}
      subtitle={customer ? customer.name : 'Create a card for a regular who runs a tab.'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                phone: phone.trim(),
                limit: Number(limit) || 0,
                notes: notes.trim(),
                cycle,
              })
            }
          >
            {customer ? 'Save changes' : 'Create customer'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <Field label="Full name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Mohamed Ali"
            autoFocus
          />
        </Field>
        <Field label="Phone" hint="Optional">
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+216 …"
          />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Credit limit (DT)" hint="0 = unlimited">
            <Input
              type="number"
              min={0}
              step={10}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              className="tabular"
            />
          </Field>
          <Field label="Settlement cycle">
            <Select
              value={cycle}
              onChange={(event) => setCycle(event.target.value as SettlementCycle)}
            >
              <option value="monthly">Monthly — end of month</option>
              <option value="weekly">Weekly — every Friday</option>
              <option value="on-demand">On demand — pay anytime</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes" hint="Optional">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="e.g. pays at the end of each month"
          />
        </Field>
        <div className="rounded-xl bg-cream-100 px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
          Staff can add orders and record payments from this card. Only store admins can edit the
          profile, credit limit or settlement cycle.
        </div>
      </div>
    </Modal>
  )
}

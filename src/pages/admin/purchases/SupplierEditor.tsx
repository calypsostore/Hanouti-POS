import { useState } from 'react'
import { Button, Field, Input, Modal, Textarea } from '../../../components/ui'
import type { Supplier } from '../../../types'
import type { SupplierInput } from '../../../store/types'

export default function SupplierEditor({
  supplier,
  onClose,
  onSave,
}: {
  supplier?: Supplier
  onClose: () => void
  onSave: (data: SupplierInput) => void
}) {
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier ? 'Edit supplier' : 'Add supplier'}
      size="md"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ name, phone, email, address, notes })}>
          {supplier ? 'Save changes' : 'Add supplier'}
        </Button>
      </div>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supplier name" className="sm:col-span-2">
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={100} />
        </Field>
        <Field label="Phone"><Input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} /></Field>
        <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={120} /></Field>
        <Field label="Address" className="sm:col-span-2">
          <Input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={240} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
        </Field>
      </div>
    </Modal>
  )
}

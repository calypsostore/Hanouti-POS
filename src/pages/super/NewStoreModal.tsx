import { useState } from 'react'
import { Button, Field, Input, Modal } from '../../components/ui'
import type { CreateStoreInput, Result } from '../../store/types'

const initialForm: CreateStoreInput = {
  name: '',
  slug: '',
  ownerName: '',
  ownerEmail: '',
  phone: '',
  address: '',
  city: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  adminPin: '',
}

export function NewStoreModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: CreateStoreInput) => Promise<Result>
}) {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const set = (key: keyof CreateStoreInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))
  const valid = form.name.trim() && form.slug.trim() && form.adminName.trim() &&
    form.adminEmail.trim() && form.adminPassword && /^\d{4,6}$/.test(form.adminPin)

  const save = async () => {
    setSaving(true)
    const result = await onSave(form)
    setSaving(false)
    if (result.ok) {
      setForm(initialForm)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a store"
      subtitle="The first administrator chooses the business template at sign-in."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || saving} onClick={() => void save()}>
            {saving ? 'Creating…' : 'Create store'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Store name"><Input value={form.name} onChange={(event) => set('name', event.target.value)} autoFocus /></Field>
        <Field label="Store code" hint="Lowercase letters, numbers and hyphens"><Input value={form.slug} onChange={(event) => set('slug', event.target.value)} /></Field>
        <Field label="Owner name"><Input value={form.ownerName} onChange={(event) => set('ownerName', event.target.value)} /></Field>
        <Field label="Owner email"><Input type="email" value={form.ownerEmail} onChange={(event) => set('ownerEmail', event.target.value)} /></Field>
        <Field label="City"><Input value={form.city} onChange={(event) => set('city', event.target.value)} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={(event) => set('address', event.target.value)} /></Field>
        <div className="sm:col-span-2 border-t border-line pt-3">
          <h3 className="text-sm font-bold text-ink">First administrator</h3>
        </div>
        <Field label="Name"><Input value={form.adminName} onChange={(event) => set('adminName', event.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={form.adminEmail} onChange={(event) => set('adminEmail', event.target.value)} /></Field>
        <Field label="Initial password"><Input type="password" value={form.adminPassword} onChange={(event) => set('adminPassword', event.target.value)} /></Field>
        <Field label="Initial PIN" hint="4–6 digits"><Input inputMode="numeric" value={form.adminPin} onChange={(event) => set('adminPin', event.target.value)} /></Field>
      </div>
    </Modal>
  )
}

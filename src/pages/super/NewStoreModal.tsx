import { useState } from 'react'
import { Button, Field, Input, Modal } from '../../components/ui'
import type { CreateStoreInput, Result } from '../../store/types'

type StoreForm = Omit<CreateStoreInput, 'temporaryPassword'>

const initialForm: StoreForm = {
  name: '',
  slug: '',
  ownerName: '',
  ownerEmail: '',
  phone: '',
  address: '',
  city: '',
}

const createTemporaryPassword = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

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
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [copyError, setCopyError] = useState('')
  const [saveError, setSaveError] = useState('')
  const set = (key: keyof StoreForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))
  const valid = form.name.trim() && form.slug.trim() && form.ownerName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail.trim())
  const close = () => {
    setForm(initialForm)
    setTemporaryPassword('')
    setCopyError('')
    setSaveError('')
    onClose()
  }

  const save = async () => {
    setSaving(true)
    setCopyError('')
    setSaveError('')
    try {
      const generatedPassword = createTemporaryPassword()
      const result = await onSave({ ...form, temporaryPassword: generatedPassword })
      if (result.ok) setTemporaryPassword(generatedPassword)
      else setSaveError(result.error)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not create the store.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={temporaryPassword ? 'Temporary owner password' : 'Create a store'}
      subtitle={temporaryPassword
        ? 'Share this one-time password securely. The owner must change it at first sign-in.'
        : 'The owner signs in with their email and changes the temporary password on first use.'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          {temporaryPassword ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button disabled={!valid || saving} onClick={() => void save()}>
                {saving ? 'Creating…' : 'Create store'}
              </Button>
            </>
          )}
        </div>
      }
    >
      {temporaryPassword ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Owner: <strong className="text-ink">{form.ownerEmail}</strong></p>
          <p className="text-xs text-muted">Email delivery is not configured. Copy this password and send it to the owner through a trusted channel.</p>
          <Field label="Temporary password">
            <Input readOnly value={temporaryPassword} className="font-mono" />
          </Field>
          {copyError && <p role="alert" className="text-xs text-red-600">{copyError}</p>}
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(temporaryPassword)
                setCopyError('')
              } catch {
                setCopyError('Could not copy the password. Select and copy it manually.')
              }
            }}
          >
            Copy temporary password
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Store name"><Input value={form.name} onChange={(event) => set('name', event.target.value)} autoFocus /></Field>
          <Field label="Store code" hint="Up to 40 lowercase letters, numbers and hyphens">
            <Input maxLength={40} value={form.slug} onChange={(event) => set('slug', event.target.value)} />
          </Field>
          <Field label="Owner full name"><Input value={form.ownerName} onChange={(event) => set('ownerName', event.target.value)} /></Field>
          <Field label="Owner email"><Input type="email" value={form.ownerEmail} onChange={(event) => set('ownerEmail', event.target.value)} /></Field>
          <Field label="City"><Input value={form.city} onChange={(event) => set('city', event.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={(event) => set('address', event.target.value)} /></Field>
        </div>
      )}
      {!temporaryPassword && saveError && <p role="alert" className="mt-3 text-xs text-red-600">{saveError}</p>}
    </Modal>
  )
}

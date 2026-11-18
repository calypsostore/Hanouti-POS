import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, Input } from '../components/ui'
import { useToast } from '../components/toast'
import { useApp } from '../store/AppStore'
import { staffLandingPath } from '../lib/posNavigation'

export default function ChangePassword() {
  const { user, changeOwnPassword } = useApp()
  const navigate = useNavigate()
  const { push } = useToast()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 10) {
      setError('Use a password with at least 10 characters.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }
    setSaving(true)
    try {
      const result = await changeOwnPassword(password)
      if (!result.ok) {
        setError(result.error)
        push(result.error, 'error')
        return
      }
      push('Your password has been changed.')
      navigate(user?.role === 'super'
        ? '/super'
        : user?.role === 'staff'
          ? staffLandingPath()
          : '/admin',
      { replace: true })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Could not change your password.'
      setError(message)
      push(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-cream-100 p-4">
      <form onSubmit={(event) => void submit(event)} className="glass-strong w-full max-w-md space-y-4 rounded-3xl p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Change your password</h1>
          <p className="mt-2 text-sm text-muted">
            This is your first sign-in. Set a new password before continuing.
          </p>
        </div>
        <Field label="New password" hint="At least 10 characters">
          <Input
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </Field>
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving} loading={saving}>
          Save new password
        </Button>
      </form>
    </main>
  )
}

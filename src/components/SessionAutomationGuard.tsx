import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { inactivityAction } from '../lib/automation'
import { isValidPin } from '../shared/pin'
import { useApp } from '../store/AppStore'
import { Button, Input } from './ui'
import { useToast } from './toast'

export function SessionAutomationGuard({ children }: { children: ReactNode }) {
  const { user, store, logout, verifyPin, providerMode } = useApp()
  const navigate = useNavigate()
  const { push } = useToast()
  const lastActivity = useRef(0)
  const [lockedUserId, setLockedUserId] = useState<string | null>(null)
  const locked = lockedUserId === user?.id
  const [pinAttempt, setPinAttempt] = useState({ userId: '', value: '' })
  const pin = pinAttempt.userId === user?.id ? pinAttempt.value : ''
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    lastActivity.current = Date.now()
  }, [user?.id])

  useEffect(() => {
    if (!user || user.stationOnly || !store) return
    const recordActivity = () => {
      if (!locked) lastActivity.current = Date.now()
    }
    window.addEventListener('pointerdown', recordActivity, true)
    window.addEventListener('keydown', recordActivity, true)
    const timer = window.setInterval(() => {
      const action = inactivityAction(
        Date.now() - lastActivity.current,
        user.pin || providerMode === 'hub' ? store.settings.automation.autoLockMinutes : 0,
        store.settings.automation.autoLogoutMinutes,
      )
      if (action === 'logout') {
        logout()
        navigate('/login', { replace: true })
      } else if (action === 'lock') {
        setLockedUserId(user.id)
      }
    }, 1000)
    return () => {
      window.removeEventListener('pointerdown', recordActivity, true)
      window.removeEventListener('keydown', recordActivity, true)
      window.clearInterval(timer)
    }
  }, [locked, logout, navigate, providerMode, store, user])

  const unlock = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || !isValidPin(pin)) {
      push('Enter your 4–12 digit staff PIN.', 'error')
      return
    }
    setChecking(true)
    try {
      if (!await verifyPin(pin)) {
        push('That PIN did not match this account.', 'error')
        return
      }
      lastActivity.current = Date.now()
      setLockedUserId(null)
      setPinAttempt({ userId: user.id, value: '' })
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not verify the PIN.', 'error')
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      {children}
      {locked && user && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-espresso-950/90 p-4 backdrop-blur-md">
          <form onSubmit={(event) => void unlock(event)}
            className="w-full max-w-sm space-y-4 rounded-3xl border border-white/15 bg-white p-6 text-center shadow-2xl">
            <div className="text-xl font-extrabold">Session locked</div>
            <p className="text-sm text-muted">Enter {user.name}&apos;s staff PIN to resume. Your cart and open tables are unchanged.</p>
            <Input autoFocus type="password" inputMode="numeric" autoComplete="current-password"
              maxLength={12} value={pin} onChange={(event) => setPinAttempt({
                userId: user.id,
                value: event.target.value.replace(/\D/g, ''),
              })}
              aria-label="Staff PIN" />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" loading={checking}
                disabled={checking || (!user.pin && providerMode === 'local')}>
                Unlock
              </Button>
              <Button type="button" variant="secondary" onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}>
                Sign out
              </Button>
            </div>
            {!user.pin && providerMode === 'local' && (
              <p className="text-xs text-danger">This account has no saved PIN; sign out and ask an admin to set one.</p>
            )}
          </form>
        </div>
      )}
    </>
  )
}

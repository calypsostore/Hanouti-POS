import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, Input } from '../components/ui'
import { useApp } from '../store/AppStore'
import { verifySecret } from '../lib/hash'
import { isValidPin, PIN_MAX_LENGTH, PIN_RANGE_HINT } from '../shared/pin'
import { parseStationDeviceSession, STATION_DEVICE_SESSION_KEY, type StationDeviceSession } from '../lib/stationDeviceSession'
import StationBoard from './pos/StationBoard'

type DeviceScope = { deviceId: string; token: string; storeId: string; stationIds: string[] }

const readSession = (): StationDeviceSession | null => {
  try {
    const stored = localStorage.getItem(STATION_DEVICE_SESSION_KEY)
    return stored ? parseStationDeviceSession(stored) : null
  } catch {
    return null
  }
}

export default function StationDeviceKiosk() {
  const { db, validateStationDeviceSession } = useApp()
  const navigate = useNavigate()
  const [session] = useState(readSession)
  const [scope, setScope] = useState<DeviceScope | null>(null)
  const [sessionError, setSessionError] = useState('')
  const [exitOpen, setExitOpen] = useState(false)
  const [managerPin, setManagerPin] = useState('')
  const [exitError, setExitError] = useState('')
  const [failedPins, setFailedPins] = useState(0)
  const [wakeLockAvailable, setWakeLockAvailable] = useState(true)
  const sessionStoreId = scope?.storeId ??
    db.stationDevices.find((device) => device.id === session?.deviceId)?.storeId

  const validate = useCallback(async () => {
    if (!session) {
      setSessionError('No paired station device is saved in this browser.')
      return
    }
    try {
      const result = await validateStationDeviceSession(session.deviceId, session.token)
      if (!result.ok) {
        setScope(null)
        setSessionError(result.error)
        return
      }
      setScope({
        deviceId: result.deviceId,
        token: result.token,
        storeId: result.storeId,
        stationIds: result.stationIds,
      })
      setSessionError('')
    } catch (validationError) {
      setSessionError(validationError instanceof Error ? validationError.message : 'Could not reconnect to this station device.')
    }
  }, [session, validateStationDeviceSession])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => { void validate() }, 0)
    const timer = window.setInterval(() => { void validate() }, 30_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void validate()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [validate])

  useEffect(() => {
    const deviceId = scope?.deviceId
    if (!deviceId) return
    let active = true
    let sentinel: { release: () => Promise<void> } | undefined
    const requestWakeLock = async () => {
      try {
        const wakeLock = (navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
        }).wakeLock
        if (!wakeLock) {
          setWakeLockAvailable(false)
          return
        }
        sentinel = await wakeLock.request('screen')
        if (!active) await sentinel.release()
      } catch {
        setWakeLockAvailable(false)
      }
    }
    void requestWakeLock()
    return () => {
      active = false
      if (sentinel) void sentinel.release()
    }
  }, [scope?.deviceId])

  const exitKiosk = async (event: React.FormEvent) => {
    event.preventDefault()
    setExitError('')
    if (failedPins >= 5) {
      setExitError('Manager PIN sign-in is temporarily locked.')
      return
    }
    const managers = db.users.filter((candidate) =>
      candidate.active && (candidate.role === 'admin' || candidate.role === 'manager') &&
      (!sessionStoreId || candidate.storeId === sessionStoreId),
    )
    let valid = false
    if (isValidPin(managerPin)) {
      for (const candidate of managers) {
        if (await verifySecret(managerPin, candidate.pin)) {
          valid = true
          break
        }
      }
    }
    if (!valid) {
      const attempts = failedPins + 1
      setFailedPins(attempts)
      setExitError(attempts >= 5 ? 'Too many incorrect PINs. Pair the device again or ask an owner to reset it.' : 'Manager PIN not recognised.')
      return
    }
    try {
      localStorage.removeItem(STATION_DEVICE_SESSION_KEY)
    } catch {
      setExitError('Could not clear the device session from this browser.')
      return
    }
    setScope(null)
    navigate('/login', { replace: true })
  }

  const device = scope
    ? db.stationDevices.find((candidate) => candidate.id === scope.deviceId)
    : undefined

  if (!scope) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream-50 p-5">
        <div className="w-full max-w-md space-y-3 rounded-3xl border border-line bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-ink">Station kiosk is locked</h1>
          <p role="status" className="text-sm text-muted">{sessionError || 'Connecting to the paired station…'}</p>
          <p className="text-xs text-muted">Only this browser can see its local store data until the shop hub is connected.</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => void validate()}>Reconnect</Button>
            <Button variant="secondary" onClick={() => { setExitOpen(true); setExitError('') }}>Manager unlock</Button>
          </div>
          <Link className="block text-xs font-semibold text-accent-foreground underline" to="/pair">Pair a station device</Link>
        </div>
        {exitOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
            <form onSubmit={exitKiosk} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
              <h2 className="text-lg font-bold text-ink">Unlock station kiosk</h2>
              <Field label="Owner or manager PIN" hint={PIN_RANGE_HINT}>
                <Input
                  autoFocus
                  type="password"
                  maxLength={PIN_MAX_LENGTH}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  value={managerPin}
                  onChange={(event) => setManagerPin(event.target.value.slice(0, PIN_MAX_LENGTH))}
                />
              </Field>
              {exitError && <p role="alert" className="text-xs text-red-600">{exitError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setExitOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={managerPin.length < 4 || failedPins >= 5}>Unlock</Button>
              </div>
            </form>
          </div>
        )}
      </main>
    )
  }

  return (
    <>
      <StationBoard
        deviceSession={scope}
        deviceName={device?.name}
        wakeLockAvailable={wakeLockAvailable}
        onExitRequest={() => { setExitOpen(true); setExitError('') }}
      />
      {exitOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form onSubmit={exitKiosk} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-ink">Exit station kiosk</h2>
              <p className="mt-1 text-xs text-muted">Enter an owner or manager PIN to unlock this device.</p>
            </div>
            <Field label="Manager PIN" hint={PIN_RANGE_HINT}>
              <Input
                autoFocus
                type="password"
                maxLength={PIN_MAX_LENGTH}
                autoCapitalize="characters"
                autoCorrect="off"
                value={managerPin}
                onChange={(event) => setManagerPin(event.target.value.slice(0, PIN_MAX_LENGTH))}
              />
            </Field>
            {exitError && <p role="alert" className="text-xs text-red-600">{exitError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setExitOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={managerPin.length < 4 || failedPins >= 5}>Unlock</Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat } from 'lucide-react'
import { Button, Field, Input } from '../components/ui'
import { useApp } from '../store/AppStore'
import { STATION_DEVICE_SESSION_KEY } from '../lib/stationDeviceSession'

export default function PairStationDevice() {
  const { pairStationDevice, logout } = useApp()
  const navigate = useNavigate()
  const [storeCode, setStoreCode] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const pair = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await pairStationDevice(storeCode, pairingCode)
      if (!result.ok) {
        setError(result.error)
        return
      }
      try {
        localStorage.setItem(STATION_DEVICE_SESSION_KEY, JSON.stringify({
          deviceId: result.deviceId,
          token: result.token,
        }))
      } catch {
        setError('Pairing succeeded, but this browser cannot store its device token. Ask a manager to unpair and pair again.')
        return
      }
      logout()
      navigate('/kiosk', { replace: true })
    } catch (pairingError) {
      setError(pairingError instanceof Error ? pairingError.message : 'Could not pair this device.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-cream-50 p-4">
      <form onSubmit={pair} className="w-full max-w-md space-y-4 rounded-3xl border border-line bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-50 text-accent-foreground">
            <ChefHat className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-ink">Pair station screen</h1>
            <p className="text-xs text-muted">Enter the store code and the 6-digit pairing code.</p>
          </div>
        </div>
        <Field label="Store code">
          <Input value={storeCode} onChange={(event) => setStoreCode(event.target.value.trim().toLowerCase())} autoCapitalize="none" autoComplete="off" required />
        </Field>
        <Field label="Pairing code">
          <Input
            value={pairingCode}
            onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center font-mono text-xl tracking-[0.4em]"
            required
          />
        </Field>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || pairingCode.length !== 6} loading={busy}>
          Pair and open station board
        </Button>
        <p className="text-xs leading-relaxed text-muted">
          Until the shop hub is available, this local demo can pair screens only in a browser that already has the store data.
          Separate devices do not receive orders from other phones.
        </p>
      </form>
    </main>
  )
}

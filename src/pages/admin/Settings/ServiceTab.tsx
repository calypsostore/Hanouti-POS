import type { StoreSettings, TicketSendPolicy } from '../../../types'
import { Field, Input, Select } from '../../../components/ui'

type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void

export default function ServiceTab({
  settings,
  set,
}: {
  settings: StoreSettings
  set: SettingsSetter
}) {
  const setNumber = (key: 'ticketDelaySeconds' | 'ticketIdleSeconds' | 'stationTimerMinutes', value: string) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) set(key, Math.max(1, Math.min(180, Math.round(parsed))))
  }

  return (
    <div className="max-w-3xl space-y-5">
      <section className="glass rounded-3xl p-5">
        <h3 className="text-sm font-bold text-ink">Send to stations</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          New table items are saved automatically. Choose when they are sent to their assigned station.
        </p>
        <Field label="Send policy" className="mt-4">
          <Select
            value={settings.ticketSendPolicy}
            onChange={(event) => set('ticketSendPolicy', event.target.value as TicketSendPolicy)}
          >
            <option value="done_or_idle">On Done or after idle (default, 20 s)</option>
            <option value="instant">Instantly</option>
            <option value="delayed">After a delay (undo window, default 10 s)</option>
            <option value="done_only">Only on Done</option>
          </Select>
        </Field>
        {settings.ticketSendPolicy === 'delayed' && (
          <Field label="Undo window (seconds)" className="mt-3 max-w-xs">
            <Input type="number" min={1} max={180} value={settings.ticketDelaySeconds} onChange={(event) => setNumber('ticketDelaySeconds', event.target.value)} />
          </Field>
        )}
        {settings.ticketSendPolicy === 'done_or_idle' && (
          <Field label="Idle send delay (seconds)" className="mt-3 max-w-xs">
            <Input type="number" min={1} max={180} value={settings.ticketIdleSeconds} onChange={(event) => setNumber('ticketIdleSeconds', event.target.value)} />
          </Field>
        )}
      </section>
      <section className="glass rounded-3xl p-5">
        <h3 className="text-sm font-bold text-ink">Station timer</h3>
        <p className="mt-1 text-xs text-muted">Station board cards change color after this many minutes.</p>
        <Field label="Preparation target (minutes)" className="mt-4 max-w-xs">
          <Input type="number" min={1} max={180} value={settings.stationTimerMinutes} onChange={(event) => setNumber('stationTimerMinutes', event.target.value)} />
        </Field>
      </section>
    </div>
  )
}

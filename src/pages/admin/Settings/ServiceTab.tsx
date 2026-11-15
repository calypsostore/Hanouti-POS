import type { StoreSettings, TicketSendPolicy } from '../../../types'
import { Field, Input, Select, Textarea, Toggle } from '../../../components/ui'

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
      <section className="glass rounded-3xl p-5">
        <h3 className="text-sm font-bold text-ink">Availability (86)</h3>
        <p className="mt-1 text-xs text-muted">Control how unavailable menu items are blocked, displayed, and returned.</p>
        <div className="mt-4 space-y-3">
          <Toggle checked={settings.availability.enabled} onChange={(value) => set('availability', { ...settings.availability, enabled: value })} label="Enable 86 availability" description="86'd items are blocked from new orders." />
          <Toggle checked={settings.availability.autoEightySixAtZero} onChange={(value) => set('availability', { ...settings.availability, autoEightySixAtZero: value })} label="Auto-86 tracked stock at zero" description="Tracked products and variants become unavailable when stock reaches zero." />
          <Toggle checked={settings.availability.autoReturnOnRestock} onChange={(value) => set('availability', { ...settings.availability, autoReturnOnRestock: value })} label="Auto-return on restock" description="Items with the restock return mode become available when stock is positive." />
          <Toggle checked={settings.availability.requireReason} onChange={(value) => set('availability', { ...settings.availability, requireReason: value })} label="Require a reason" description="Staff must choose a configured reason when 86'ing an item." />
          <Toggle checked={settings.availability.showListButton} onChange={(value) => set('availability', { ...settings.availability, showListButton: value })} label="Show the 86 list on POS" description="Show staff a live list of unavailable items." />
          <Toggle checked={settings.availability.resetManualAtDayStart} onChange={(value) => set('availability', { ...settings.availability, resetManualAtDayStart: value })} label="Reset manual 86s at day start" description="Clear manual 86 states when the local business day changes." />
          <Toggle checked={settings.availability.resetManualAtFirstShift} onChange={(value) => set('availability', { ...settings.availability, resetManualAtFirstShift: value })} label="Reset manual 86s at first shift" description="Clear manual 86 states when the first shift of the day opens." />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Default return mode" hint="Applied to newly 86'd items.">
            <Select value={settings.availability.defaultReturnMode} onChange={(event) => set('availability', {
              ...settings.availability,
              defaultReturnMode: event.target.value as StoreSettings['availability']['defaultReturnMode'],
            })}>
              <option value="manual">Manual</option>
              <option value="on_restock">When restocked</option>
              <option value="at_time">At a time</option>
            </Select>
          </Field>
          <Field label="Display style" hint="Choose how 86'd tiles appear in POS.">
            <Select value={settings.availability.displayStyle} onChange={(event) => set('availability', {
              ...settings.availability,
              displayStyle: event.target.value as StoreSettings['availability']['displayStyle'],
            })}>
              <option value="big_red_x">Big red X</option>
              <option value="dimmed_badge">Dimmed with badge</option>
            </Select>
          </Field>
        </div>
        <Field label="86 reason choices" hint="One reason per line; staff select from this list." className="mt-4">
          <Textarea
            value={settings.availability.reasons.join('\n')}
            onChange={(event) => set('availability', {
              ...settings.availability,
              reasons: event.target.value.split('\n').map((reason) => reason.trim().slice(0, 120)).filter(Boolean).slice(0, 20),
            })}
            className="min-h-24"
          />
        </Field>
      </section>
    </div>
  )
}

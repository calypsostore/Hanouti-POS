import type { StoreSettings } from '../../../types'
import { Field, Select, Textarea, Toggle } from '../../../components/ui'

export default function AvailabilitySettingsSection({
  settings,
  onChange,
}: {
  settings: StoreSettings['availability']
  onChange: (value: StoreSettings['availability']) => void
}) {
  const update = (patch: Partial<StoreSettings['availability']>) =>
    onChange({ ...settings, ...patch })

  return (
    <section className="glass rounded-3xl p-5">
      <h3 className="text-sm font-bold text-ink">Availability (86)</h3>
      <p className="mt-1 text-xs text-muted">Control how unavailable menu items are blocked, displayed, and returned.</p>
      <div className="mt-4 space-y-3">
        <Toggle checked={settings.enabled} onChange={(value) => update({ enabled: value })} label="Enable 86 availability" description="86'd items are blocked from new orders." />
        <Toggle checked={settings.autoEightySixAtZero} onChange={(value) => update({ autoEightySixAtZero: value })} label="Auto-86 tracked stock at zero" description="Tracked products and variants become unavailable when stock reaches zero." />
        <Toggle checked={settings.autoReturnOnRestock} onChange={(value) => update({ autoReturnOnRestock: value })} label="Auto-return on restock" description="Items with the restock return mode become available when stock is positive." />
        <Toggle checked={settings.requireReason} onChange={(value) => update({ requireReason: value })} label="Require a reason" description="Staff must choose a configured reason when 86'ing an item." />
        <Toggle checked={settings.showListButton} onChange={(value) => update({ showListButton: value })} label="Show the 86 list on POS" description="Show staff a live list of unavailable items." />
        <Toggle checked={settings.notifyStaffAboutChanges} onChange={(value) => update({ notifyStaffAboutChanges: value })} label="Notify staff about 86 changes" description="Show 86 and return events in notifications for staff on shift and admins." />
        <Toggle checked={settings.showCountOnStationScreens} onChange={(value) => update({ showCountOnStationScreens: value })} label="Show 86 count on station screens" description="Display the current unavailable-item count on kitchen and bar boards." />
        <Toggle checked={settings.resetManualAtDayStart} onChange={(value) => update({ resetManualAtDayStart: value })} label="Reset manual 86s at day start" description="Clear manual 86 states when the local business day changes." />
        <Toggle checked={settings.resetManualAtFirstShift} onChange={(value) => update({ resetManualAtFirstShift: value })} label="Reset manual 86s at first shift" description="Clear manual 86 states when the first shift of the day opens." />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Default return mode" hint="Applied to newly 86'd items.">
          <Select value={settings.defaultReturnMode} onChange={(event) => update({
            defaultReturnMode: event.target.value as StoreSettings['availability']['defaultReturnMode'],
          })}>
            <option value="manual">Manual</option>
            <option value="on_restock">When restocked</option>
            <option value="at_time">At a time</option>
          </Select>
        </Field>
        <Field label="Display style" hint="Choose how 86'd tiles appear in POS.">
          <Select value={settings.displayStyle} onChange={(event) => update({
            displayStyle: event.target.value as StoreSettings['availability']['displayStyle'],
          })}>
            <option value="big_red_x">Big red X</option>
            <option value="dimmed_badge">Dimmed with badge</option>
          </Select>
        </Field>
      </div>
      <Field label="86 reason choices" hint="One reason per line; staff select from this list." className="mt-4">
        <Textarea
          value={settings.reasons.join('\n')}
          onChange={(event) => update({
            reasons: event.target.value.split('\n').map((reason) => reason.trim().slice(0, 120)).filter(Boolean).slice(0, 20),
          })}
          className="min-h-24"
        />
      </Field>
    </section>
  )
}

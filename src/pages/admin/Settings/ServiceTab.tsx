import type { StoreSettings, TicketSendPolicy } from '../../../types'
import { Field, Input, Select, Toggle } from '../../../components/ui'
import type { Category, InventoryItem, Product } from '../../../types'
import InventoryYieldTracking from './InventoryYieldTracking'
import AvailabilitySettingsSection from './AvailabilitySettingsSection'
import StaffItemsSettingsSection from './StaffItemsSettingsSection'

type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void

export default function ServiceTab({
  settings,
  set,
  products,
  inventoryItems,
  categories,
}: {
  settings: StoreSettings
  set: SettingsSetter
  products: Product[]
  inventoryItems: InventoryItem[]
  categories: Category[]
}) {
  const setNumber = (key: 'ticketDelaySeconds' | 'ticketIdleSeconds' | 'stationTimerMinutes', value: string) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) set(key, Math.max(1, Math.min(180, Math.round(parsed))))
  }

  return (
    <div className="max-w-3xl space-y-5">
      <InventoryYieldTracking
        settings={settings.inventoryYieldTracking}
        items={inventoryItems}
        products={products}
        categories={categories}
        onChange={(value) => set('inventoryYieldTracking', value)}
      />
      <StaffItemsSettingsSection
        settings={settings.staffConsumption}
        products={products}
        onChange={(value) => set('staffConsumption', value)}
      />
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
        <h3 className="text-sm font-bold text-ink">Order rules</h3>
        <p className="mt-1 text-xs text-muted">Apply the same stock, recipe and pricing rules to every order path.</p>
        <div className="mt-4 space-y-3">
          <Field label="When quantity is more than stock" hint="Warn asks for confirmation; authorized overrides are audited.">
            <Select value={settings.orderRules.stockOverflowMode} onChange={(event) => set('orderRules', {
              ...settings.orderRules,
              stockOverflowMode: event.target.value as StoreSettings['orderRules']['stockOverflowMode'],
            })}>
              <option value="block">Block</option>
              <option value="warn">Warn and ask</option>
              <option value="allow">Allow silently</option>
            </Select>
          </Field>
          <Toggle
            checked={settings.orderRules.deductIngredientsOnSale}
            onChange={(value) => set('orderRules', { ...settings.orderRules, deductIngredientsOnSale: value })}
            label="Deduct ingredients on sale"
            description="Consume configured product, variant and modifier recipes when a sale is paid."
          />
          <Field label="Open order price policy" hint="Sent items keep their original price and are never silently repriced.">
            <Select value={settings.orderRules.openOrderPricePolicy} onChange={(event) => set('orderRules', {
              ...settings.orderRules,
              openOrderPricePolicy: event.target.value as StoreSettings['orderRules']['openOrderPricePolicy'],
            })}>
              <option value="keep">Keep price at time of order</option>
              <option value="current">Use current price</option>
              <option value="ask">Ask</option>
            </Select>
          </Field>
          <Field label="Order number format" hint="The hub assigns final numbers; offline devices display a provisional device number.">
            <Select value={settings.orderRules.orderNumberFormat} onChange={(event) => set('orderRules', {
              ...settings.orderRules,
              orderNumberFormat: event.target.value as StoreSettings['orderRules']['orderNumberFormat'],
            })}>
              <option value="plain">Plain</option>
              <option value="daily">Daily reset</option>
              <option value="prefix">Prefix</option>
            </Select>
          </Field>
          {settings.orderRules.orderNumberFormat === 'prefix' && (
            <Field label="Order number prefix" hint="Up to 8 characters.">
              <Input
                maxLength={8}
                value={settings.orderRules.orderNumberPrefix}
                onChange={(event) => set('orderRules', {
                  ...settings.orderRules,
                  orderNumberPrefix: event.target.value,
                })}
              />
            </Field>
          )}
          <Toggle
            checked={settings.orderRules.showLowStockHints}
            onChange={(value) => set('orderRules', { ...settings.orderRules, showLowStockHints: value })}
            label="Show “Only N left” hints"
            description="Show remaining stock on product tiles and cart lines."
          />
          <Toggle
            checked={settings.orderRules.revalidationBanner}
            onChange={(value) => set('orderRules', { ...settings.orderRules, revalidationBanner: value })}
            label="Show revalidation banner"
            description="Flag price, availability and stock changes on carts and open tables."
          />
          <div className="rounded-xl border border-line p-3">
            <div className="text-xs font-semibold text-ink">Roles allowed to override stock</div>
            <p className="mt-1 text-[11px] text-muted">When off for a role, a manager PIN is required for a warned over-stock sale.</p>
            <div className="mt-3 space-y-2">
              {(['admin', 'manager', 'staff'] as const).map((role) => (
                <Toggle
                  key={role}
                  checked={settings.orderRules.stockOverrideRoles[role]}
                  onChange={(value) => set('orderRules', {
                    ...settings.orderRules,
                    stockOverrideRoles: { ...settings.orderRules.stockOverrideRoles, [role]: value },
                  })}
                  label={`${role[0].toUpperCase()}${role.slice(1)}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      <AvailabilitySettingsSection
        settings={settings.availability}
        onChange={(value) => set('availability', value)}
      />
    </div>
  )
}

import { useState } from 'react'
import type { StoreSettings, TicketSendPolicy } from '../../../types'
import { Button, Field, Input, Select, Toggle } from '../../../components/ui'
import type { Category, InventoryItem, Product } from '../../../types'
import InventoryYieldTracking from './InventoryYieldTracking'
import AvailabilitySettingsSection from './AvailabilitySettingsSection'

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
  const [staffProductQuery, setStaffProductQuery] = useState('')
  const setNumber = (key: 'ticketDelaySeconds' | 'ticketIdleSeconds' | 'stationTimerMinutes', value: string) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) set(key, Math.max(1, Math.min(180, Math.round(parsed))))
  }
  const staffProductMatches = staffProductQuery.trim()
    ? products.filter((product) =>
        !settings.staffConsumption.allowances.some((allowance) => allowance.productId === product.id) &&
        product.name.toLowerCase().includes(staffProductQuery.trim().toLowerCase()),
      ).slice(0, 30)
    : []

  return (
    <div className="max-w-3xl space-y-5">
      <InventoryYieldTracking
        settings={settings.inventoryYieldTracking}
        items={inventoryItems}
        products={products}
        categories={categories}
        onChange={(value) => set('inventoryYieldTracking', value)}
      />
      <section className="glass rounded-3xl p-5">
        <h3 className="text-sm font-bold text-ink">Staff items</h3>
        <p className="mt-1 text-xs text-muted">Allow staff to record their own items during an open shift; stock and Z reports include them.</p>
        <div className="mt-4 space-y-3">
          <Toggle
            checked={settings.staffConsumption.enabled}
            onChange={(value) => set('staffConsumption', { ...settings.staffConsumption, enabled: value })}
            label="Enable staff items"
            description="Only listed items and shift quantities are allowed."
          />
          {settings.staffConsumption.enabled && (
            <>
              <Field label="Staff item pricing" hint="Staff pay using cash or card; free items are recorded as zero-value cash transactions.">
                <Select value={settings.staffConsumption.pricing} onChange={(event) => set('staffConsumption', {
                  ...settings.staffConsumption,
                  pricing: event.target.value as StoreSettings['staffConsumption']['pricing'],
                })}>
                  <option value="full_price">Full price</option>
                  <option value="discount">Staff discount</option>
                  <option value="free">Free</option>
                </Select>
              </Field>
              {settings.staffConsumption.pricing === 'discount' && (
                <Field label="Staff discount (%)">
                  <Input type="number" min={0} max={100} step={1} value={settings.staffConsumption.discountPercent}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (Number.isFinite(value) && value >= 0 && value <= 100) {
                        set('staffConsumption', { ...settings.staffConsumption, discountPercent: value })
                      }
                    }} />
                </Field>
              )}
              <div className="space-y-2">
                <Field label="Search products to allow">
                  <Input value={staffProductQuery} onChange={(event) => setStaffProductQuery(event.target.value)}
                    placeholder="Type a product name" />
                </Field>
                <div className="text-xs font-semibold text-ink">Allowed items and per-shift limits</div>
                {settings.staffConsumption.allowances.map((allowance) => {
                  const product = products.find((candidate) => candidate.id === allowance.productId)
                  const productName = product?.name ?? 'Unavailable product'
                  return (
                    <div key={allowance.productId} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {productName}{product && !product.active && <span className="ml-1 text-muted">(inactive)</span>}
                      </span>
                      <Field label="Max per shift" className="w-28">
                        <Input type="number" min={1} max={100} step={1} value={allowance.maxPerShift}
                          onChange={(event) => {
                            const value = Number(event.target.value)
                            if (Number.isSafeInteger(value) && value >= 1 && value <= 100) {
                              set('staffConsumption', {
                                ...settings.staffConsumption,
                                allowances: settings.staffConsumption.allowances.map((entry) => entry.productId === allowance.productId
                                  ? { ...entry, maxPerShift: value }
                                  : entry),
                              })
                            }
                          }} />
                      </Field>
                      <Button type="button" size="sm" variant="danger" onClick={() => set('staffConsumption', {
                        ...settings.staffConsumption,
                        allowances: settings.staffConsumption.allowances.filter((entry) => entry.productId !== allowance.productId),
                      })}>Remove</Button>
                    </div>
                  )
                })}
                {staffProductQuery.trim() && staffProductMatches.map((product) => {
                  const allowance = settings.staffConsumption.allowances.find((entry) => entry.productId === product.id)
                  return (
                    <label key={product.id} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                      <input
                        type="checkbox"
                        checked={!!allowance}
                        disabled={!product.active && !allowance}
                        aria-label={`Allow staff to take ${product.name}`}
                        onChange={(event) => set('staffConsumption', {
                          ...settings.staffConsumption,
                          allowances: event.target.checked
                            ? [...settings.staffConsumption.allowances, { productId: product.id, maxPerShift: 1 }]
                            : settings.staffConsumption.allowances.filter((entry) => entry.productId !== product.id),
                        })}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{product.name}</span>
                      {allowance && <span className="text-xs text-muted">Allowed · {allowance.maxPerShift}/shift</span>}
                    </label>
                  )
                })}
                {staffProductQuery.trim() && staffProductMatches.length === 0 && (
                  <p className="text-xs text-muted">No matching products.</p>
                )}
                {!settings.staffConsumption.allowances.length && (
                  <p className="text-xs text-muted">Search for a product to allow staff items.</p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
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

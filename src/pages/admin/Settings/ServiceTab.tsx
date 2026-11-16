import type { StoreSettings, TicketSendPolicy } from '../../../types'
import { Field, Input, Select, Textarea, Toggle } from '../../../components/ui'
import type { InventoryItem, Product } from '../../../types'

type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void

export default function ServiceTab({
  settings,
  set,
  products,
  inventoryItems,
}: {
  settings: StoreSettings
  set: SettingsSetter
  products: Product[]
  inventoryItems: InventoryItem[]
}) {
  const setNumber = (key: 'ticketDelaySeconds' | 'ticketIdleSeconds' | 'stationTimerMinutes', value: string) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) set(key, Math.max(1, Math.min(180, Math.round(parsed))))
  }

  return (
    <div className="max-w-3xl space-y-5">
      <section className="glass rounded-3xl p-5">
        <h3 className="text-sm font-bold text-ink">Coffee bean tracking</h3>
        <p className="mt-1 text-xs text-muted">Compare recipe-based bean use from coffee sales with your expected servings per kilogram.</p>
        <div className="mt-4 space-y-3">
          <Toggle
            checked={settings.coffeeTracking.enabled}
            onChange={(value) => set('coffeeTracking', { ...settings.coffeeTracking, enabled: value })}
            label="Track coffee bean yield"
            description="Estimate bean use in shift reports; enable Order rules > Deduct ingredients on sale to decrement recipe stock automatically."
          />
          {settings.coffeeTracking.enabled && (
            <>
              <Field label="Coffee beans inventory" hint="Use an inventory item measured in grams and add its stock in grams.">
                <Select
                  value={settings.coffeeTracking.inventoryItemId ?? ''}
                  onChange={(event) => set('coffeeTracking', {
                    ...settings.coffeeTracking,
                    inventoryItemId: event.target.value || undefined,
                  })}
                >
                  <option value="">Choose beans</option>
                  {inventoryItems.filter((item) => item.baseUnit === 'g').map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Minimum servings per kg">
                  <Input type="number" min={1} max={1000} step={1} value={settings.coffeeTracking.servingsPerKgMin}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (Number.isSafeInteger(value) && value >= 1 && value <= 1000) {
                        set('coffeeTracking', { ...settings.coffeeTracking, servingsPerKgMin: value })
                      }
                    }} />
                </Field>
                <Field label="Maximum servings per kg">
                  <Input type="number" min={settings.coffeeTracking.servingsPerKgMin} max={1000} step={1} value={settings.coffeeTracking.servingsPerKgMax}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (Number.isSafeInteger(value) && value >= settings.coffeeTracking.servingsPerKgMin && value <= 1000) {
                        set('coffeeTracking', { ...settings.coffeeTracking, servingsPerKgMax: value })
                      }
                    }} />
                </Field>
              </div>
              <p className="text-[11px] text-muted">Add beans in grams to each coffee recipe; the shift report compares recipe use, yield estimate, and tracked stock.</p>
            </>
          )}
        </div>
      </section>
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
                <div className="text-xs font-semibold text-ink">Allowed items and per-shift limits</div>
                {products.map((product) => {
                  const allowance = settings.staffConsumption.allowances.find((entry) => entry.productId === product.id)
                  const allowances = settings.staffConsumption.allowances
                  return (
                    <div key={product.id} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                      <input
                        type="checkbox"
                        checked={!!allowance}
                        disabled={!product.active && !allowance}
                        aria-label={`Allow staff to take ${product.name}`}
                        onChange={(event) => set('staffConsumption', {
                          ...settings.staffConsumption,
                          allowances: event.target.checked
                            ? [...allowances, { productId: product.id, maxPerShift: 1 }]
                            : allowances.filter((entry) => entry.productId !== product.id),
                        })}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {product.name}{!product.active && <span className="ml-1 text-muted">(inactive)</span>}
                      </span>
                      {allowance && <Field label="Max per shift" className="w-28">
                        <Input type="number" min={1} max={100} step={1} value={allowance.maxPerShift}
                          onChange={(event) => {
                            const value = Number(event.target.value)
                            if (Number.isSafeInteger(value) && value >= 1 && value <= 100) {
                              set('staffConsumption', {
                                ...settings.staffConsumption,
                                allowances: allowances.map((entry) => entry.productId === product.id
                                  ? { ...entry, maxPerShift: value }
                                  : entry),
                              })
                            }
                          }} />
                      </Field>}
                    </div>
                  )
                })}
                {products.length === 0 && <p className="text-xs text-muted">Create a product first.</p>}
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
      <section className="glass rounded-3xl p-5">
        <h3 className="text-sm font-bold text-ink">Availability (86)</h3>
        <p className="mt-1 text-xs text-muted">Control how unavailable menu items are blocked, displayed, and returned.</p>
        <div className="mt-4 space-y-3">
          <Toggle checked={settings.availability.enabled} onChange={(value) => set('availability', { ...settings.availability, enabled: value })} label="Enable 86 availability" description="86'd items are blocked from new orders." />
          <Toggle checked={settings.availability.autoEightySixAtZero} onChange={(value) => set('availability', { ...settings.availability, autoEightySixAtZero: value })} label="Auto-86 tracked stock at zero" description="Tracked products and variants become unavailable when stock reaches zero." />
          <Toggle checked={settings.availability.autoReturnOnRestock} onChange={(value) => set('availability', { ...settings.availability, autoReturnOnRestock: value })} label="Auto-return on restock" description="Items with the restock return mode become available when stock is positive." />
          <Toggle checked={settings.availability.requireReason} onChange={(value) => set('availability', { ...settings.availability, requireReason: value })} label="Require a reason" description="Staff must choose a configured reason when 86'ing an item." />
          <Toggle checked={settings.availability.showListButton} onChange={(value) => set('availability', { ...settings.availability, showListButton: value })} label="Show the 86 list on POS" description="Show staff a live list of unavailable items." />
          <Toggle checked={settings.availability.notifyStaffAboutChanges} onChange={(value) => set('availability', { ...settings.availability, notifyStaffAboutChanges: value })} label="Notify staff about 86 changes" description="Show 86 and return events in notifications for staff on shift and admins." />
          <Toggle checked={settings.availability.showCountOnStationScreens} onChange={(value) => set('availability', { ...settings.availability, showCountOnStationScreens: value })} label="Show 86 count on station screens" description="Display the current unavailable-item count on kitchen and bar boards." />
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

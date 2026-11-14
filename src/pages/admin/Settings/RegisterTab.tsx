import { Check, CreditCard, Zap } from 'lucide-react'
import type { StoreSettings } from '../../../types'
import { Card, Field, Input, Toggle } from '../../../components/ui'
import { cn } from '../../../lib/utils'

type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void

export default function RegisterTab({
  settings,
  set,
  hasTablesHidden,
  onEnableTables,
}: {
  settings: StoreSettings
  set: SettingsSetter
  hasTablesHidden: boolean
  onEnableTables: () => void
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {hasTablesHidden && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-400/50 bg-amber-50 p-4">
            <p className="text-[13px] font-medium text-amber-950">
              Tables exist but are hidden from your team.
            </p>
            <button
              type="button"
              onClick={onEnableTables}
              className="rounded-lg bg-brand-amber px-3 py-2 text-xs font-bold text-brand-navy hover:brightness-105"
            >
              Enable
            </button>
          </Card>
        )}
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent-foreground" />
            <h3 className="text-[15px] font-semibold tracking-tight">How the register works</h3>
          </div>
          <p className="text-[12px] text-muted">
            Pick how staff finish a sale. Table service is controlled separately below.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ModeCard
              active={settings.posMode === 'quick'}
              onClick={() => set('posMode', 'quick')}
              icon={<Zap className="h-5 w-5" />}
              title="Quick order"
              badge="Track only"
              points={[
                'Tap items, press complete',
                'No cash or change handling',
                'Perfect for order tracking',
                'Tabs still available',
              ]}
            />
            <ModeCard
              active={settings.posMode === 'cashier'}
              onClick={() => set('posMode', 'cashier')}
              icon={<CreditCard className="h-5 w-5" />}
              title="Cashier"
              badge="Full POS"
              points={[
                'Cash, card or on-tab payment',
                'Change calculation',
                'Receipt printing',
                'Daily cash reconciliation',
              ]}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Staff shifts</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            Each person has an independent shift and cash report.
          </p>
          <div className="mt-3.5">
            <Toggle
              checked={settings.requireShiftForOrders}
              onChange={(value) => set('requireShiftForOrders', value)}
              label="Require an open shift to take orders"
              description={settings.posMode === 'quick'
                ? 'Optional in Quick mode; Quick mode does not calculate expected cash.'
                : 'Cashier mode requires staff to open their own shift before taking orders.'}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Totals & tax</h3>
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            <Field label="Tax rate (%)" hint="0 for no tax">
              <Input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={settings.taxRate}
                onChange={(e) => set('taxRate', Number(e.target.value) || 0)}
                className="tabular"
              />
            </Field>
            <Field label="Service charge (%)" hint="Added to subtotal">
              <Input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={settings.serviceCharge}
                onChange={(e) => set('serviceCharge', Number(e.target.value) || 0)}
                className="tabular"
              />
            </Field>
          </div>
          <div className="mt-3.5 rounded-xl border border-line bg-white p-3.5">
            <Toggle
              checked={settings.taxInclusive}
              onChange={(value) => set('taxInclusive', value)}
              label="Prices include tax"
              description="Menu prices already contain the tax. Turn off to add it at checkout."
            />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Customer tabs</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            Let regulars pay at the end of the month.
          </p>
          <div className="mt-3.5 space-y-3.5">
            <Toggle
              checked={settings.allowCredit}
              onChange={(value) => set('allowCredit', value)}
              label="Enable tabs & credit"
              description="Customers can carry a running balance and settle later."
            />
            <div className="h-px bg-line" />
            <Toggle
              checked={settings.requireCustomerForCredit}
              onChange={(value) => set('requireCustomerForCredit', value)}
              label="Require a customer for every tab"
              description="A tab must always be attached to a saved customer profile."
            />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Business features</h3>
          <p className="mt-0.5 text-[12px] text-muted">Turn optional register workflows on or off for this store.</p>
          <div className="mt-3.5 space-y-3.5">
            {([
              ['tables', 'Restaurant tables', 'Enable table workflows in the register.'],
              ['delivery', 'Delivery orders', 'Allow delivery as an order channel.'],
              ['kitchenScreen', 'Kitchen screen', 'Enable kitchen ticket workflows.'],
              ['barcode', 'Barcode scanning', 'Show the POS scan field and support product barcodes.'],
              ['weightItems', 'Weight-based items', 'Allow sales by kg, g or fractional piece.'],
            ] as const).map(([key, label, description]) => (
              <Toggle
                key={key}
                checked={settings.features[key]}
                onChange={(checked) => set('features', { ...settings.features, [key]: checked })}
                label={label}
                description={description}
              />
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <h3 className="text-[15px] font-semibold tracking-tight">Inventory</h3>
          <div className="mt-3.5">
            <Field label="Low stock warning at" hint="units">
              <Input
                type="number"
                min={0}
                value={settings.lowStockThreshold}
                onChange={(e) => set('lowStockThreshold', Number(e.target.value) || 0)}
                className="tabular"
              />
            </Field>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Items you choose to track will warn you at this level.
            </p>
          </div>
        </Card>

        <Card className="border-accent-foreground/20 bg-accent-50/50 p-5">
          <h3 className="text-[13.5px] font-semibold text-accent-foreground">A note on switching</h3>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-accent-foreground/80">
            Switching modes never changes past orders. Reports stay accurate and staff see the
            new flow on their next sale.
          </p>
        </Card>
      </div>
    </div>
  )
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  badge,
  points,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  badge: string
  points: string[]
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative rounded-2xl border p-4 text-left transition',
        active
          ? 'border-accent-foreground/50 bg-accent-50/50 ring-2 ring-accent-foreground/20'
          : 'border-line bg-white hover:border-accent-foreground/30 hover:bg-cream-50',
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            active ? 'bg-brand-amber text-brand-navy' : 'bg-cream-100 text-muted',
          )}
        >
          {icon}
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide',
            active ? 'bg-brand-amber text-brand-navy' : 'bg-cream-200 text-muted',
          )}
        >
          {badge}
        </span>
      </div>
      <div className="mt-3 text-[13.5px] font-bold text-ink">{title}</div>
      <ul className="mt-2 space-y-1">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-1.5 text-[11px] text-muted">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
            {point}
          </li>
        ))}
      </ul>
      {active && (
        <div className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-brand-amber">
          <Check className="h-2.5 w-2.5 text-brand-navy" />
        </div>
      )}
    </button>
  )
}

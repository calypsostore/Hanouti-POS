import { useState } from 'react'
import {
  Check,
  Copy,
  CreditCard,
  Palette,
  ReceiptText,
  RotateCcw,
  Save,
  Sparkles,
  Store as StoreIcon,
  Zap,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { StoreSettings } from '../../types'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Segmented,
  Textarea,
  Toggle,
} from '../../components/ui'
import { useToast } from '../../components/toast'
import { accentPalettes } from '../../lib/theme'
import { PLAN_INFO } from '../../data/seed'
import { cn, fmtDate, money } from '../../lib/utils'

const storeEmojis = ['☕', '🧁', '🫖', '🌿', '🥐', '🍰', '🍵', '🥤', '🫘', '🍽️']

type Tab = 'profile' | 'register' | 'receipt'

export default function Settings() {
  const { store, updateStore, updateSettings, resetDemo, user } = useApp()
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>('profile')
  const [resetOpen, setResetOpen] = useState(false)
  const [form, setForm] = useState({
    name: store?.name ?? '',
    emoji: store?.emoji ?? '☕',
    phone: store?.phone ?? '',
    address: store?.address ?? '',
    city: store?.city ?? '',
    ownerName: store?.ownerName ?? '',
  })
  const [settings, setSettings] = useState<StoreSettings>(
    () =>
      store?.settings ?? {
        posMode: 'cashier',
        currency: 'TND',
        taxRate: 0,
        taxInclusive: true,
        serviceCharge: 0,
        allowCredit: true,
        requireCustomerForCredit: true,
        receiptFooter: '',
        lowStockThreshold: 10,
        accent: 'caramel',
      },
  )
  const [copied, setCopied] = useState(false)

  if (!store) return null

  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }))

  const save = () => {
    updateStore(store.id, form)
    updateSettings(store.id, settings)
    push('Settings saved')
  }

  const plan = PLAN_INFO[store.plan]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Settings</h2>
          <p className="mt-1 text-[13px] text-muted">
            Shape how the register works for {store.name}.
          </p>
        </div>
        <Button onClick={save}>
          <Save className="h-4 w-4" /> Save changes
        </Button>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'profile', label: 'Store profile' },
          { value: 'register', label: 'Register & checkout' },
          { value: 'receipt', label: 'Receipt & branding' },
        ]}
      />

      {tab === 'profile' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <StoreIcon className="h-4 w-4 text-accent-600" />
              <h3 className="text-[15px] font-semibold tracking-tight">Store details</h3>
            </div>

            <div className="space-y-3.5">
              <div>
                <span className="mb-1.5 block text-[12.5px] font-semibold">Store icon</span>
                <div className="flex flex-wrap gap-1.5">
                  {storeEmojis.map((e) => (
                    <button
                      key={e}
                      onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition',
                        form.emoji === e
                          ? 'border-accent-500/50 bg-accent-50 ring-2 ring-accent-500/10'
                          : 'border-line bg-white hover:bg-cream-100',
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Store name" className="sm:col-span-2">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </Field>
                <Field label="Owner name">
                  <Input
                    value={form.ownerName}
                    onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </Field>
                <Field label="City">
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </Field>
                <Field label="Currency">
                  <Input value="TND · Tunisian Dinar" disabled />
                </Field>
              </div>

              <div className="rounded-xl border border-line bg-cream-50 px-3.5 py-3">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">
                  Staff register code
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-[15px] font-bold tracking-wide">{store.slug}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(store.slug)
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 1600)
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-semibold text-ink transition hover:bg-cream-100"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className="bg-espresso-900 p-5 text-cream-50 grain">
                <div className="flex items-center justify-between">
                  <Badge tone="dark" className="bg-white/10 text-white/80">
                    {store.status === 'trial' ? 'Trial' : plan.label} plan
                  </Badge>
                  <Sparkles className="h-4 w-4 text-accent-500" />
                </div>
                <div className="mt-3 text-[24px] font-extrabold tracking-tight">
                  {money(plan.price)}
                  <span className="text-[12px] font-medium text-white/40"> / month</span>
                </div>
                <p className="mt-1 text-[11.5px] text-white/50">{plan.blurb}</p>
                {store.status === 'trial' && store.trialEndsAt && (
                  <p className="mt-3 rounded-lg bg-white/10 px-2.5 py-2 text-[11px] text-white/70">
                    Trial ends {fmtDate(store.trialEndsAt)}
                  </p>
                )}
              </div>
              <div className="p-4 text-[11.5px] leading-relaxed text-muted">
                Plan changes are handled by the platform owner. Your data and customisations stay
                exactly as they are.
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-2 flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-muted" />
                <h3 className="text-[13.5px] font-semibold">Account</h3>
              </div>
              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-muted">Signed in as</span>
                  <span className="font-semibold">{user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Email</span>
                  <span className="font-semibold">{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Role</span>
                  <span className="font-semibold capitalize">{user?.role}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'register' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card className="p-5">
              <div className="mb-1 flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent-600" />
                <h3 className="text-[15px] font-semibold tracking-tight">How the register works</h3>
              </div>
              <p className="text-[12px] text-muted">
                Pick how your staff finish a sale. You can switch whenever you like.
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
                  onChange={(v) => set('taxInclusive', v)}
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
                  onChange={(v) => set('allowCredit', v)}
                  label="Enable tabs & credit"
                  description="Customers can carry a running balance and settle later."
                />
                <div className="h-px bg-line" />
                <Toggle
                  checked={settings.requireCustomerForCredit}
                  onChange={(v) => set('requireCustomerForCredit', v)}
                  label="Require a customer for every tab"
                  description="A tab must always be attached to a saved customer profile."
                />
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

            <Card className="border-accent-500/20 bg-accent-50/50 p-5">
              <h3 className="text-[13.5px] font-semibold text-accent-700">A note on switching</h3>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-accent-700/80">
                Switching modes never changes past orders. Reports stay accurate and staff see the
                new flow on their next sale.
              </p>
            </Card>
          </div>
        </div>
      )}

      {tab === 'receipt' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-accent-600" />
                <h3 className="text-[15px] font-semibold tracking-tight">Accent colour</h3>
              </div>
              <p className="mt-0.5 text-[12px] text-muted">
                Used across your dashboard and register.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {accentPalettes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => set('accent', p.id)}
                    className={cn(
                      'group rounded-xl border p-2.5 text-center transition',
                      settings.accent === p.id
                        ? 'border-espresso-900/20 bg-cream-100 ring-2 ring-espresso-900/10'
                        : 'border-line bg-white hover:bg-cream-100',
                    )}
                  >
                    <span
                      className="mx-auto flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: p.shades[600] }}
                    >
                      {settings.accent === p.id && <Check className="h-4 w-4 text-white" />}
                    </span>
                    <span className="mt-1.5 block text-[10.5px] font-semibold text-muted">{p.name}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-accent-600" />
                <h3 className="text-[15px] font-semibold tracking-tight">Receipt</h3>
              </div>
              <div className="mt-4">
                <Field label="Footer message" hint="Shown at the bottom of every receipt">
                  <Textarea
                    value={settings.receiptFooter}
                    onChange={(e) => set('receiptFooter', e.target.value)}
                    placeholder="Thank you for your visit!"
                  />
                </Field>
              </div>
              <div className="mt-3 rounded-xl bg-cream-100 px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
                Receipts print on any 58mm or 80mm thermal printer through the browser print dialog.
                In cashier mode, a receipt is offered after every completed sale.
              </div>
            </Card>
          </div>

          <div>
            <div className="rounded-2xl border border-line bg-cream-200/70 p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                Live preview
              </div>
              <div className="overflow-hidden rounded-xl bg-white p-4 text-[11px] shadow-sm">
                <div className="text-center">
                  <div className="text-lg">{form.emoji}</div>
                  <div className="text-[13px] font-extrabold">{form.name}</div>
                  <div className="mt-0.5 text-[9.5px] text-neutral-500">{form.address}</div>
                  <div className="text-[9.5px] text-neutral-500">
                    {form.city} · {form.phone}
                  </div>
                </div>
                <hr className="my-2 border-dashed border-neutral-300" />
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>2 × Cappuccino</span>
                    <span className="mono">7.000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1 × Croissant</span>
                    <span className="mono">2.800</span>
                  </div>
                </div>
                <hr className="my-2 border-dashed border-neutral-300" />
                <div className="flex justify-between text-[11px] font-extrabold">
                  <span>TOTAL</span>
                  <span>9.800 DT</span>
                </div>
                <div className="mt-2 text-center text-[9.5px] text-neutral-500">
                  {settings.receiptFooter || 'Thank you for your visit!'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="flex flex-wrap items-center justify-between gap-3 border-dashed p-4">
        <div>
          <div className="text-[12.5px] font-semibold text-ink">Demo tools</div>
          <div className="text-[11.5px] text-muted">
            Reset every store and order back to the original sample data.
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
        </Button>
      </Card>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demo data?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDemo()
              }}
            >
              Reset everything
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          This deletes all changes you have made in this browser and signs you out. The demo store
          data will be rebuilt fresh.
        </p>
      </Modal>
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
          ? 'border-accent-500/50 bg-accent-50/50 ring-2 ring-accent-500/15'
          : 'border-line bg-white hover:border-accent-500/30 hover:bg-cream-50',
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            active ? 'bg-accent-600 text-white' : 'bg-cream-100 text-muted',
          )}
        >
          {icon}
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide',
            active ? 'bg-accent-600 text-white' : 'bg-cream-200 text-muted',
          )}
        >
          {badge}
        </span>
      </div>
      <div className="mt-3 text-[13.5px] font-bold text-ink">{title}</div>
      <ul className="mt-2 space-y-1">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-1.5 text-[11px] text-muted">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
            {p}
          </li>
        ))}
      </ul>
      {active && (
        <div className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-accent-600">
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      )}
    </button>
  )
}

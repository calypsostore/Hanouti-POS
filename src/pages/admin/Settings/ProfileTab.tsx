import { Check, Copy, ReceiptText, Sparkles, Store as StoreIcon } from 'lucide-react'
import type { Store, User } from '../../../types'
import { Avatar, Badge, Card, Field, Input } from '../../../components/ui'
import { PLAN_INFO } from '../../../data/seed'
import { fmtDate, money } from '../../../lib/utils'
import { IconPicker } from '../../../components/IconPicker'
import { ImageUpload } from '../../../components/ImageUpload'

type StoreProfile = Pick<Store, 'name' | 'icon' | 'iconColor' | 'logo' | 'phone' | 'address' | 'city' | 'ownerName'>

export default function ProfileTab({
  store,
  user,
  form,
  setForm,
  photo,
  setPhoto,
  copied,
  setCopied,
}: {
  store: Store
  user: User | null
  form: StoreProfile
  setForm: React.Dispatch<React.SetStateAction<StoreProfile>>
  photo?: string
  setPhoto: (photo: string | undefined) => void
  copied: boolean
  setCopied: (copied: boolean) => void
}) {
  const plan = PLAN_INFO[store.plan]

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <div className="mb-4 flex items-center gap-2">
          <StoreIcon className="h-4 w-4 text-accent-foreground" />
          <h3 className="text-[15px] font-semibold tracking-tight">Store details</h3>
        </div>

        <div className="space-y-3.5">
          <div>
            <div>
              <span className="mb-1.5 block text-[12.5px] font-semibold">Store icon</span>
              <IconPicker
                value={form.icon}
                color={form.iconColor}
                onChange={(icon) => setForm((current) => ({ ...current, icon }))}
                onColorChange={(iconColor) => setForm((current) => ({ ...current, iconColor }))}
              />
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Store name" className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
            </Field>
            <Field label="Owner name">
              <Input value={form.ownerName} onChange={(e) => setForm((current) => ({ ...current, ownerName: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))} />
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
              <Sparkles className="h-4 w-4 text-accent-foreground" />
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
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={user?.name ?? store.ownerName} photo={photo} size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold">Profile photo</div>
              <p className="text-[10.5px] text-muted">Shown in the top bar and team list.</p>
            </div>
          </div>
          <ImageUpload value={photo} label="Upload profile photo" onChange={setPhoto} />
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
  )
}

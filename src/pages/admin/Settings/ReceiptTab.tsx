import { Check, Palette, ReceiptText } from 'lucide-react'
import type { Store, StoreSettings } from '../../../types'
import type { PrinterState } from '../../../lib/printer'
import { Card, Field, Textarea } from '../../../components/ui'
import { accentPalettes } from '../../../lib/theme'
import { cn } from '../../../lib/utils'
import PrinterCard from './PrinterCard'

type StoreProfile = Pick<Store, 'name' | 'emoji' | 'phone' | 'address' | 'city' | 'ownerName'>
type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void

export default function ReceiptTab({
  form,
  settings,
  set,
  printer,
  onConnect,
  onDisconnect,
  onTestPrint,
}: {
  form: StoreProfile
  settings: StoreSettings
  set: SettingsSetter
  printer: PrinterState
  onConnect: () => void
  onDisconnect: () => void
  onTestPrint: () => void
}) {
  return (
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
            {accentPalettes.map((palette) => (
              <button
                key={palette.id}
                onClick={() => set('accent', palette.id)}
                className={cn(
                  'group rounded-xl border p-2.5 text-center transition',
                  settings.accent === palette.id
                    ? 'border-espresso-900/20 bg-cream-100 ring-2 ring-espresso-900/10'
                    : 'border-line bg-white hover:bg-cream-100',
                )}
              >
                <span
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: palette.shades[600] }}
                >
                  {settings.accent === palette.id && <Check className="h-4 w-4 text-white" />}
                </span>
                <span className="mt-1.5 block text-[10.5px] font-semibold text-muted">{palette.name}</span>
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
            Receipts print on any 58mm or 80mm thermal printer. Cashier mode offers a receipt
            after every completed sale.
          </div>
        </Card>

        <PrinterCard
          settings={settings}
          set={set}
          printer={printer}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onTestPrint={onTestPrint}
        />
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
  )
}

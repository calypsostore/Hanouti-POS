import { useEffect, useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { useApp } from '../../../store/AppStore'
import type { Store, StoreSettings } from '../../../types'
import { Button, Card, Modal, Segmented } from '../../../components/ui'
import { PrintModal } from '../../../components/PrintPreview'
import { useToast } from '../../../components/toast'
import { DEFAULT_PRINTER } from '../../../lib/defaults'
import { buildTestLines, linesToEscpos } from '../../../lib/escpos'
import { connectPrinter, disconnectPrinter, onPrinterState, printerState as readPrinterState } from '../../../lib/printer'
import type { PrinterState } from '../../../lib/printer'
import ProfileTab from './ProfileTab'
import RegisterTab from './RegisterTab'
import ReceiptTab from './ReceiptTab'

type Tab = 'profile' | 'register' | 'receipt'
type StoreProfile = Pick<Store, 'name' | 'emoji' | 'phone' | 'address' | 'city' | 'ownerName'>
type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void

export default function SettingsPage() {
  const { store, updateStore, updateSettings, resetDemo, user } = useApp()
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>('profile')
  const [resetOpen, setResetOpen] = useState(false)
  const [form, setForm] = useState<StoreProfile>({
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
        printer: { ...DEFAULT_PRINTER },
        features: { tables: false, kitchenScreen: false, barcode: false, weightItems: false },
      },
  )
  const [copied, setCopied] = useState(false)
  const [printer, setPrinter] = useState<PrinterState>(readPrinterState())
  const [testJob, setTestJob] = useState(false)

  useEffect(() => onPrinterState(setPrinter), [])

  if (!store) return null

  const set: SettingsSetter = (key, value) =>
    setSettings((current) => ({ ...current, [key]: value }))

  const save = () => {
    const profileResult = updateStore(store.id, form)
    if (!profileResult.ok) {
      push(profileResult.error, 'error')
      return
    }
    const settingsResult = updateSettings(store.id, settings)
    if (!settingsResult.ok) {
      push(settingsResult.error, 'error')
      return
    }
    push('Settings saved')
  }

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
        <ProfileTab
          store={store}
          user={user}
          form={form}
          setForm={setForm}
          copied={copied}
          setCopied={setCopied}
        />
      )}
      {tab === 'register' && <RegisterTab settings={settings} set={set} />}
      {tab === 'receipt' && (
        <ReceiptTab
          form={form}
          settings={settings}
          set={set}
          printer={printer}
          onConnect={async () => {
            const result = await connectPrinter(settings.printer.baudRate)
            if (result.ok) push(`Printer connected · ${result.label}`, 'success')
            else push(result.error, 'error')
          }}
          onDisconnect={async () => {
            await disconnectPrinter()
            push('Printer disconnected', 'info')
          }}
          onTestPrint={() => setTestJob(true)}
        />
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
            <Button variant="secondary" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                const result = await resetDemo()
                if (!result.ok) {
                  push(result.error, 'error')
                  return
                }
                setResetOpen(false)
                push('Demo data reset', 'info')
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

      <PrintModal
        job={
          testJob
            ? {
                title: 'Printer test',
                subtitle: store.name,
                lines: buildTestLines({ ...store, settings }),
                bytes: linesToEscpos(buildTestLines({ ...store, settings }), settings.printer.width),
                kind: 'receipt',
              }
            : null
        }
        onClose={() => setTestJob(false)}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { useApp } from '../../../store/AppStore'
import type { Store, StoreSettings } from '../../../types'
import { Button, Segmented } from '../../../components/ui'
import { PrintModal } from '../../../components/PrintPreview'
import { useToast } from '../../../components/toast'
import { DEFAULT_PAYROLL_SETTINGS, DEFAULT_PRINTER } from '../../../lib/defaults'
import { buildTestLines, linesToEscpos } from '../../../lib/escpos'
import { connectPrinter, disconnectPrinter, onPrinterState, printerState as readPrinterState } from '../../../lib/printer'
import type { PrinterState } from '../../../lib/printer'
import BrandingTab from './BrandingTab'
import ProfileTab from './ProfileTab'
import RegisterTab from './RegisterTab'
import ReceiptTab from './ReceiptTab'
import TablesTab from './TablesTab'
import DataTab from './DataTab'

type Tab = 'profile' | 'branding' | 'register' | 'receipt' | 'tables' | 'data'
type StoreProfile = Pick<Store, 'name' | 'icon' | 'iconColor' | 'logo' | 'phone' | 'address' | 'city' | 'ownerName'>
type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void

export default function SettingsPage() {
  const { db, store, updateStore, updateSettings, updateStaff, user } = useApp()
  const [searchParams] = useSearchParams()
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>(() => searchParams.get('tab') === 'tables' ? 'tables' : 'profile')
  const [form, setForm] = useState<StoreProfile>({
    name: store?.name ?? '',
    icon: store?.icon ?? 'Coffee',
    iconColor: store?.iconColor ?? 'amber',
    logo: store?.logo,
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
        accent: '7anouti',
        colorMode: 'light',
        printer: { ...DEFAULT_PRINTER },
        features: { tables: false, delivery: false, kitchenScreen: false, barcode: false, weightItems: false },
        payroll: { ...DEFAULT_PAYROLL_SETTINGS },
      },
  )
  const [ownerPhoto, setOwnerPhoto] = useState(user?.photo)
  const [copied, setCopied] = useState(false)
  const [printer, setPrinter] = useState<PrinterState>(readPrinterState())
  const [testJob, setTestJob] = useState(false)

  useEffect(() => onPrinterState(setPrinter), [])

  if (!store) return null

  const set: SettingsSetter = (key, value) =>
    setSettings((current) => ({ ...current, [key]: value }))

  const save = async () => {
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
    if (user && user.photo !== ownerPhoto) {
      const photoResult = await updateStaff(user.id, { photo: ownerPhoto })
      if (!photoResult.ok) {
        push(photoResult.error, 'error')
        return
      }
    }
    push('Settings saved')
  }

  const enableExistingTables = () => {
    if (!store) return
    const nextSettings = {
      ...settings,
      features: { ...settings.features, tables: true },
    }
    const result = updateSettings(store.id, nextSettings)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    setSettings(nextSettings)
    push('Table service enabled')
  }
  const hasTablesHidden =
    !!store &&
    !settings.features.tables &&
    db.tables.some((table) => table.storeId === store.id)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Settings</h2>
          <p className="mt-1 text-[13px] text-muted">
            Shape how the register works for {store.name}.
          </p>
        </div>
        {tab !== 'data' && <Button onClick={save}>
          <Save className="h-4 w-4" /> Save changes
        </Button>}
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'profile', label: 'Store profile' },
          { value: 'branding', label: 'Branding' },
          { value: 'register', label: 'Register & checkout' },
          { value: 'receipt', label: 'Receipt' },
          ...(settings.features.tables ? [{ value: 'tables' as const, label: 'Tables' }] : []),
          ...(user?.role === 'admin' ? [{ value: 'data' as const, label: 'Data' }] : []),
        ]}
      />

      {tab === 'profile' && (
        <ProfileTab
          store={store}
          user={user}
          form={form}
          setForm={setForm}
          photo={ownerPhoto}
          setPhoto={setOwnerPhoto}
          copied={copied}
          setCopied={setCopied}
        />
      )}
      {tab === 'branding' && (
        <BrandingTab form={form} setForm={setForm} settings={settings} set={set} />
      )}
      {tab === 'register' && (
        <RegisterTab
          settings={settings}
          set={set}
          hasTablesHidden={hasTablesHidden}
          onEnableTables={enableExistingTables}
        />
      )}
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
      {tab === 'tables' && settings.features.tables && <TablesTab storeId={store.id} />}
      {tab === 'data' && user?.role === 'admin' && <DataTab />}

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

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { useApp } from '../../../store/AppStore'
import type { Store, StoreSettings } from '../../../types'
import { Button, Segmented } from '../../../components/ui'
import { PrintModal } from '../../../components/PrintPreview'
import { useToast } from '../../../components/toast'
import { DEFAULT_AVAILABILITY_SETTINGS, DEFAULT_ORDER_RULES, DEFAULT_PAYROLL_SETTINGS, DEFAULT_PRINTER } from '../../../lib/defaults'
import { buildTestLines, linesToEscpos } from '../../../lib/escpos'
import { connectPrinter, disconnectPrinter, onPrinterState, printerState as readPrinterState } from '../../../lib/printer'
import type { PrinterState } from '../../../lib/printer'
import BrandingTab from './BrandingTab'
import ProfileTab from './ProfileTab'
import RegisterTab from './RegisterTab'
import ReceiptTab from './ReceiptTab'
import TablesTab from './TablesTab'
import DataTab from './DataTab'
import StationsTab from './StationsTab'
import ServiceTab from './ServiceTab'
import DevicesTab from './DevicesTab'
import AutomationTab from './AutomationTab'
import { readDeviceReceiptPolicy, saveDeviceReceiptPolicy } from '../../../lib/printPreferences'

type Tab = 'profile' | 'branding' | 'register' | 'receipt' | 'tables' | 'stations' | 'service' | 'devices' | 'automation' | 'data'
type StoreProfile = Pick<Store, 'name' | 'icon' | 'iconColor' | 'logo' | 'phone' | 'address' | 'city' | 'ownerName'>
export type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void

export default function SettingsPage() {
  const { db, store, updateStore, updateSettings, updateStaff, user } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>(() => {
    const requested = searchParams.get('tab')
    return requested === 'tables' || requested === 'stations' || requested === 'service' || requested === 'devices' || requested === 'automation'
      ? requested
      : 'profile'
  })
  const requestedTab = searchParams.get('tab')
  const activeTab: Tab = requestedTab === 'tables' || requestedTab === 'stations' ||
    requestedTab === 'service' || requestedTab === 'devices' || requestedTab === 'automation'
    ? requestedTab
    : tab
  const changeTab = (next: Tab) => {
    setTab(next)
    setSearchParams(next === 'profile' ? {} : { tab: next })
  }
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
        tableMode: 'sections_tables',
        guestRequirement: 'required',
        staffPickSectionsOnShift: false,
        requireShiftForOrders: true,
        accent: '7anouti',
        colorMode: 'system',
        printer: { ...DEFAULT_PRINTER },
        features: { tables: false, delivery: false, kitchenScreen: false, barcode: false, weightItems: false },
        payroll: { ...DEFAULT_PAYROLL_SETTINGS },
        ticketSendPolicy: 'done_or_idle',
        ticketDelaySeconds: 10,
        ticketIdleSeconds: 20,
        stationTimerMinutes: 15,
        receiptPrintPolicy: 'ask',
        stationTicketPrintPolicy: 'automatic',
        reportPrintPolicy: 'manual',
        automation: {
          drawerKickOnCash: true, autoLockMinutes: 5, autoLogoutMinutes: 720,
          shiftReminders: true, shiftReminderHours: 8, maxShiftHours: 12, cashDifferenceTolerance: 0,
          warnAboutOpenTablesAtShiftClose: true, lowStockAlerts: true, hideOutOfStock: false,
          retryPrintJobs: true, fallbackPrintJobs: true, printerRetryLimit: 5,
          autoReconnectPrinters: true, printerOfflineAlerts: true,
          printerOfflineAlertMinutes: 5, backupHealthAlerts: true,
        },
        availability: { ...DEFAULT_AVAILABILITY_SETTINGS, reasons: [...DEFAULT_AVAILABILITY_SETTINGS.reasons] },
        orderRules: { ...DEFAULT_ORDER_RULES, stockOverrideRoles: { ...DEFAULT_ORDER_RULES.stockOverrideRoles } },
      },
  )
  const [ownerPhoto, setOwnerPhoto] = useState(user?.photo)
  const [deviceReceiptPolicyState, setDeviceReceiptPolicyState] = useState<{
    storeId: string
    value: StoreSettings['receiptPrintPolicy']
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [printer, setPrinter] = useState<PrinterState>(readPrinterState())
  const [testJob, setTestJob] = useState(false)

  useEffect(() => onPrinterState(setPrinter), [])

  if (!store) return null

  const set: SettingsSetter = (key, value) =>
    setSettings((current) => ({ ...current, [key]: value }))
  const deviceReceiptPolicy = deviceReceiptPolicyState?.storeId === store?.id
    ? deviceReceiptPolicyState.value
    : store
      ? readDeviceReceiptPolicy(store.id, settings.receiptPrintPolicy)
      : 'ask'
  const changeDeviceReceiptPolicy = (value: StoreSettings['receiptPrintPolicy']) => {
    if (!store) return
    try {
      saveDeviceReceiptPolicy(store.id, value)
      setDeviceReceiptPolicyState({ storeId: store.id, value })
      push('This device receipt policy saved', 'success')
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not save this device receipt policy.', 'error')
    }
  }

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
        {activeTab !== 'data' && <Button onClick={save}>
          <Save className="h-4 w-4" /> Save changes
        </Button>}
      </div>

      <div className="min-w-0 max-w-full overflow-x-auto">
        <Segmented
          value={activeTab}
          onChange={(value) => changeTab(value as Tab)}
          className="w-max whitespace-nowrap"
          options={[
            { value: 'profile', label: 'Store profile' },
            { value: 'branding', label: 'Branding' },
            { value: 'register', label: 'Register & checkout' },
            { value: 'receipt', label: 'Receipt' },
            { value: 'tables' as const, label: 'Tables' },
            { value: 'stations' as const, label: 'Stations' },
            { value: 'service' as const, label: 'Service' },
            { value: 'devices' as const, label: 'Devices & printing' },
            { value: 'automation' as const, label: 'Automation' },
            ...(user?.role === 'admin' ? [{ value: 'data' as const, label: 'Data' }] : []),
          ]}
        />
      </div>

      {activeTab === 'profile' && (
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
      {activeTab === 'branding' && (
        <BrandingTab form={form} setForm={setForm} settings={settings} set={set} />
      )}
      {activeTab === 'register' && (
        <RegisterTab
          settings={settings}
          set={set}
          hasTablesHidden={hasTablesHidden}
          onEnableTables={enableExistingTables}
        />
      )}
      {activeTab === 'receipt' && (
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
      {activeTab === 'tables' && <TablesTab storeId={store.id} settings={settings} set={set} />}
      {activeTab === 'stations' && <StationsTab storeId={store.id} />}
      {activeTab === 'service' && <ServiceTab settings={settings} set={set} />}
      {activeTab === 'devices' && <DevicesTab storeId={store.id} />}
      {activeTab === 'automation' && <AutomationTab
        settings={settings}
        set={set}
        receiptPolicy={deviceReceiptPolicy}
        onReceiptPolicyChange={changeDeviceReceiptPolicy}
      />}
      {activeTab === 'data' && user?.role === 'admin' && <DataTab />}

      <PrintModal
        job={
          testJob
            ? {
                title: 'Printer test',
                subtitle: store.name,
                lines: buildTestLines({ ...store, settings }),
                bytes: linesToEscpos(buildTestLines({ ...store, settings }), settings.printer.width),
                kind: 'test',
              }
            : null
        }
        onClose={() => setTestJob(false)}
      />
    </div>
  )
}

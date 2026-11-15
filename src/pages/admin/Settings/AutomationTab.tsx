import { Card, Field, Input, Select, Toggle } from '../../../components/ui'
import type { StoreSettings } from '../../../types'
import type { SettingsSetter } from './SettingsPage'

export default function AutomationTab({
  settings,
  set,
  receiptPolicy,
  onReceiptPolicyChange,
}: {
  settings: StoreSettings
  set: SettingsSetter
  receiptPolicy: StoreSettings['receiptPrintPolicy']
  onReceiptPolicyChange: (value: StoreSettings['receiptPrintPolicy']) => void
}) {
  const automation = settings.automation
  const update = (patch: Partial<StoreSettings['automation']>) =>
    set('automation', { ...automation, ...patch })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-bold">Orders</h3>
          <p className="mt-1 text-xs text-muted">Reduce taps after payment and keep order flow predictable.</p>
        </div>
        <Field label="Receipt after payment">
          <Select
            value={receiptPolicy}
            onChange={(event) => onReceiptPolicyChange(event.target.value as StoreSettings['receiptPrintPolicy'])}
          >
            <option value="auto">Automatically print</option>
            <option value="ask">Ask each time</option>
            <option value="never">Never print automatically</option>
          </Select>
        </Field>
        <Field label="Station tickets">
          <Select
            value={settings.stationTicketPrintPolicy}
            onChange={(event) => set('stationTicketPrintPolicy', event.target.value as StoreSettings['stationTicketPrintPolicy'])}
          >
            <option value="automatic">Automatically print</option>
            <option value="manual">Ask / preview</option>
            <option value="never">Never print</option>
          </Select>
        </Field>
        <Toggle
          checked={automation.drawerKickOnCash}
          onChange={(value) => update({ drawerKickOnCash: value })}
          label="Kick the drawer for cash payments"
          description="Only works with a routed printer configured for cash drawer kick."
        />
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-bold">Printing</h3>
          <p className="mt-1 text-xs text-muted">Retry transient failures and alert when a hub printer stays offline.</p>
        </div>
        <Toggle
          checked={automation.retryPrintJobs}
          onChange={(value) => update({ retryPrintJobs: value })}
          label="Retry failed print jobs automatically"
          description="Retries are limited; the print queue keeps every failure visible."
        />
        <Toggle
          checked={automation.fallbackPrintJobs}
          onChange={(value) => update({ fallbackPrintJobs: value })}
          label="Try the fallback printer after failure"
          description="A configured fallback is attempted once before automatic retries continue."
        />
        <Toggle
          checked={automation.autoReconnectPrinters}
          onChange={(value) => update({ autoReconnectPrinters: value })}
          label="Reconnect authorized USB printers"
          description="Checks previously authorized WebSerial ports while the POS is open."
        />
        <Toggle
          checked={automation.printerOfflineAlerts}
          onChange={(value) => update({ printerOfflineAlerts: value })}
          label="Show printer offline alerts"
          description="Hub alerts start after a print failure is observed; idle printers are not actively probed."
        />
        <Field label="Maximum attempts on primary printer">
          <Input type="number" min={1} max={10} value={automation.printerRetryLimit}
            onChange={(event) => update({ printerRetryLimit: Number(event.target.value) || 1 })} />
        </Field>
        <Field label="Offline alert after (minutes)">
          <Input type="number" min={1} max={1440} value={automation.printerOfflineAlertMinutes}
            onChange={(event) => update({ printerOfflineAlertMinutes: Number(event.target.value) || 1 })} />
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-bold">Security</h3>
          <p className="mt-1 text-xs text-muted">Locking preserves the current cart and does not end attendance.</p>
        </div>
        <Field label="Lock after inactivity (minutes)" hint="0 disables">
          <Input type="number" min={0} max={120} value={automation.autoLockMinutes}
            onChange={(event) => update({ autoLockMinutes: Number(event.target.value) || 0 })} />
        </Field>
        <Field label="Log out after inactivity (minutes)" hint="0 disables">
          <Input type="number" min={0} max={10080} value={automation.autoLogoutMinutes}
            onChange={(event) => update({ autoLogoutMinutes: Number(event.target.value) || 0 })} />
        </Field>
        <p className="text-[11px] text-muted">Set logout to a longer duration than the lock. Unlock requires the current account PIN.</p>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-bold">Stock</h3>
          <p className="mt-1 text-xs text-muted">Use tracked product stock to keep alerts current after sales.</p>
        </div>
        <Toggle checked={automation.lowStockAlerts} onChange={(value) => update({ lowStockAlerts: value })}
          label="Low-stock alerts" description="Show low and out-of-stock items in the notification bell and dashboard." />
        <Toggle checked={automation.hideOutOfStock} onChange={(value) => update({ hideOutOfStock: value })}
          label="Hide out-of-stock items in POS" description="Products return automatically when stock is replenished." />
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-bold">Shifts</h3>
          <p className="mt-1 text-xs text-muted">Remind staff about shift setup and long-running shifts.</p>
        </div>
        <Toggle checked={settings.requireShiftForOrders}
          onChange={(value) => set('requireShiftForOrders', value)}
          label="Require an open shift to take orders" />
        <Toggle checked={automation.shiftReminders}
          onChange={(value) => update({ shiftReminders: value })}
          label="Show long-shift reminder" />
        <Field label="Remind to close shift after (hours)">
          <Input type="number" min={1} max={24} value={automation.shiftReminderHours}
            onChange={(event) => update({ shiftReminderHours: Number(event.target.value) || 1 })} />
        </Field>
        <Toggle checked={automation.warnAboutOpenTablesAtShiftClose}
          onChange={(value) => update({ warnAboutOpenTablesAtShiftClose: value })}
          label="Warn before closing with open table orders" />
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-bold">Hub health</h3>
          <p className="mt-1 text-xs text-muted">Show an admin alert when a recent hub backup cannot be confirmed.</p>
        </div>
        <Toggle checked={automation.backupHealthAlerts} onChange={(value) => update({ backupHealthAlerts: value })}
          label="Alert when backup is older than 48 hours" />
      </Card>
    </div>
  )
}

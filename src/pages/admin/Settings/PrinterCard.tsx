import { Cable, Printer } from 'lucide-react'
import type { StoreSettings } from '../../../types'
import type { PrinterState } from '../../../lib/printer'
import { Badge, Button, Card, Field, Input, Segmented, Toggle } from '../../../components/ui'
import { columnsFor } from '../../../lib/escpos'

type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void

export default function PrinterCard({
  settings,
  set,
  printer,
  onConnect,
  onDisconnect,
  onTestPrint,
}: {
  settings: StoreSettings
  set: SettingsSetter
  printer: PrinterState
  onConnect: () => void
  onDisconnect: () => void
  onTestPrint: () => void
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Printer className="h-4 w-4 text-accent-foreground" />
          <h3 className="text-[15px] font-semibold tracking-tight">Legacy WebSerial connection</h3>
        </div>
        <Badge tone={printer.connected ? 'success' : 'neutral'}>
          {printer.connected ? `Connected · ${printer.label}` : 'Not connected'}
        </Badge>
      </div>

      <div className="mt-4 space-y-3.5">
        <Toggle
          checked={settings.printer.enabled}
          onChange={(value) => set('printer', { ...settings.printer, enabled: value })}
          label="Enable receipt printing"
          description="Print receipts after checkout and reprint from Orders."
        />

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold">Paper width</span>
            <Segmented
              value={String(settings.printer.width)}
              onChange={(value) => set('printer', { ...settings.printer, width: value === '58' ? 58 : 80 })}
              size="sm"
              options={[
                { value: '58', label: '58 mm' },
                { value: '80', label: '80 mm' },
              ]}
            />
            <p className="mt-1 text-[10.5px] text-muted">
              {columnsFor(settings.printer.width)} characters per line
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold">Automatic print policy</p>
            <p className="text-[11px] leading-relaxed text-muted">
              Receipt, station-ticket and report policies are managed in Settings → Devices & printing.
            </p>
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold">Connection</span>
            <Segmented
              value={settings.printer.connection}
              onChange={(value) => set('printer', { ...settings.printer, connection: value as 'webserial' | 'browser' })}
              size="sm"
              options={[
                { value: 'webserial', label: 'USB / WebSerial' },
                { value: 'browser', label: 'Browser only' },
              ]}
            />
          </div>
          <Field label="Baud rate" hint="Leave 9600 unless your printer says otherwise">
            <Input
              type="number"
              className="tabular"
              value={String(settings.printer.baudRate)}
              onChange={(e) => set('printer', { ...settings.printer, baudRate: Number(e.target.value) || 9600 })}
            />
          </Field>
        </div>

        {settings.printer.connection === 'webserial' && (
          <div className="flex flex-wrap items-center gap-2">
            {printer.connected ? (
              <Button variant="secondary" size="sm" onClick={onDisconnect}>
                Disconnect printer
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={onConnect}>
                <Cable className="h-3.5 w-3.5" /> Connect printer
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onTestPrint}>
              <Printer className="h-3.5 w-3.5" /> Test print
            </Button>
          </div>
        )}

        <Toggle
          checked={settings.printer.kitchenTicket}
          onChange={(value) => set('printer', { ...settings.printer, kitchenTicket: value })}
          label="Kitchen tickets"
          description="Print a separate item list for the kitchen on dine-in orders."
        />

        <div className="rounded-xl bg-cream-100 px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
          <span className="font-semibold text-ink">Compatibility: </span>
          USB printers print real ESC/POS bytes through WebSerial — supported on Chrome and
          Edge for desktop (Windows, macOS, Linux). Firefox, Safari and iOS do not support
          WebSerial; those browsers use the browser print dialog with the same layout.
          Arabic characters are not printable on most ESC/POS printers — receipts fall back
          to Latin text.
        </div>
      </div>
    </Card>
  )
}

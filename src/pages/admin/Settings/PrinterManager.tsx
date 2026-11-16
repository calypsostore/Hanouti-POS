import { Capacitor } from '@capacitor/core'
import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { PrintCodepage, PrintConnection, Printer } from '../../../types'
import { Button, Card, Field, Input, Select, Toggle } from '../../../components/ui'
import { isWebSerialSupported } from '../../../lib/printer'
import type { PrinterInput } from '../../../store/types'

const makeEmptyPrinter = (): PrinterInput => ({
  name: '',
  connection: 'browser-print',
  port: 9100,
  baudRate: 9600,
  paperWidth: 80,
  codepage: 'cp1252',
  cutMode: 'partial',
  openDrawerOnCash: false,
  copies: 1,
  enabled: true,
})

export default function PrinterManager({
  printers,
  onAdd,
  onUpdate,
  onDelete,
}: {
  printers: Printer[]
  onAdd: (input: PrinterInput) => void
  onUpdate: (id: string, patch: Partial<PrinterInput>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState<Printer | undefined>()
  const [form, setForm] = useState<PrinterInput>(makeEmptyPrinter)
  const set = <K extends keyof PrinterInput>(key: K, value: PrinterInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }))
  const reset = () => {
    setEditing(undefined)
    setForm(makeEmptyPrinter())
  }
  const save = () => {
    if (editing) onUpdate(editing.id, form)
    else onAdd(form)
    reset()
  }
  const edit = (printer: Printer) => {
    setEditing(printer)
    setForm({
      name: printer.name,
      connection: printer.connection,
      host: printer.host,
      port: printer.port,
      osPrinterName: printer.osPrinterName,
      baudRate: printer.baudRate,
      paperWidth: printer.paperWidth,
      codepage: printer.codepage,
      cutMode: printer.cutMode,
      openDrawerOnCash: printer.openDrawerOnCash,
      copies: printer.copies,
      enabled: printer.enabled,
      fallbackPrinterId: printer.fallbackPrinterId,
    })
  }
  const isNativePlatform = Capacitor.isNativePlatform()
  const connectionOptions: Array<{ value: PrintConnection; label: string }> = [
    { value: 'browser-print', label: 'Browser print dialog' },
    ...(isWebSerialSupported() ? [{ value: 'browser-webserial' as const, label: 'This device · WebSerial' }] : []),
    ...(isNativePlatform ? [{ value: 'hub-tcp' as const, label: 'LAN TCP printer' }] : []),
  ]
  const supportsHub = printers.some((printer) => printer.connection.startsWith('hub-'))
  if (supportsHub) {
    connectionOptions.push(
      ...(!isNativePlatform ? [{ value: 'hub-tcp' as const, label: 'Shop hub · TCP' }] : []),
      { value: 'hub-usb', label: 'Shop hub · USB' },
      { value: 'hub-serial', label: 'Shop hub · Serial' },
      { value: 'hub-epson-epos', label: 'Shop hub · Epson ePOS' },
      { value: 'hub-star', label: 'Shop hub · Star' },
    )
  }
  return (
    <Card className="space-y-4 p-4">
      <div>
        <h3 className="font-bold text-ink">Printers</h3>
        <p className="mt-1 text-xs text-muted">Configure receipt and station-ticket destinations. Hub options remain unavailable until M3.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={form.name} onChange={(event) => set('name', event.target.value)} maxLength={100} placeholder="Front counter" />
        </Field>
        <Field label="Connection">
          <Select value={form.connection} onChange={(event) => set('connection', event.target.value as PrintConnection)}>
            {connectionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </Field>
        {(form.connection.startsWith('hub-')) && (
          <>
            <Field label="Host"><Input value={form.host ?? ''} onChange={(event) => set('host', event.target.value)} placeholder="192.168.1.20" /></Field>
            <Field label="Port"><Input type="number" min={1} max={65535} value={form.port} onChange={(event) => set('port', Number(event.target.value))} /></Field>
          </>
        )}
        {form.connection === 'browser-print' && (
          <Field label="Operating-system printer name" hint="Informational only; the browser selects the destination">
            <Input value={form.osPrinterName ?? ''} onChange={(event) => set('osPrinterName', event.target.value)} maxLength={120} />
          </Field>
        )}
        {form.connection === 'browser-webserial' && (
          <Field label="Baud rate">
            <Select value={form.baudRate} onChange={(event) => set('baudRate', Number(event.target.value))}>
              {[9600, 19200, 38400, 57600, 115200].map((rate) => <option key={rate} value={rate}>{rate}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Paper width">
          <Select value={form.paperWidth} onChange={(event) => set('paperWidth', Number(event.target.value) as 58 | 80)}>
            <option value={58}>58 mm</option><option value={80}>80 mm</option>
          </Select>
        </Field>
        <Field label="Codepage">
          <Select value={form.codepage} onChange={(event) => set('codepage', event.target.value as PrintCodepage)}>
            <option value="cp1252">Windows-1252</option><option value="cp437">PC437</option>
            <option value="cp850">PC850</option><option value="cp858">PC858</option>
          </Select>
        </Field>
        <Field label="Paper cut">
          <Select value={form.cutMode} onChange={(event) => set('cutMode', event.target.value as PrinterInput['cutMode'])}>
            <option value="partial">Partial cut</option><option value="full">Full cut</option><option value="none">No cut</option>
          </Select>
        </Field>
        <Field label="Copies"><Input type="number" min={1} max={10} value={form.copies} onChange={(event) => set('copies', Number(event.target.value))} /></Field>
        <Field label="Fallback printer">
          <Select value={form.fallbackPrinterId ?? ''} onChange={(event) => set('fallbackPrinterId', event.target.value || undefined)}>
            <option value="">No fallback</option>
            {printers.filter((printer) => printer.enabled && printer.id !== editing?.id).map((printer) =>
              <option key={printer.id} value={printer.id}>{printer.name}</option>,
            )}
          </Select>
        </Field>
      </div>
      <Toggle checked={form.openDrawerOnCash} onChange={(checked) => set('openDrawerOnCash', checked)} label="Kick cash drawer after cash payment" />
      <Toggle checked={form.enabled} onChange={(checked) => set('enabled', checked)} label="Printer enabled" />
      <div className="flex justify-end gap-2">
        {editing && <Button variant="secondary" onClick={reset}>Cancel</Button>}
        <Button onClick={save} disabled={!form.name.trim()}>
          {editing ? 'Save printer' : <><Plus className="h-4 w-4" /> Add printer</>}
        </Button>
      </div>
      <div className="divide-y divide-line/60 rounded-xl border border-line">
        {printers.map((printer) => (
          <div key={printer.id} className="flex flex-wrap items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{printer.name}</p>
              <p className="text-xs text-muted">{printer.connection} · {printer.paperWidth} mm · {printer.enabled ? 'enabled' : 'disabled'}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label={`Edit ${printer.name}`} onClick={() => edit(printer)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label={`Remove ${printer.name}`} onClick={() => onDelete(printer.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {!printers.length && <p className="p-3 text-xs text-muted">No printers configured. Station tickets stay available in preview.</p>}
      </div>
    </Card>
  )
}

import { useEffect, useState } from 'react'
import { Cable, Printer, RefreshCw, X } from 'lucide-react'
import type { DevicePrintPreference, PrintJobType } from '../../../types'
import { Button, Card, Field, Select } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { useApp } from '../../../store/AppStore'
import { readDevicePrintPreference, saveDevicePrintPreference } from '../../../lib/printPreferences'
import PrinterManager from './PrinterManager'
import { buildTestLines } from '../../../lib/escpos'
import { connectPrinter, disconnectPrinter, onPrinterState, printerState as readPrinterState, type PrinterState } from '../../../lib/printer'

const routeTypes: Array<{ type: PrintJobType; label: string }> = [
  { type: 'receipt', label: 'Receipt' },
  { type: 'report', label: 'X/Z report' },
  { type: 'label', label: 'Label' },
]

export default function DevicesTab({
  storeId,
}: {
  storeId: string
}) {
  const {
    db, addPrinter, updatePrinter, deletePrinter, setPrintRoute, updateStation,
    enqueuePrint, retryPrintJob, cancelPrintJob, user, store,
  } = useApp()
  const { push } = useToast()
  const printers = db.printers.filter((printer) => printer.storeId === storeId)
  const enabledPrinters = printers.filter((printer) => printer.enabled)
  const stations = db.stations.filter((station) => station.storeId === storeId && station.active)
  const jobs = db.printJobs.filter((job) => job.storeId === storeId).slice().reverse()
  const [filter, setFilter] = useState('all')
  const [preference, setPreference] = useState<DevicePrintPreference>(readDevicePrintPreference)
  const [busy, setBusy] = useState(false)
  const [testPrinterId, setTestPrinterId] = useState('')
  const [printerConnectionState, setPrinterConnectionState] = useState<PrinterState>(readPrinterState())
  const testTarget = enabledPrinters.find((printer) => printer.id === testPrinterId) ??
    (enabledPrinters.length === 1 ? enabledPrinters[0] : undefined)

  useEffect(() => onPrinterState(setPrinterConnectionState), [])

  const notify = (result: { ok: boolean; error?: string }, success: string) => {
    if (!result.ok) push(result.error ?? 'The print setting could not be saved.', 'error')
    else push(success, 'success')
  }
  const savePreference = (value: DevicePrintPreference) => {
    try {
      saveDevicePrintPreference(value)
      setPreference(value)
      push('This device print preference saved', 'success')
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not save this device preference.', 'error')
    }
  }
  const runTest = async (printerId?: string) => {
    if (!store || !user) return
    setBusy(true)
    const result = await enqueuePrint({
      type: 'test',
      printerId,
      payload: buildTestLines(store),
    })
    setBusy(false)
    notify(result, 'Test print queued')
  }
  const connectSelectedPrinter = async () => {
    if (!testTarget) return
    const result = await connectPrinter(testTarget.baudRate)
    if (result.ok) push(`Printer connected · ${result.label}`, 'success')
    else push(result.error, 'error')
  }
  const reprint = async (jobId: string) => {
    const job = db.printJobs.find((entry) => entry.id === jobId)
    if (!job) return
    const result = await enqueuePrint({
      type: job.type,
      stationId: job.stationId,
      payload: job.payload,
      openDrawer: job.openDrawer,
    })
    notify(result, result.ok ? 'Reprint sent' : 'Reprint failed')
  }

  return (
    <div className="space-y-5">
      <PrinterManager
        printers={printers}
        onAdd={(input) => notify(addPrinter(storeId, input), 'Printer added')}
        onUpdate={(id, patch) => notify(updatePrinter(id, patch), 'Printer updated')}
        onDelete={(id) => {
          const hasHistory = db.printJobs.some((job) => job.printerId === id)
          notify(deletePrinter(id), hasHistory ? 'Printer archived; print history retained' : 'Printer deleted')
        }}
      />

      <Card className="space-y-4 p-4">
        <div>
          <h3 className="font-bold text-ink">Print routing</h3>
          <p className="mt-1 text-xs text-muted">Routes are saved per store. A station without a printer keeps its ticket on screen.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {routeTypes.map(({ type, label }) => (
            <Field key={type} label={label}>
              <Select
                value={db.printRoutes.find((route) =>
                  route.storeId === storeId && route.type === type && route.stationId === undefined,
                )?.printerId ?? ''}
                onChange={(event) => notify(setPrintRoute(storeId, type, undefined, event.target.value || undefined), `${label} route saved`)}
              >
                <option value="">No printer / preview</option>
                {printers.filter((printer) => printer.enabled).map((printer) => (
                  <option key={printer.id} value={printer.id}>{printer.name}</option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
        {stations.map((station) => (
          <Field key={station.id} label={`${station.name} tickets`}>
            <Select
              value={db.printRoutes.find((route) =>
                route.storeId === storeId && route.type === 'kitchen' && route.stationId === station.id,
              )?.printerId ?? station.printerId ?? ''}
              onChange={(event) => {
                const printerId = event.target.value || undefined
                const routeResult = setPrintRoute(storeId, 'kitchen', station.id, printerId)
                if (!routeResult.ok) return notify(routeResult, 'Route saved')
                const stationResult = updateStation(station.id, { printerId })
                notify(stationResult, `${station.name} route saved`)
              }}
            >
              <option value="">Screen only / preview</option>
              {printers.filter((printer) => printer.enabled).map((printer) => (
                <option key={printer.id} value={printer.id}>{printer.name}</option>
              ))}
            </Select>
          </Field>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="This device prints via">
            <Select value={preference} onChange={(event) => savePreference(event.target.value as DevicePrintPreference)}>
              <option value="hub">Shop hub (not connected yet)</option>
              <option value="this-device">Configured printer on this device</option>
              <option value="browser">Browser print dialog</option>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Select value={testPrinterId || (enabledPrinters.length === 1 ? enabledPrinters[0].id : '')} onChange={(event) => setTestPrinterId(event.target.value)} aria-label="Test printer">
              <option value="">Default route</option>
              {enabledPrinters.map((printer) =>
                <option key={printer.id} value={printer.id}>{printer.name}</option>,
              )}
            </Select>
            {testTarget?.connection === 'browser-webserial' && (
              printerConnectionState.connected
                ? <Button variant="secondary" onClick={() => void disconnectPrinter()}>Disconnect</Button>
                : <Button variant="secondary" onClick={() => void connectSelectedPrinter()}><Cable className="h-4 w-4" /> Connect</Button>
            )}
            <Button variant="secondary" disabled={busy || !enabledPrinters.length} onClick={() => void runTest(testTarget?.id)}>
              <Printer className="h-4 w-4" /> Test print
            </Button>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-ink">Print jobs</h3>
            <p className="mt-1 text-xs text-muted">Persisted queue, retry and reprint history.</p>
          </div>
          <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="w-40">
            <option value="all">All statuses</option>
            {['queued', 'sending', 'printed', 'failed', 'cancelled'].map((status) =>
              <option key={status} value={status}>{status}</option>,
            )}
          </Select>
        </div>
        <div className="divide-y divide-line/60">
          {jobs.filter((job) => filter === 'all' || job.status === filter).map((job) => (
            <div key={job.id} className="flex flex-wrap items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{job.type} · {printers.find((printer) => printer.id === job.printerId)?.name ?? 'Removed printer'}</p>
                <p className="text-xs text-muted">{new Date(job.createdAt).toLocaleString()} · {job.status} · {job.attempts} attempt(s)</p>
                {job.lastError && <p className="mt-1 text-xs text-danger">{job.lastError}</p>}
              </div>
              {(job.status === 'failed' || job.status === 'queued') && (
                <Button size="sm" variant="secondary" onClick={() => void retryPrintJob(job.id).then((result) => notify(result, 'Print retry completed'))}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              )}
              {job.status !== 'cancelled' && (
                <Button size="icon" variant="ghost" aria-label="Reprint job" onClick={() => void reprint(job.id)}>
                  <Printer className="h-4 w-4" />
                </Button>
              )}
              {(job.status === 'failed' || job.status === 'queued') && (
                <Button size="icon" variant="ghost" aria-label="Cancel print job" onClick={() => notify(cancelPrintJob(job.id), 'Print job cancelled')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {!jobs.length && <p className="py-3 text-xs text-muted">No print jobs have been created.</p>}
        </div>
      </Card>
    </div>
  )
}

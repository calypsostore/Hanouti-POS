import { Activity, CircleCheck, CircleOff, HardDrive, Wifi } from 'lucide-react'
import { Badge, Card } from '../../../components/ui'
import type { ProviderMode, ProviderStatus } from '../../../store/providers/DataProvider'
import type { Printer } from '../../../types'

function formatTime(value: string | undefined): string {
  return value ? value.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC').replace(/Z$/, ' UTC') : 'Never'
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-cream-50 p-3 dark:bg-espresso-900/60">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 break-words text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  )
}

export default function ConnectivityTab({
  mode,
  status,
  printers,
}: {
  mode: ProviderMode
  status: ProviderStatus
  printers: Pick<Printer, 'id' | 'name'>[]
}) {
  const isHub = mode === 'hub'
  const title = !isHub
    ? 'Local device only'
    : status.connection === 'connected'
      ? 'Hub connected'
      : status.connection === 'internet-offline'
        ? 'Hub reachable · internet offline'
        : 'Hub offline · working locally'
  const tone = !isHub
    ? 'neutral'
    : status.connection === 'connected'
      ? 'success'
      : status.connection === 'internet-offline'
        ? 'warning'
        : 'danger'
  const StatusIcon = !isHub
    ? HardDrive
    : status.connection === 'connected'
      ? CircleCheck
      : status.connection === 'internet-offline'
        ? Wifi
        : CircleOff
  const printerStatuses = Object.entries(status.printerStatuses)

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-100 text-ink dark:bg-espresso-700">
              <StatusIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-ink">Connectivity</h3>
              <p className="mt-1 text-[12px] text-muted">
                {isHub
                  ? 'Hub sync and print delivery status for this device.'
                  : 'This browser stores data locally; it is not connected to a shop hub.'}
              </p>
            </div>
          </div>
          <Badge tone={tone}>{title}</Badge>
        </div>

        {isHub && status.lastError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900">
            <strong>Latest issue:</strong> {status.lastError}
          </div>
        )}

        <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <Detail label="Mode" value={isHub ? 'Shop hub' : 'Standalone'} />
          <Detail label="Hub address" value={isHub ? window.location.origin : 'Not configured'} />
          <Detail
            label="Saved hub session"
            value={isHub ? (status.sessionActive ? 'Token stored; hub validates on request' : 'No token') : 'Not applicable'}
          />
          <Detail label="Device ID" value={status.deviceId || 'Initializing'} />
          <Detail label="Sync sequence" value={isHub ? status.sequence : 'Local data'} />
          <Detail label="Last hub contact" value={isHub ? formatTime(status.lastConnectedAt) : 'Not applicable'} />
          <Detail label="Last sync" value={isHub ? formatTime(status.lastSyncAt) : 'Not applicable'} />
          <Detail label="Pending changes" value={isHub ? status.pendingCount : 0} />
          <Detail label="Pending print jobs" value={isHub ? status.pendingPrintCount : 0} />
          <Detail label="Failed print jobs" value={isHub ? status.failedPrintCount : 0} />
          <Detail label="Menu conflicts" value={isHub ? status.conflicts.length : 0} />
          <Detail label="Last backup" value={isHub ? formatTime(status.lastBackupAt ?? undefined) : 'Not applicable'} />
        </dl>

        {isHub && status.backupHealthError && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <strong>Backup health:</strong> {status.backupHealthError}
          </div>
        )}

        {isHub && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted">Hub printers</h4>
            {printerStatuses.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {printerStatuses.map(([id, printerStatus]) => {
                  const printerName = printers.find((printer) => printer.id === id)?.name ?? id
                  return (
                    <Badge
                      key={id}
                      tone={printerStatus === 'online' ? 'success' : printerStatus === 'error' ? 'danger' : 'neutral'}
                    >
                      {printerName}: {printerStatus}
                      {status.printerOfflineSince[id]
                        ? ` · offline since ${formatTime(status.printerOfflineSince[id])}`
                        : ''}
                    </Badge>
                  )
                })}
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-muted">No hub printer status has been reported.</p>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Activity className="mt-0.5 h-4 w-4 text-muted" />
          <div>
            <h3 className="text-[14px] font-bold text-ink">Recent connection activity</h3>
            <p className="mt-1 text-[11px] text-muted">
              Up to 50 connection, sync, and print-delivery events saved in this browser; these are not hub server logs.
            </p>
          </div>
        </div>
        {status.activityLog.length ? (
          <ol className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {status.activityLog.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl bg-cream-50 px-3 py-2 text-[12px] dark:bg-espresso-900/60">
                <time dateTime={entry.at} className="shrink-0 font-mono text-[10px] text-muted">
                  {formatTime(entry.at)}
                </time>
                <Badge tone={entry.level === 'error' ? 'danger' : entry.level === 'warn' ? 'warning' : 'info'}>
                  {entry.level}
                </Badge>
                <span className="min-w-0 flex-1 text-ink">{entry.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 rounded-xl bg-cream-50 px-3 py-4 text-center text-[12px] text-muted dark:bg-espresso-900/60">
            No connection activity has been recorded on this device yet.
          </p>
        )}
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { ArrowDown, ArrowUp, MonitorSmartphone, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { IconColor, Station, StationDevice } from '../../../types'
import { AppIcon } from '../../../components/AppIcon'
import { IconPicker } from '../../../components/IconPicker'
import ConfirmDeleteModal from '../../../components/data/ConfirmDeleteModal'
import { Button, Card, Field, Input, Toggle } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { useApp } from '../../../store/AppStore'

export default function StationsTab({ storeId }: { storeId: string }) {
  const {
    db,
    addStation,
    updateStation,
    deleteStation,
    reorderStations,
    addStationDevice,
    updateStationDevice,
    disableStationDevice,
    enableStationDevice,
    unpairStationDevice,
  } = useApp()
  const { push } = useToast()
  const stations = db.stations.filter((station) => station.storeId === storeId)
    .sort((a, b) => a.sort - b.sort)
  const [editing, setEditing] = useState<Station | undefined>()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<Station['icon']>('Utensils')
  const [color, setColor] = useState<IconColor>('amber')
  const [screen, setScreen] = useState(true)
  const [deleting, setDeleting] = useState<Station | undefined>()
  const [deviceName, setDeviceName] = useState('')
  const [deviceStationIds, setDeviceStationIds] = useState<string[]>([])
  const [editingDevice, setEditingDevice] = useState<StationDevice | undefined>()

  const reset = () => {
    setEditing(undefined)
    setName('')
    setIcon('Utensils')
    setColor('amber')
    setScreen(true)
  }
  const edit = (station: Station) => {
    setEditing(station)
    setName(station.name)
    setIcon(station.icon)
    setColor(station.color)
    setScreen(station.screen)
  }
  const save = () => {
    const result = editing
      ? updateStation(editing.id, { name, icon, color, screen })
      : addStation(storeId, { name, icon, color, screen })
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(editing ? 'Station updated' : 'Station added', 'success')
    reset()
  }
  const move = (station: Station, offset: number) => {
    const index = stations.findIndex((item) => item.id === station.id)
    const next = index + offset
    if (next < 0 || next >= stations.length) return
    const reordered = stations.map((item) => item.id)
    ;[reordered[index], reordered[next]] = [reordered[next], reordered[index]]
    const result = reorderStations(storeId, reordered)
    if (!result.ok) push(result.error, 'error')
  }
  const screens = stations.filter((station) => station.screen)
  const devices = db.stationDevices.filter((device) => device.storeId === storeId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const saveDevice = () => {
    if (editingDevice) {
      const result = updateStationDevice(editingDevice.id, { name: deviceName, stationIds: deviceStationIds })
      if (!result.ok) {
        push(result.error, 'error')
        return
      }
      push('Station device updated', 'success')
      setEditingDevice(undefined)
      setDeviceName('')
      setDeviceStationIds([])
      return
    }
    const result = addStationDevice(storeId, { name: deviceName, stationIds: deviceStationIds })
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Station device added. Pair it within 10 minutes.', 'success')
    setDeviceName('')
    setDeviceStationIds([])
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
      <Card className="divide-y divide-line/60">
        {stations.map((station, index) => (
          <div key={station.id} className="flex items-center gap-3 p-4">
            <AppIcon name={station.icon} color={station.color} size={18} className="h-10 w-10 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{station.name}</p>
              <p className="text-xs text-muted">{station.screen ? 'Station screen enabled' : 'No station screen'}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Move station up" disabled={index === 0} onClick={() => move(station, -1)}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Move station down" disabled={index === stations.length - 1} onClick={() => move(station, 1)}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Edit ${station.name}`} onClick={() => edit(station)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${station.name}`} onClick={() => setDeleting(station)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {!stations.length && <p className="p-5 text-sm text-muted">Add a station to route preparation items.</p>}
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <h3 className="font-bold text-ink">{editing ? 'Edit station' : 'Add station'}</h3>
          <p className="mt-1 text-xs text-muted">Stations route items and can have their own preparation screen.</p>
        </div>
        <Field label="Station name">
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="e.g. Pastry" />
        </Field>
        <IconPicker value={icon} color={color} onChange={setIcon} onColorChange={setColor} />
        <Toggle checked={screen} onChange={setScreen} label="Has screen" description="Make this station available on a kitchen/bar display." />
        <div className="flex justify-end gap-2">
          {editing && <Button variant="secondary" onClick={reset}>Cancel edit</Button>}
          <Button onClick={save} disabled={!name.trim()}>
            {editing ? 'Save station' : <><Plus className="h-4 w-4" /> Add station</>}
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-4 lg:col-span-2">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-foreground">
            <MonitorSmartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-ink">Station devices</h3>
            <p className="mt-1 text-xs text-muted">Pair one or more screens with the stations they should display.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-3 rounded-xl border border-line p-3">
            <Field label="Device name">
              <Input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} maxLength={100} placeholder="e.g. Kitchen tablet" />
            </Field>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink">Stations</p>
              {screens.length ? (
                <div className="space-y-2">
                  {screens.map((station) => (
                    <label key={station.id} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={deviceStationIds.includes(station.id)}
                        onChange={(event) => setDeviceStationIds((current) =>
                          event.target.checked
                            ? [...current, station.id]
                            : current.filter((id) => id !== station.id),
                        )}
                      />
                      {station.name}
                    </label>
                  ))}
                </div>
              ) : <p className="text-xs text-muted">Enable “Has screen” on a station before assigning it.</p>}
            </div>
            <div className="flex justify-end gap-2">
              {editingDevice && (
                <Button variant="secondary" onClick={() => { setEditingDevice(undefined); setDeviceName(''); setDeviceStationIds([]) }}>
                  Cancel
                </Button>
              )}
              <Button onClick={saveDevice} disabled={!deviceName.trim() || !deviceStationIds.length}>
                {editingDevice ? 'Save device' : <><Plus className="h-4 w-4" /> Add device</>}
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted">
              QR pairing is not shown because the project has no QR encoder and dependencies cannot be added without approval.
              Open <a className="font-semibold underline" href="/pair">/pair</a> on the screen and enter the store code and pairing code.
            </p>
          </div>
          <div className="space-y-3">
            {devices.map((device) => (
              <div key={device.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{device.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {device.stationIds.map((id) => stations.find((station) => station.id === id)?.name ?? 'Removed station').join(', ')}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {device.active ? device.pairedAt ? `Paired ${new Date(device.pairedAt).toLocaleString()}` : 'Awaiting pairing' : 'Disabled'}
                      {' · '}Last seen: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${device.name}`}
                      onClick={() => {
                        setEditingDevice(device)
                        setDeviceName(device.name)
                        setDeviceStationIds(device.stationIds)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {device.active && device.pairedAt && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Unpair ${device.name}`}
                        onClick={() => {
                          const result = unpairStationDevice(device.id)
                          if (!result.ok) {
                            push(result.error, 'error')
                            return
                          }
                          push('Device unpaired. Use the new pairing code before it expires.', 'info')
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    {device.active ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Disable ${device.name}`}
                        onClick={() => {
                          const result = disableStationDevice(device.id)
                          if (!result.ok) push(result.error, 'error')
                          else push('Station device disabled', 'info')
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Enable ${device.name}`}
                        onClick={() => {
                          const result = enableStationDevice(device.id)
                          if (!result.ok) {
                            push(result.error, 'error')
                            return
                          }
                          push('Device enabled. Use its new pairing code before it expires.', 'success')
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {device.active && device.pairingCode && (
                  <div className="mt-3 rounded-lg bg-cream-50 p-3 text-xs">
                    <p className="text-muted">Store code <strong className="text-ink">{db.stores.find((store) => store.id === storeId)?.slug}</strong></p>
                    <p className="mt-1 text-muted">Pairing code <strong className="font-mono text-lg tracking-[0.2em] text-ink">{device.pairingCode}</strong></p>
                    <p className="mt-1 text-muted">Expires {device.pairingCodeExpiresAt ? new Date(device.pairingCodeExpiresAt).toLocaleString() : 'soon'}.</p>
                  </div>
                )}
              </div>
            ))}
            {!devices.length && <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">No station devices yet.</p>}
          </div>
        </div>
      </Card>

      <ConfirmDeleteModal
        open={!!deleting}
        onClose={() => setDeleting(undefined)}
        title="Delete station?"
        subject={deleting?.name}
        description="A station cannot be deleted while products or categories are assigned to it."
        onConfirm={() => {
          if (!deleting) return
          const result = deleteStation(deleting.id)
          if (!result.ok) {
            push(result.error, 'error')
            return
          }
          push('Station deleted', 'info')
          if (editing?.id === deleting.id) reset()
          setDeleting(undefined)
        }}
      />
    </div>
  )
}

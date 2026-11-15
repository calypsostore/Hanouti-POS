import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import type { IconColor, Station } from '../../../types'
import { AppIcon } from '../../../components/AppIcon'
import { IconPicker } from '../../../components/IconPicker'
import ConfirmDeleteModal from '../../../components/data/ConfirmDeleteModal'
import { Button, Card, Field, Input, Toggle } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { useApp } from '../../../store/AppStore'

export default function StationsTab({ storeId }: { storeId: string }) {
  const { db, addStation, updateStation, deleteStation, reorderStations } = useApp()
  const { push } = useToast()
  const stations = db.stations.filter((station) => station.storeId === storeId)
    .sort((a, b) => a.sort - b.sort)
  const [editing, setEditing] = useState<Station | undefined>()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<Station['icon']>('Utensils')
  const [color, setColor] = useState<IconColor>('amber')
  const [screen, setScreen] = useState(true)
  const [deleting, setDeleting] = useState<Station | undefined>()

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

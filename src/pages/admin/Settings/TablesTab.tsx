import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useApp } from '../../../store/AppStore'
import type { DiningTable } from '../../../types'
import { Button, Card, Field, Input, Modal, Toggle } from '../../../components/ui'
import { useToast } from '../../../components/toast'

type TableForm = { name: string; seats: number; zone: string }

const EMPTY_FORM: TableForm = { name: '', seats: 2, zone: 'Inside' }

export default function TablesTab({ storeId }: { storeId: string }) {
  const { db, addTable, updateTable, deleteTable } = useApp()
  const { push } = useToast()
  const [form, setForm] = useState<TableForm>(EMPTY_FORM)
  const [quickCount, setQuickCount] = useState(8)
  const [editing, setEditing] = useState<DiningTable | null>(null)
  const [editForm, setEditForm] = useState<TableForm>(EMPTY_FORM)
  const tables = db.tables
    .filter((table) => table.storeId === storeId)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))

  const saveNew = () => {
    const result = addTable(storeId, form)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Added ${form.name.trim()}`, 'success')
    setForm({ ...EMPTY_FORM, zone: form.zone })
  }

  const quickAdd = () => {
    const existing = new Set(tables.map((table) => table.name.toLowerCase()))
    const names = Array.from({ length: quickCount }, (_, index) => `Table ${index + 1}`)
      .filter((name) => !existing.has(name.toLowerCase()))
    if (!names.length) {
      push(`Tables 1–${quickCount} already exist`, 'info')
      return
    }
    for (const name of names) {
      const result = addTable(storeId, { name, seats: 2, zone: 'Inside' })
      if (!result.ok) {
        push(result.error, 'error')
        return
      }
    }
    push(`Added ${names.length} table${names.length === 1 ? '' : 's'}`, 'success')
  }

  const saveEdit = () => {
    if (!editing) return
    const result = updateTable(editing.id, editForm)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Updated ${editForm.name.trim()}`, 'success')
    setEditing(null)
  }

  const removeTable = () => {
    if (!editing) return
    const result = deleteTable(editing.id)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Removed or deactivated ${editing.name}`, 'success')
    setEditing(null)
  }

  const move = (table: DiningTable, direction: -1 | 1) => {
    const index = tables.findIndex((candidate) => candidate.id === table.id)
    const target = tables[index + direction]
    if (!target) return
    const result = updateTable(table.id, { sort: index + direction })
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Moved ${table.name}`, 'success')
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold">Add a table</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Table name">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Table 1" />
          </Field>
          <Field label="Seats">
            <Input type="number" min={1} max={50} step={1} value={form.seats} onChange={(event) => setForm({ ...form, seats: Number(event.target.value) })} />
          </Field>
          <Field label="Zone">
            <Input value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} placeholder="Inside" />
          </Field>
          <div className="flex items-end">
            <Button className="w-full" onClick={saveNew}><Plus className="h-4 w-4" /> Add table</Button>
          </div>
        </div>
      </Card>

      <Card className="flex flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
        <div>
          <h3 className="text-[15px] font-semibold">Quick add tables</h3>
          <p className="mt-1 text-[12px] text-muted">Create any missing tables from Table 1 to the chosen number.</p>
        </div>
        <div className="flex items-end gap-2">
          <Field label="Number of tables">
            <Input type="number" min={1} max={50} step={1} value={quickCount} onChange={(event) => setQuickCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} className="w-28" />
          </Field>
          <Button variant="secondary" onClick={quickAdd}>Quick add</Button>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {tables.map((table, index) => (
          <Card key={table.id} className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-navy">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold">{table.name}</div>
              <div className="text-[11px] text-muted">{table.zone || 'No zone'} · {table.seats} seats</div>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${table.active ? 'bg-[var(--semantic-green-soft)] text-[var(--semantic-green-text)]' : 'bg-cream-200 text-muted'}`}>
              {table.active ? 'Active' : 'Inactive'}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label={`Move ${table.name} up`} disabled={index === 0} onClick={() => move(table, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Move ${table.name} down`} disabled={index === tables.length - 1} onClick={() => move(table, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Edit ${table.name}`} onClick={() => { setEditing(table); setEditForm({ name: table.name, seats: table.seats, zone: table.zone ?? '' }) }}><Pencil className="h-4 w-4" /></Button>
            </div>
          </Card>
        ))}
        {tables.length === 0 && (
          <Card className="p-8 text-center text-[12px] text-muted md:col-span-2">No tables yet. Add one or use Quick add.</Card>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit table" size="sm" footer={
        <div className="flex flex-wrap justify-between gap-2">
          {editing && <Toggle checked={editing.active} onChange={(active) => setEditing({ ...editing, active })} label={editing.active ? 'Active' : 'Inactive'} />}
          <div className="ml-auto flex gap-2">
            {editing && <Button variant="danger" onClick={removeTable}><Trash2 className="h-4 w-4" /> Remove</Button>}
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save table</Button>
          </div>
        </div>
      }>
        <div className="space-y-3">
          <Field label="Table name"><Input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></Field>
          <Field label="Seats"><Input type="number" min={1} max={50} step={1} value={editForm.seats} onChange={(event) => setEditForm({ ...editForm, seats: Number(event.target.value) })} /></Field>
          <Field label="Zone"><Input value={editForm.zone} onChange={(event) => setEditForm({ ...editForm, zone: event.target.value })} placeholder="Inside or Terrace" /></Field>
        </div>
      </Modal>
    </div>
  )
}

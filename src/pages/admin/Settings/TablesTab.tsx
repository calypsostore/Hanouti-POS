import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useApp } from '../../../store/AppStore'
import type { DiningTable, GuestRequirement, StoreSettings, TableMode } from '../../../types'
import { Button, Card, Field, Input, Modal, Select, Toggle } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import TableSectionsPanel from './TableSectionsPanel'

type TableForm = { name: string; seats: number; sectionId: string }
type SettingsSetter = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => void
const EMPTY_FORM: TableForm = { name: '', seats: 2, sectionId: '' }

export default function TablesTab({
  storeId,
  settings,
  set,
}: {
  storeId: string
  settings: StoreSettings
  set: SettingsSetter
}) {
  const { db, addTable, updateTable, deleteTable } = useApp()
  const { push } = useToast()
  const [form, setForm] = useState<TableForm>(EMPTY_FORM)
  const [quickCount, setQuickCount] = useState(8)
  const [editing, setEditing] = useState<DiningTable | null>(null)
  const [editForm, setEditForm] = useState<TableForm>(EMPTY_FORM)
  const [filterSection, setFilterSection] = useState('all')
  const sections = db.sections
    .filter((section) => section.storeId === storeId && section.active)
    .sort((a, b) => a.sort - b.sort)
  const allTables = db.tables
    .filter((table) => table.storeId === storeId)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
  const tables = allTables.filter((table) => filterSection === 'all' || table.sectionId === filterSection)

  const saveNew = () => {
    const result = addTable(storeId, { ...form, sectionId: form.sectionId || undefined })
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Added ${form.name.trim()}`, 'success')
    setForm({ ...EMPTY_FORM, sectionId: form.sectionId })
  }

  const quickAdd = () => {
    const existing = new Set(db.tables
      .filter((table) => table.storeId === storeId)
      .map((table) => table.name.toLowerCase()))
    const names = Array.from({ length: quickCount }, (_, index) => `Table ${index + 1}`)
      .filter((name) => !existing.has(name.toLowerCase()))
    if (!names.length) {
      push(`Tables 1–${quickCount} already exist`, 'info')
      return
    }
    for (const name of names) {
      const result = addTable(storeId, {
        name,
        seats: 2,
        sectionId: settings.tableMode === 'sections_tables' ? sections[0]?.id : undefined,
      })
      if (!result.ok) {
        push(result.error, 'error')
        return
      }
    }
    push(`Added ${names.length} table${names.length === 1 ? '' : 's'}`, 'success')
  }

  const saveEdit = () => {
    if (!editing) return
    const result = updateTable(editing.id, {
      ...editForm,
      sectionId: editForm.sectionId || undefined,
      active: editing.active,
    })
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
    const ordered = db.tables
      .filter((candidate) => candidate.storeId === storeId)
      .sort((a, b) => a.sort - b.sort)
    const index = ordered.findIndex((candidate) => candidate.id === table.id)
    const target = ordered[index + direction]
    if (!target) return
    const result = updateTable(table.id, { sort: index + direction })
    if (!result.ok) push(result.error, 'error')
  }

  const changeTableMode = (tableMode: TableMode) => set('tableMode', tableMode)
  const changeGuestRequirement = (guestRequirement: GuestRequirement) => set('guestRequirement', guestRequirement)

  return (
    <div className="space-y-4">
      <Card className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <h3 className="text-[15px] font-semibold">Table system</h3>
          <p className="mt-1 text-[12px] text-muted">Choose how staff identify dine-in tables.</p>
        </div>
        <Field label="Mode">
          <Select value={settings.tableMode} onChange={(event) => changeTableMode(event.target.value as TableMode)}>
            <option value="sections_tables">Sections and tables</option>
            <option value="tables_only">Tables only</option>
            <option value="manual">Manual table name</option>
          </Select>
        </Field>
        <Field label="Guests">
          <Select value={settings.guestRequirement} onChange={(event) => changeGuestRequirement(event.target.value as GuestRequirement)}>
            <option value="required">Required</option>
            <option value="optional">Optional</option>
            <option value="off">Off</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Toggle
            checked={settings.staffPickSectionsOnShift}
            onChange={(checked) => set('staffPickSectionsOnShift', checked)}
            label="Staff pick sections when opening a shift"
            description="Waiters can claim sections for the duration of their shift."
          />
        </div>
        <div className="sm:col-span-2">
          <Toggle
            checked={settings.features.tables}
            onChange={(checked) => set('features', { ...settings.features, tables: checked })}
            label="Enable table service"
            description="Show dine-in table workflows on the POS."
          />
        </div>
      </Card>

      {settings.tableMode === 'sections_tables' && <TableSectionsPanel storeId={storeId} />}

      {settings.tableMode !== 'manual' && (
        <>
          <Card className="p-4 sm:p-5">
            <h3 className="text-[15px] font-semibold">Add a table</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Field label="Table name">
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Table 1" />
              </Field>
              <Field label="Seats">
                <Input type="number" min={1} max={50} step={1} value={form.seats} onChange={(event) => setForm({ ...form, seats: Number(event.target.value) })} />
              </Field>
              {settings.tableMode === 'sections_tables' && (
                <Field label="Section">
                  <Select value={form.sectionId} onChange={(event) => setForm({ ...form, sectionId: event.target.value })}>
                    <option value="">No section</option>
                    {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                  </Select>
                </Field>
              )}
              <div className="flex items-end"><Button className="w-full" onClick={saveNew}><Plus className="h-4 w-4" /> Add table</Button></div>
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

          <div className="flex max-w-xs items-center gap-2">
            <span className="text-xs font-semibold text-muted">Filter section</span>
            <Select value={filterSection} onChange={(event) => setFilterSection(event.target.value)}>
              <option value="all">All sections</option>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {tables.map((table) => {
              const sortIndex = allTables.findIndex((candidate) => candidate.id === table.id)
              const section = sections.find((candidate) => candidate.id === table.sectionId)
              return (
                <Card key={table.id} className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-navy"><Users className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold">{table.name}</div>
                    <div className="text-[11px] text-muted">{section?.name ?? 'No section'} · {table.seats} seats</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${table.active ? 'bg-[var(--semantic-green-soft)] text-[var(--semantic-green-text)]' : 'bg-cream-200 text-muted'}`}>
                    {table.active ? 'Active' : 'Inactive'}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Move ${table.name} up`} disabled={sortIndex === 0} onClick={() => move(table, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Move ${table.name} down`} disabled={sortIndex === allTables.length - 1} onClick={() => move(table, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${table.name}`} onClick={() => { setEditing(table); setEditForm({ name: table.name, seats: table.seats, sectionId: table.sectionId ?? '' }) }}><Pencil className="h-4 w-4" /></Button>
                  </div>
                </Card>
              )
            })}
            {!tables.length && <Card className="p-8 text-center text-[12px] text-muted md:col-span-2">No tables yet. Add one or use Quick add.</Card>}
          </div>
        </>
      )}

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
          {settings.tableMode === 'sections_tables' && (
            <Field label="Section"><Select value={editForm.sectionId} onChange={(event) => setEditForm({ ...editForm, sectionId: event.target.value })}><option value="">No section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</Select></Field>
          )}
        </div>
      </Modal>
    </div>
  )
}

import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card, Field, Input, Modal, Select, Toggle } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { useApp } from '../../../store/AppStore'
import type { IconColor, IconName, TableSection } from '../../../types'

const COLORS: IconColor[] = ['blue', 'green', 'amber', 'rose', 'violet', 'teal', 'slate', 'orange']
const ICONS: IconName[] = ['Utensils', 'Coffee', 'CupSoda', 'Cake', 'Leaf', 'Star']
type SectionForm = Pick<TableSection, 'name' | 'color' | 'icon'>
const EMPTY_FORM: SectionForm = { name: '', color: 'blue', icon: 'Utensils' }

export default function TableSectionsPanel({ storeId }: { storeId: string }) {
  const { db, addSection, updateSection, deleteSection } = useApp()
  const { push } = useToast()
  const [form, setForm] = useState<SectionForm>(EMPTY_FORM)
  const [editing, setEditing] = useState<TableSection | null>(null)
  const [editForm, setEditForm] = useState<SectionForm>(EMPTY_FORM)
  const sections = db.sections
    .filter((section) => section.storeId === storeId)
    .sort((a, b) => a.sort - b.sort)

  const saveNew = () => {
    const result = addSection(storeId, form)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Added section ${form.name.trim()}`, 'success')
    setForm(EMPTY_FORM)
  }

  const saveEdit = () => {
    if (!editing) return
    const result = updateSection(editing.id, { ...editForm, active: editing.active })
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Updated section ${editForm.name.trim()}`, 'success')
    setEditing(null)
  }

  const remove = () => {
    if (!editing) return
    const result = deleteSection(editing.id)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`Deleted section ${editing.name}`, 'success')
    setEditing(null)
  }

  const move = (section: TableSection, direction: -1 | 1) => {
    const index = sections.findIndex((candidate) => candidate.id === section.id)
    const result = updateSection(section.id, { sort: index + direction })
    if (!result.ok) push(result.error, 'error')
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div>
        <h3 className="text-[15px] font-semibold">Sections</h3>
        <p className="mt-1 text-[12px] text-muted">Create zones such as Inside or Terrace.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_150px_150px_auto]">
        <Field label="Section name">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Terrace" />
        </Field>
        <Field label="Color">
          <Select value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value as IconColor })}>
            {COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
          </Select>
        </Field>
        <Field label="Icon">
          <Select value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value as IconName })}>
            {ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
          </Select>
        </Field>
        <div className="flex items-end"><Button className="w-full" onClick={saveNew}><Plus className="h-4 w-4" /> Add</Button></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {sections.map((section, index) => (
          <div key={section.id} className="flex items-center gap-2 rounded-xl border border-line p-3">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{section.name}</span>
            <span className="text-[10px] text-muted">{section.color} · {section.icon}</span>
            <Button variant="ghost" size="icon" aria-label={`Move ${section.name} up`} disabled={index === 0} onClick={() => move(section, -1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={`Move ${section.name} down`} disabled={index === sections.length - 1} onClick={() => move(section, 1)}><ArrowDown className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={`Edit ${section.name}`} onClick={() => { setEditing(section); setEditForm({ name: section.name, color: section.color, icon: section.icon }) }}><Pencil className="h-4 w-4" /></Button>
          </div>
        ))}
        {!sections.length && <p className="text-xs text-muted sm:col-span-2">No sections created.</p>}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit section" size="sm" footer={
        <div className="flex flex-wrap justify-between gap-2">
          {editing && <Toggle checked={editing.active} onChange={(active) => setEditing({ ...editing, active })} label={editing.active ? 'Active' : 'Inactive'} />}
          <div className="ml-auto flex gap-2">
            {editing && <Button variant="danger" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>}
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save section</Button>
          </div>
        </div>
      }>
        <div className="space-y-3">
          <Field label="Section name"><Input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></Field>
          <Field label="Color"><Select value={editForm.color} onChange={(event) => setEditForm({ ...editForm, color: event.target.value as IconColor })}>{COLORS.map((color) => <option key={color} value={color}>{color}</option>)}</Select></Field>
          <Field label="Icon"><Select value={editForm.icon} onChange={(event) => setEditForm({ ...editForm, icon: event.target.value as IconName })}>{ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</Select></Field>
        </div>
      </Modal>
    </Card>
  )
}

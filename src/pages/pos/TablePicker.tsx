import { useEffect, useRef } from 'react'
import { Users } from 'lucide-react'
import type { DiningTable, GuestRequirement, OpenOrder, TableMode, TableSection } from '../../types'
import { Button, Card, Field, Input } from '../../components/ui'
import { cn } from '../../lib/utils'

export function TablePicker({
  tables,
  sections,
  openTables,
  tableMode,
  guestRequirement,
  selectedId,
  onSelect,
  tableName,
  onTableNameChange,
  guests,
  onGuestsChange,
  autoFocus = false,
}: {
  tables: DiningTable[]
  sections: TableSection[]
  openTables: OpenOrder[]
  tableMode: TableMode
  guestRequirement: GuestRequirement
  selectedId?: string
  onSelect: (id: string | undefined) => void
  tableName: string
  onTableNameChange: (name: string) => void
  guests?: number
  onGuestsChange: (guests: number | undefined) => void
  autoFocus?: boolean
}) {
  const firstTableRef = useRef<HTMLButtonElement>(null)
  const datalistId = 'open-table-names'
  const sectionTables = sections.map((section) => ({
    label: section.name,
    tables: tables.filter((table) => table.sectionId === section.id),
  }))
  const groupedTables = tableMode === 'sections_tables'
    ? [...sectionTables, { label: 'No section', tables: tables.filter((table) => !sections.some((section) => section.id === table.sectionId)) }]
    : [{ label: '', tables }]

  useEffect(() => {
    const firstTable = firstTableRef.current
    if (autoFocus && firstTable && firstTable.getClientRects().length > 0) firstTable.focus()
  }, [autoFocus])

  return (
    <section id="table-picker" className="mb-3 rounded-xl border border-line/70 bg-cream-50/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-bold text-ink">Choose a table</div>
          <div className="text-[10.5px] text-muted">Required for dine-in orders.</div>
        </div>
        {(selectedId || tableName) && <Button variant="ghost" size="sm" onClick={() => { onSelect(undefined); onTableNameChange('') }}>Clear</Button>}
      </div>
      {tableMode === 'manual' ? (
        <Field label="Table name or number" hint="Suggestions include currently open tables">
          <>
            <Input
              value={tableName}
              onChange={(event) => { onTableNameChange(event.target.value); onSelect(undefined) }}
              placeholder="e.g. 12 or Window"
              list={datalistId}
              maxLength={60}
            />
            <datalist id={datalistId}>
              {openTables.map((order) => <option key={order.id} value={order.tableName} />)}
            </datalist>
          </>
        </Field>
      ) : tables.length ? groupedTables.map(({ label, tables: sectionTablesForGroup }) => sectionTablesForGroup.length > 0 && (
        <div key={label || 'tables-only'} className="mb-2 last:mb-0">
          {label && <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {sectionTablesForGroup.map((table, index) => (
              <TableButton
                key={table.id}
                table={table}
                selected={selectedId === table.id}
                buttonRef={index === 0 && label === groupedTables[0].label ? firstTableRef : undefined}
                onClick={() => onSelect(table.id)}
              />
            ))}
          </div>
        </div>
      )) : (
        <Card className="p-3 text-center text-[11px] text-muted">No active tables. Ask an admin to add tables in Settings.</Card>
      )}
      {guestRequirement !== 'off' && (
        <Field label="Guests" hint={guestRequirement === 'required' ? 'required' : 'optional'} className="mt-2">
          <Input
            type="number"
            min={1}
            max={50}
            step={1}
            required={guestRequirement === 'required'}
            value={guests ?? ''}
            onChange={(event) => onGuestsChange(event.target.value ? Number(event.target.value) : undefined)}
            placeholder="Number of guests"
            className="h-9 text-[12px]"
          />
        </Field>
      )}
    </section>
  )
}

function TableButton({
  table,
  selected,
  buttonRef,
  onClick,
}: {
  table: DiningTable
  selected: boolean
  buttonRef?: React.Ref<HTMLButtonElement>
  onClick: () => void
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-12 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition',
        selected
          ? 'border-accent-foreground bg-accent-50 text-accent-foreground ring-1 ring-accent-foreground/30'
          : 'border-line bg-white text-ink hover:border-accent-foreground/50',
      )}
    >
      <Users className="h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-bold">{table.name}</span>
        <span className="block text-[9.5px] text-muted">{table.seats} seats</span>
      </span>
    </button>
  )
}

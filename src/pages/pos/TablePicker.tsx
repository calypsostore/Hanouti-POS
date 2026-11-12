import { useEffect, useRef } from 'react'
import { Users } from 'lucide-react'
import type { DiningTable } from '../../types'
import { Button, Card, Field, Input } from '../../components/ui'
import { cn } from '../../lib/utils'

export function TablePicker({
  tables,
  selectedId,
  onSelect,
  guests,
  onGuestsChange,
  autoFocus = false,
}: {
  tables: DiningTable[]
  selectedId?: string
  onSelect: (id: string | undefined) => void
  guests?: number
  onGuestsChange: (guests: number | undefined) => void
  autoFocus?: boolean
}) {
  const firstTableRef = useRef<HTMLButtonElement>(null)
  const zones = [...new Set(tables.map((table) => table.zone?.trim() || 'Other'))]

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
        {selectedId && <Button variant="ghost" size="sm" onClick={() => onSelect(undefined)}>Clear</Button>}
      </div>
      {tables.length ? zones.map((zone) => (
        <div key={zone} className="mb-2 last:mb-0">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">{zone}</div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {tables.filter((table) => (table.zone?.trim() || 'Other') === zone).map((table, index) => (
              <button
                key={table.id}
                ref={index === 0 && zone === zones[0] ? firstTableRef : undefined}
                type="button"
                aria-pressed={selectedId === table.id}
                onClick={() => onSelect(table.id)}
                className={cn(
                  'flex min-h-12 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition',
                  selectedId === table.id
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
            ))}
          </div>
        </div>
      )) : (
        <Card className="p-3 text-center text-[11px] text-muted">No active tables. Ask an admin to add tables in Settings.</Card>
      )}
      <Field label="Guests" hint="optional" className="mt-2">
        <Input
          type="number"
          min={1}
          max={50}
          step={1}
          value={guests ?? ''}
          onChange={(event) => onGuestsChange(event.target.value ? Number(event.target.value) : undefined)}
          placeholder="Number of guests"
          className="h-9 text-[12px]"
        />
      </Field>
    </section>
  )
}

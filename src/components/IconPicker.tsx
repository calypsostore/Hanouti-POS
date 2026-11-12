import { useMemo, useState } from 'react'
import type { IconColor, IconName } from '../types'
import { SEMANTIC_COLORS } from '../lib/semanticColors'
import { ICON_GROUPS } from '../lib/icons'
import { AppIcon } from './AppIcon'
import { Input } from './ui'

const COLORS: IconColor[] = ['green', 'blue', 'amber', 'rose', 'violet', 'teal', 'slate', 'orange']

export function IconPicker({
  value,
  color,
  onChange,
  onColorChange,
}: {
  value: IconName
  color: IconColor
  onChange: (value: IconName) => void
  onColorChange: (value: IconColor) => void
}) {
  const [query, setQuery] = useState('')
  const filteredGroups = useMemo(() => ICON_GROUPS.map((group) => ({
    ...group,
    names: group.names.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase())),
  })).filter((group) => group.names.length), [query])

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search icons"
        aria-label="Search icons"
      />
      <div className="max-h-56 space-y-3 overflow-y-auto rounded-2xl p-1 thin-scrollbar">
        {filteredGroups.length ? filteredGroups.map((group) => (
          <section key={group.label}>
            <h4 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted">{group.label}</h4>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
              {group.names.map((name) => (
                <button
                  type="button"
                  key={name}
                  title={name}
                  aria-label={name}
                  aria-pressed={value === name}
                  onClick={() => onChange(name)}
                  className={`icon-picker-tile flex h-10 items-center justify-center rounded-xl transition ${value === name ? 'ring-2 ring-brand-amber ring-offset-1' : 'hover:-translate-y-0.5'}`}
                >
                  <AppIcon name={name} color={color} size={19} className="h-full w-full bg-transparent shadow-none" />
                </button>
              ))}
            </div>
          </section>
        )) : <p className="px-2 py-4 text-center text-xs text-muted">No icons match that search.</p>}
      </div>
      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">Icon colour</div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onColorChange(option)}
              aria-label={`${option} icon color`}
              aria-pressed={color === option}
              className={`h-7 w-7 rounded-full border transition ${color === option ? 'ring-2 ring-brand-amber ring-offset-2' : 'hover:scale-110'}`}
              style={{ background: SEMANTIC_COLORS.icons[option].light.solid, borderColor: SEMANTIC_COLORS.icons[option].light.border }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

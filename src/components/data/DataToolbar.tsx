import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Card, Input } from '../ui'

export default function DataToolbar({
  query,
  onQueryChange,
  placeholder,
  children,
}: {
  query: string
  onQueryChange: (query: string) => void
  placeholder: string
  children?: ReactNode
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
      <label className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          className="pl-9"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
        />
      </label>
      {children}
    </Card>
  )
}

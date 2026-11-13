import type { ReactNode } from 'react'

export type DataTableColumn<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  rowClassName,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty: ReactNode
  rowClassName?: (row: T) => string
}) {
  if (rows.length === 0) return <div className="px-4 py-8 text-center text-sm text-muted">{empty}</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[12px]">
        <thead className="glass-subtle sticky top-0 z-10 text-[10px] uppercase tracking-wider text-muted">
          <tr>{columns.map((column) => <th key={column.key} scope="col" className={`px-4 py-2.5 font-bold ${column.className ?? ''}`}>{column.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {rows.map((row, index) => (
            <tr key={rowKey(row)} className={`glass-row ${index % 2 ? 'bg-white/15' : ''} ${rowClassName?.(row) ?? ''}`}>
              {columns.map((column) => <td key={column.key} className={`px-4 py-3 ${column.className ?? ''}`}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

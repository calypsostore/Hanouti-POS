import { useMemo, useState } from 'react'
import { Badge, Card, Input } from './ui'
import CsvExportButton from './data/CsvExportButton'
import {
  formatRegisterItemQuantity,
  groupRegisterItemRows,
  summarizeRegisterItems,
  type RegisterItemSort,
} from '../lib/registerItems'
import { money } from '../lib/utils'
import type { RegisterItemRow, RegisterItemsReport, RegisterVoidedItemRow } from '../types'

const isVoidedItem = (item: RegisterItemRow): item is RegisterVoidedItemRow =>
  'voidedByName' in item

const quantityLabel = (items: RegisterItemRow[], qty: number) =>
  formatRegisterItemQuantity({
    qty,
    soldByWeight: items.some((item) => item.soldByWeight),
  })

export function RegisterItemsTable({
  report,
  title = 'Items in this report',
  interactive = false,
  rebuiltFromOrders = false,
}: {
  report: RegisterItemsReport
  title?: string
  interactive?: boolean
  rebuiltFromOrders?: boolean
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<RegisterItemSort>('name')
  const filteredSections = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return [
      { key: 'sold', title: 'Sold', rows: report.itemsSold },
      { key: 'recorded', title: 'Recorded (no payment)', rows: report.recordedItems },
      { key: 'voided', title: 'Voided items', rows: report.voidedItems },
    ].map((section) => ({
      ...section,
      rows: section.rows.filter((item) =>
        !term || `${item.category} ${item.name} ${isVoidedItem(item) ? item.voidedByName : ''}`
          .toLocaleLowerCase()
          .includes(term),
      ),
    }))
  }, [query, report.itemsSold, report.recordedItems, report.voidedItems])
  const csvRows: (string | number)[][] = [
    ['Section', 'Category', 'Item', 'Quantity', 'Unit', 'Unit price', 'Total', 'Voided by'],
    ...filteredSections.flatMap((section) => section.rows.map((item) => [
      section.title,
      item.category,
      item.name,
      formatRegisterItemQuantity(item),
      item.soldByWeight ? item.saleUnit ?? '' : 'piece',
      isVoidedItem(item) ? '' : item.unitPrice ?? '',
      isVoidedItem(item) ? '' : item.total,
      isVoidedItem(item) ? item.voidedByName : '',
    ])),
  ]
  const soldSummary = summarizeRegisterItems([report.itemsSold])
  const recordedSummary = summarizeRegisterItems([report.recordedItems])
  const servedSummary = summarizeRegisterItems([report.itemsSold, report.recordedItems])

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold text-ink">{title}</h3>
          {rebuiltFromOrders && <Badge tone="warning">Rebuilt from orders</Badge>}
        </div>
        {interactive && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search items"
              aria-label="Search register items"
              className="min-w-0 flex-1 sm:w-44"
            />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value === 'quantity' ? 'quantity' : 'name')}
              aria-label="Sort register items"
              className="h-9 rounded-xl border border-line bg-white px-2 text-[11px] font-medium text-ink"
            >
              <option value="name">Category, name</option>
              <option value="quantity">Quantity, high to low</option>
            </select>
            <CsvExportButton filename="register-items.csv" rows={csvRows} />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {filteredSections.map((section) => {
          const summary = summarizeRegisterItems([section.rows])
          const groups = groupRegisterItemRows(section.rows, sort)
          return (
            <section key={section.key} aria-label={section.title}>
              <div className="mb-1 flex items-center justify-between border-b border-line pb-1 text-[11px] font-bold text-ink">
                <span>{section.title}</span>
                <span className="tabular text-muted">
                  {quantityLabel(section.rows, summary.qty)} · {summary.distinctItems} distinct
                </span>
              </div>
              {groups.length === 0 ? (
                <p className="py-2 text-[11px] text-muted">No items.</p>
              ) : (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <div key={group.category}>
                      <div className="flex items-center justify-between bg-surface-2 px-2 py-1 text-[10px] font-semibold text-muted">
                        <span className="break-words">{group.category}</span>
                        <span className="shrink-0 tabular">
                          {quantityLabel(group.items, group.qty)}
                          {section.key !== 'voided' && ` · ${money(group.total)}`}
                        </span>
                      </div>
                      <div className="divide-y divide-line/50">
                        {group.items.map((item) => (
                          <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2 py-1.5 text-[11px]">
                            <div className="min-w-0 break-words font-medium text-ink">
                              {item.name}
                              {!isVoidedItem(item) && item.unitPrice !== null && (
                                <span className="ml-1 text-[9px] font-normal text-muted">
                                  @ {money(item.unitPrice)}{item.soldByWeight ? ` / ${item.saleUnit ?? 'unit'}` : ' ea'}
                                </span>
                              )}
                              {isVoidedItem(item) && (
                                <div className="text-[9px] font-normal text-muted">Voided by {item.voidedByName}</div>
                              )}
                            </div>
                            <span className="whitespace-nowrap tabular text-muted">
                              {formatRegisterItemQuantity(item)}{item.soldByWeight && item.saleUnit ? ` ${item.saleUnit}` : ''}
                            </span>
                            <span className="whitespace-nowrap text-right font-semibold tabular text-ink">
                              {isVoidedItem(item) ? '—' : money(item.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between border-t border-dashed border-line px-2 py-1 text-[10px] text-muted">
                        <span>{section.key === 'voided' ? 'Category quantity' : 'Category subtotal'}</span>
                        <span className="tabular">
                          {section.key === 'voided' ? quantityLabel(group.items, group.qty) : money(group.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line pt-2 text-[10.5px] font-semibold tabular text-ink">
        <span>Sold: {quantityLabel(report.itemsSold, soldSummary.qty)} · {soldSummary.distinctItems} distinct</span>
        <span>Recorded: {quantityLabel(report.recordedItems, recordedSummary.qty)} · {recordedSummary.distinctItems} distinct</span>
        <span>
          Items served: {quantityLabel([...report.itemsSold, ...report.recordedItems], servedSummary.qty)} · {servedSummary.distinctItems} distinct
        </span>
      </div>
    </Card>
  )
}

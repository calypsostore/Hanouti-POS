import { Eye, ReceiptText, Search } from 'lucide-react'
import type { Order } from '../../../../types'
import { Badge, Button, Card, EmptyState, Input, Segmented, Select } from '../../../../components/ui'
import { cn, fmtDate, fmtTime, money } from '../../../../lib/utils'
import { PaymentBadge } from './OrderPrimitives'
import type { OrderMethod, OrderRange, OrderStatus } from '../types'

type Props = {
  filtered: Order[]
  customerName: (id?: string) => string | undefined
  query: string
  onQueryChange: (query: string) => void
  range: OrderRange
  onRangeChange: (range: OrderRange) => void
  method: OrderMethod
  onMethodChange: (method: OrderMethod) => void
  status: OrderStatus
  onStatusChange: (status: OrderStatus) => void
  tableId: string
  tableOptions: Array<{ id: string; name: string }>
  onTableIdChange: (tableId: string) => void
  limit: number
  onLoadMore: () => void
  onSelect: (order: Order) => void
}

export default function OrdersList({
  filtered,
  customerName,
  query,
  onQueryChange,
  range,
  onRangeChange,
  method,
  onMethodChange,
  status,
  onStatusChange,
  tableId,
  tableOptions,
  onTableIdChange,
  limit,
  onLoadMore,
  onSelect,
}: Props) {
  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-line/70 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by order #, table, customer, staff or item…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={range}
            onChange={onRangeChange}
            size="sm"
            options={[
              { value: 'today', label: 'Today' },
              { value: '7d', label: '7 days' },
              { value: '30d', label: '30 days' },
              { value: 'all', label: 'All' },
            ]}
          />
          <Select
            value={method}
            onChange={(event) => onMethodChange(event.target.value as OrderMethod)}
            className="h-9 w-[130px] text-[12.5px]"
          >
            <option value="all">All payments</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="credit">On tab</option>
            <option value="unpaid">Unpaid</option>
          </Select>
          <Select
            value={status}
            onChange={(event) => onStatusChange(event.target.value as OrderStatus)}
            className="h-9 w-[120px] text-[12.5px]"
          >
            <option value="all">All status</option>
            <option value="completed">Completed</option>
            <option value="recorded">Recorded</option>
            <option value="void">Void</option>
          </Select>
          <Select
            value={tableId}
            onChange={(event) => onTableIdChange(event.target.value)}
            className="h-9 w-[140px] text-[12.5px]"
          >
            <option value="all">All tables</option>
            {tableOptions.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-5 w-5" />}
          title="No orders match"
          description="Try widening the date range or clearing the filters."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="glass-subtle sticky top-0 z-10">
                <tr className="border-b border-line/70 text-[10.5px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5 font-semibold">Order</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold">Items</th>
                  <th className="px-4 py-2.5 font-semibold">Staff</th>
                  <th className="px-4 py-2.5 font-semibold">Payment</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((order) => (
                  <tr
                    key={order.id}
                    className="glass-row cursor-pointer border-b border-line/50 text-[12.5px]"
                    onClick={() => onSelect(order)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">#{order.number}</div>
                      <div className="text-[10.5px] text-muted">
                        {fmtDate(order.createdAt)} · {fmtTime(order.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(order.customerId ? 'font-medium text-ink' : 'text-muted')}>
                        {customerName(order.customerId) ?? 'Guest'}
                      </span>
                      <div className="text-[10.5px] capitalize text-muted">
                        {order.channel.replace('-', ' ')}
                      </div>
                      {order.tableName && <div className="text-[10.5px] font-semibold text-accent-foreground">{order.tableName}</div>}
                    </td>
                    <td className="max-w-[240px] px-4 py-3 text-muted">
                      <span className="line-clamp-1">
                        {order.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{order.staffName.split(' ')[0]}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <PaymentBadge method={order.paymentMethod} />
                        {order.status === 'recorded' && <Badge tone="warning">Recorded</Badge>}
                        {order.status === 'void' && <Badge tone="danger">Void</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular">{money(order.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-lg p-1.5 text-muted transition hover:bg-cream-200 hover:text-ink"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelect(order)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-line/60 md:hidden">
            {filtered.slice(0, limit).map((order) => (
              <button
                key={order.id}
                onClick={() => onSelect(order)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-100 text-[11px] font-bold text-muted">
                  #{order.number.toString().slice(-2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold">
                    #{order.number} · {customerName(order.customerId) ?? 'Guest'}
                    {order.status === 'recorded' && <Badge tone="warning" className="ml-1.5">Recorded</Badge>}
                  </div>
                  {order.tableName && <div className="text-[10px] font-semibold text-accent-foreground">{order.tableName}</div>}
                  <div className="truncate text-[10.5px] text-muted">
                    {order.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12.5px] font-bold tabular">{money(order.total)}</div>
                  <div className="text-[10px] text-muted">{fmtTime(order.createdAt)}</div>
                </div>
              </button>
            ))}
          </div>

          {filtered.length > limit && (
            <div className="border-t border-line/70 p-3 text-center">
              <Button variant="secondary" size="sm" onClick={onLoadMore}>
                Load {Math.min(25, filtered.length - limit)} more
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

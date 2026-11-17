import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  HandCoins,
  Lock,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react'
import type { Customer, LedgerEntry, Order } from '../../../../types'
import { Avatar, Button, Drawer, Segmented } from '../../../../components/ui'
import { cn, cycleLabel, fmtDate, fmtDateTime, money, nextDueLabel } from '../../../../lib/utils'
import { orderNumberLabel } from '../../../../lib/orderNumber'

type Props = {
  customer: Customer | null
  balance: number
  activity: LedgerEntry[]
  orders: Order[]
  detailTab: 'ledger' | 'orders'
  onDetailTabChange: (tab: 'ledger' | 'orders') => void
  canManageCustomers: boolean
  canSettle: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onStartOrder: (customerId: string) => void
  onSettle: (customerId: string) => void
}

export default function CustomerDetailsDrawer({
  customer,
  balance,
  activity,
  orders,
  detailTab,
  onDetailTabChange,
  canManageCustomers,
  canSettle,
  onClose,
  onEdit,
  onDelete,
  onStartOrder,
  onSettle,
}: Props) {
  return (
    <Drawer
      open={!!customer}
      onClose={onClose}
      width="max-w-2xl"
      title={customer?.name}
      subtitle={customer ? `Regular since ${fmtDate(customer.createdAt)}` : ''}
      footer={
        customer ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {canManageCustomers ? (
                <>
                  <Button variant="secondary" size="sm" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" /> Edit profile
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                  <Lock className="h-3 w-3" /> Profile management is permission-controlled
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="md" onClick={() => onStartOrder(customer.id)}>
                <Plus className="h-4 w-4" /> New order
              </Button>
              {canSettle && balance > 0 && (
                <Button size="md" onClick={() => onSettle(customer.id)}>
                  <HandCoins className="h-4 w-4" /> Take payment
                </Button>
              )}
              {!canSettle && balance > 0 && (
                <span className="text-[11px] text-muted">Ask an admin to record the payment.</span>
              )}
            </div>
          </div>
        ) : null
      }
    >
      {customer && (
        <div className="space-y-5 p-5">
          <div className="rounded-2xl bg-espresso-900 p-5 text-cream-50">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  Outstanding balance
                </div>
                <div className="mt-1 text-[32px] font-extrabold tracking-tight tabular">
                  {money(balance)}
                </div>
                <div className="mt-1 text-[11.5px] text-white/45">
                  Credit limit {money(customer.limit)}
                </div>
              </div>
              <Avatar name={customer.name} size="lg" className="bg-white/10 text-white" />
            </div>
            {customer.limit > 0 && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full',
                    balance > customer.limit ? 'bg-red-400' : 'bg-accent-foreground',
                  )}
                  style={{ width: `${Math.min(100, (balance / customer.limit) * 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-white p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                <Phone className="h-3 w-3" /> Phone
              </div>
              <div className="mt-1 text-[12.5px] font-semibold">{customer.phone || '—'}</div>
            </div>
            <div className="rounded-xl border border-line bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Orders</div>
              <div className="mt-1 text-[12.5px] font-semibold">{orders.length}</div>
            </div>
            <div className="rounded-xl border border-line bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Lifetime</div>
              <div className="mt-1 text-[12.5px] font-semibold tabular">
                {money(
                  orders
                    .filter((order) => order.status === 'completed')
                    .reduce((total, order) => total + order.total, 0),
                )}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-white p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                <CalendarClock className="h-3 w-3" /> Settlement
              </div>
              <div className="mt-1 text-[12.5px] font-semibold">{cycleLabel(customer.cycle)}</div>
              <div className="text-[10px] text-muted">{nextDueLabel(customer.cycle)}</div>
            </div>
          </div>

          {customer.notes && (
            <div className="rounded-xl bg-brand-amber-soft px-3.5 py-2.5 text-[12px] text-brand-navy">
              {customer.notes}
            </div>
          )}

          <Segmented
            value={detailTab}
            onChange={onDetailTabChange}
            size="sm"
            options={[
              { value: 'ledger', label: 'Tab activity' },
              { value: 'orders', label: 'Orders' },
            ]}
          />

          {detailTab === 'ledger' ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              {activity.length === 0 ? (
                <p className="py-10 text-center text-[12.5px] text-muted">No tab activity yet.</p>
              ) : (
                <div className="divide-y divide-line/60">
                  {activity.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg',
                          entry.type === 'payment'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-cream-100 text-accent-foreground',
                        )}
                      >
                        {entry.type === 'payment' ? (
                          <ArrowDownRight className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-ink">
                          {entry.creditAdjustment
                            ? 'Credit from voided order'
                            : entry.type === 'payment'
                              ? 'Payment received'
                              : 'Charge added'}
                          {entry.note ? ` · ${entry.note}` : ''}
                        </div>
                        <div className="text-[10.5px] text-muted">
                          {fmtDateTime(entry.createdAt)}
                          {entry.staffName ? ` · ${entry.staffName}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={cn(
                            'text-[12.5px] font-bold tabular',
                            entry.creditAdjustment
                              ? 'text-sky-600'
                              : entry.type === 'payment'
                                ? 'text-emerald-600'
                                : 'text-ink',
                          )}
                        >
                          {entry.creditAdjustment ? '+' : entry.type === 'payment' ? '−' : '+'}
                          {money(entry.amount)}
                        </div>
                        {entry.method && (
                          <div className="text-[9.5px] uppercase text-muted">{entry.method}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              {orders.length === 0 ? (
                <p className="py-10 text-center text-[12.5px] text-muted">No orders yet.</p>
              ) : (
                <div className="divide-y divide-line/60">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-100 text-[10.5px] font-bold text-muted">
                        #{order.number.toString().slice(-2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold">Order #{orderNumberLabel(order)}</div>
                        <div className="truncate text-[10.5px] text-muted">
                          {fmtDateTime(order.createdAt)} ·{' '}
                          {order.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[12.5px] font-bold tabular">{money(order.total)}</div>
                        <div className="text-[9.5px] uppercase text-muted">
                          {order.paymentMethod === 'credit' ? 'tab' : order.paymentMethod}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}

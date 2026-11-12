import { useState } from 'react'
import { ArrowRight, CreditCard, ReceiptText } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AdminDashboardData } from '../../../lib/dashboard'
import { fmtTime, money, nextDueLabel, relative } from '../../../lib/utils'
import { useApp } from '../../../store/AppStore'
import { useToast } from '../../../components/toast'
import { Badge } from '../../../components/ui'
import { DataTable } from '../../../components/dashboard/DataTable'
import { EmptyState } from '../../../components/dashboard/EmptyState'
import { SectionCard } from '../../../components/dashboard/SectionCard'
import SettleModal from '../customers/components/SettleModal'

export function TopTabsAndOrders({ data }: { data: AdminDashboardData }) {
  const { db, settleCredit } = useApp()
  const { push } = useToast()
  const [settleId, setSettleId] = useState<string | null>(null)
  const target = db.customers.find((customer) => customer.id === settleId) ?? null
  const targetBalance = data.debtors.find((customer) => customer.customerId === settleId)?.balance ?? 0

  const settle = (amount: number, method: 'cash' | 'card', note: string) => {
    if (!target) return
    const result = settleCredit(target.id, amount, method, note)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`${money(amount)} received from ${target.name}`, 'success')
    setSettleId(null)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard
        icon={CreditCard}
        tone="rose"
        title="Top tabs to collect"
        subtitle="Customers with the highest balances"
        action={<Link to="/admin/customers" className="text-[11px] font-bold text-accent-foreground hover:underline">View all</Link>}
        bodyClassName="pb-2"
      >
        <DataTable
          rows={data.debtors}
          rowKey={(row) => row.customerId}
          empty={<EmptyState icon={CreditCard} title="No unpaid tabs" description="Outstanding customer balances will appear here." />}
          columns={[
            { key: 'name', header: 'Customer', render: (row) => <span className="font-bold text-ink">{row.name}</span> },
            { key: 'balance', header: 'Balance', render: (row) => <span className="font-bold tabular">{money(row.balance)}</span> },
            { key: 'due', header: 'Due', render: (row) => <span className="text-muted">{nextDueLabel(row.cycle)}</span> },
            { key: 'action', header: '', className: 'text-right', render: (row) => <button type="button" onClick={() => setSettleId(row.customerId)} className="rounded-lg bg-[var(--semantic-green-solid)] px-2.5 py-1.5 text-[10px] font-bold text-white hover:brightness-110 focus-visible:ring-2 focus-visible:ring-brand-amber-focus">Collect</button> },
          ]}
        />
      </SectionCard>
      <SectionCard
        icon={ReceiptText}
        tone="blue"
        title="Recent orders"
        subtitle="Latest transactions"
        action={<Link to="/admin/orders" className="inline-flex items-center gap-1 text-[11px] font-bold text-accent-foreground hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>}
        bodyClassName="px-4 pb-3 sm:px-5"
      >
        {data.recentOrders.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No orders yet" description="Completed transactions will appear here." action={{ label: 'Start a sale', href: '/pos' }} />
        ) : (
          <div className="divide-y divide-line/70">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center gap-2.5 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-[10px] font-extrabold text-brand-navy">#{order.number.toString().slice(-2)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[11.5px] font-bold">Order #{order.number}</span>
                    <Badge tone={order.status === 'void' ? 'danger' : order.paymentMethod === 'credit' ? 'accent' : 'success'}>
                      {order.status === 'void' ? 'Void' : order.paymentMethod === 'credit' ? 'Tab' : 'Paid'}
                    </Badge>
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-muted">{order.staffName} · {relative(order.createdAt)} · {fmtTime(order.createdAt)}</div>
                </div>
                <span className="text-[11.5px] font-bold tabular">{money(order.total)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      {target && (
        <SettleModal
          key={target.id}
          open
          onClose={() => setSettleId(null)}
          customer={target}
          balance={targetBalance}
          onSettle={settle}
        />
      )}
    </div>
  )
}

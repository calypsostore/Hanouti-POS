import { useState } from 'react'
import { ArrowUpRight, Plus, Search, Store as StoreIcon, Users, Wallet } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { PLAN_INFO } from '../../data/seed'
import type { Plan, StoreStatus } from '../../types'
import { Badge, Card, EmptyState, Input, Select, Button } from '../../components/ui'
import { StoreProfileDrawer } from './StoreProfile'
import { balanceFor } from '../../lib/selectors'
import { cn, money, sum } from '../../lib/utils'
import { useToast } from '../../components/toast'
import { NewStoreModal } from './NewStoreModal'
import { AppIcon } from '../../components/AppIcon'
import { isQuick } from '../../lib/posMode'

export default function SuperStores() {
  const { db, createStore } = useApp()
  const { push } = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | StoreStatus>('all')
  const [plan, setPlan] = useState<'all' | Plan>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [newStoreOpen, setNewStoreOpen] = useState(false)

  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)

  const rows = db.stores
    .filter((s) => status === 'all' || s.status === status)
    .filter((s) => plan === 'all' || s.plan === plan)
    .filter((s) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.ownerName.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.ownerEmail.toLowerCase().includes(q)
      )
    })
    .map((s) => {
      const orders = db.orders.filter(
        (o) => o.storeId === s.id && o.status === 'completed' && new Date(o.createdAt) >= since30,
      )
      return {
        store: s,
        revenue: sum(orders, (o) => o.total),
        orders: orders.length,
        staff: db.users.filter((u) => u.storeId === s.id).length,
        outstanding: sum(
          db.customers.filter((c) => c.storeId === s.id),
          (c) => Math.max(0, balanceFor(db.ledger, c.id)),
        ),
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  const mrr = sum(
    db.stores.filter((s) => s.status !== 'suspended'),
    (s) => PLAN_INFO[s.plan].price,
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Stores</h2>
          <p className="mt-1 text-[13px] text-muted">
            Every café on the platform, with a complete profile behind each card.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setNewStoreOpen(true)}>
            <Plus className="h-4 w-4" /> New store
          </Button>
          <div className="rounded-xl border border-line bg-white px-3 py-2 text-right">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">Stores</div>
            <div className="text-[14px] font-extrabold leading-tight">{db.stores.length}</div>
          </div>
          <div className="rounded-xl border border-line bg-white px-3 py-2 text-right">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">MRR</div>
            <div className="text-[14px] font-extrabold leading-tight tabular">{money(mrr)}</div>
          </div>
        </div>
      </div>

      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by store, owner, city or code…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="h-9 w-[140px] text-[12.5px]"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Select
            value={plan}
            onChange={(e) => setPlan(e.target.value as typeof plan)}
            className="h-9 w-[130px] text-[12.5px]"
          >
            <option value="all">All plans</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
          </Select>
          {(status !== 'all' || plan !== 'all' || query) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus('all')
                setPlan('all')
                setQuery('')
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<StoreIcon className="h-5 w-5" />}
            title="No stores match"
            description="Try a different search or clear the filters."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ store, revenue, orders, staff, outstanding }) => (
            <button
              key={store.id}
              onClick={() => setSelected(store.id)}
              className="group rounded-2xl border border-line/80 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-accent-foreground/40 hover:shadow-[0_8px_24px_rgba(17,27,48,0.08)]"
            >
              <div className="flex items-start gap-3">
                {store.logo
                  ? <img src={store.logo} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                  : <AppIcon name={store.icon} color={store.iconColor} size={20} className="h-11 w-11 rounded-xl" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-bold text-ink">{store.name}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted/40 transition group-hover:text-accent-foreground" />
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    {store.city} · {store.ownerName}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <StatusBadge status={store.status} />
                    <Badge tone="neutral">{PLAN_INFO[store.plan].label}</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 divide-x divide-line/60 rounded-xl bg-cream-50 py-2">
                <div className="px-2 text-center">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">30d rev</div>
                  <div className="mt-0.5 text-[12px] font-bold tabular">{money(revenue)}</div>
                </div>
                <div className="px-2 text-center">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">Orders</div>
                  <div className="mt-0.5 text-[12px] font-bold tabular">{orders}</div>
                </div>
                <div className="px-2 text-center">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">Team</div>
                  <div className="mt-0.5 text-[12px] font-bold tabular">{staff}</div>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Wallet className="h-3.5 w-3.5" /> {money(outstanding)} tabs
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Users className="h-3.5 w-3.5" />
                  {isQuick(store) ? 'Quick order' : 'Cashier'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <StoreProfileDrawer storeId={selected} onClose={() => setSelected(null)} />
      <NewStoreModal
        open={newStoreOpen}
        onClose={() => setNewStoreOpen(false)}
        onSave={async (data) => {
          const result = await createStore(data)
          if (result.ok) push('Store created; its administrator can sign in to complete setup.')
          else push(result.error, 'error')
          return result
        }}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: StoreStatus }) {
  const map = {
    active: { tone: 'success' as const, label: 'Active' },
    trial: { tone: 'info' as const, label: 'Trial' },
    suspended: { tone: 'danger' as const, label: 'Suspended' },
  }
  const { tone, label } = map[status]
  return (
    <Badge tone={tone}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'active' ? 'bg-emerald-500' : status === 'trial' ? 'bg-sky-500' : 'bg-red-500',
        )}
      />
      {label}
    </Badge>
  )
}

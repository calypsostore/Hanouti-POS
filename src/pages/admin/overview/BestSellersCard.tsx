import { Award } from 'lucide-react'
import type { AdminDashboardData } from '../../../lib/dashboard'
import { money } from '../../../lib/utils'
import { EmptyState } from '../../../components/dashboard/EmptyState'
import { SectionCard } from '../../../components/dashboard/SectionCard'

export function BestSellersCard({ data }: { data: AdminDashboardData }) {
  const maxQty = Math.max(0, ...data.topProducts.map((item) => item.qty))
  return (
    <SectionCard icon={Award} tone="amber" title="Best sellers" subtitle="Top five products · last 30 days" bodyClassName="px-4 pb-4 sm:px-5">
      {data.topProducts.length === 0 ? (
        <EmptyState icon={Award} title="No sales yet" description="Product performance will appear after your first sale." />
      ) : (
        <div className="space-y-3">
          {data.topProducts.map((product, index) => (
            <div key={product.id} className="flex items-center gap-2.5">
              <span className="w-4 text-[10px] font-bold text-muted">{String(index + 1).padStart(2, '0')}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tint text-xs font-extrabold text-brand-navy">{product.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11.5px] font-bold">{product.name}</span>
                  <span className="shrink-0 text-[10px] font-semibold text-muted">{product.qty} sold</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream-100 dark:bg-espresso-900">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-navy to-brand-amber" style={{ width: `${maxQty ? (product.qty / maxQty) * 100 : 0}%` }} />
                </div>
              </div>
              <span className="text-[10.5px] font-bold tabular">{money(product.revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

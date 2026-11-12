import { AlertTriangle, Package, PackageX } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AdminDashboardData } from '../../../lib/dashboard'
import { AlertPill } from '../../../components/dashboard/AlertPill'
import { SectionCard } from '../../../components/dashboard/SectionCard'

export function StockAlertsCard({ data }: { data: AdminDashboardData }) {
  if (!data.trackedProducts) return null
  const products = [...data.outOfStock.slice(0, 3), ...data.lowStock.slice(0, 3)].slice(0, 5)
  return (
    <SectionCard
      icon={PackageX}
      tone="rose"
      title="Stock alerts"
      subtitle="Inventory requiring attention"
      action={<Link to="/admin/products" className="text-[11px] font-bold text-accent-foreground hover:underline">Open products</Link>}
      bodyClassName="px-4 pb-4 sm:px-5"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <AlertPill icon={AlertTriangle} tone="amber" label="Low stock" count={data.lowStockCount} />
        <AlertPill icon={Package} tone="rose" label="Out of stock" count={data.outOfStockCount} />
      </div>
      {products.length === 0 ? <p className="rounded-xl bg-cream-100 px-3 py-4 text-center text-xs text-muted">All tracked products are stocked.</p> : (
        <div className="divide-y divide-line/70">
          {products.map((product) => (
            <div key={product.id} className="flex items-center gap-2.5 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tint text-[12px] font-extrabold text-brand-navy">{product.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{product.name}</span>
              <span className={product.stock <= 0 ? 'rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300' : 'rounded-full bg-brand-amber-soft px-2 py-1 text-[10px] font-bold text-brand-navy'}>
                {product.stock <= 0 ? 'Out of stock' : `${product.stock} left`}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

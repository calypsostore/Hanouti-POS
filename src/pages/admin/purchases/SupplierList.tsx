import { Truck } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '../../../components/ui'
import type { Purchase, Supplier } from '../../../types'

export default function SupplierList({
  suppliers,
  purchases,
  onEdit,
  onToggle,
}: {
  suppliers: Supplier[]
  purchases: Purchase[]
  onEdit: (supplier: Supplier) => void
  onToggle: (supplier: Supplier) => void
}) {
  if (!suppliers.length) return <EmptyState icon={<Truck className="h-6 w-6" />} title="No suppliers found" description="Add suppliers to organize incoming stock and payments." />
  return <Card className="overflow-x-auto">
    <table className="w-full min-w-[620px] text-left text-sm">
      <thead className="bg-cream-100/70 text-[10px] uppercase tracking-wide text-muted">
        <tr><th className="px-4 py-3 font-bold">Supplier</th><th className="px-3 py-3 font-bold">Contact</th><th className="px-3 py-3 font-bold">Purchases</th><th className="px-3 py-3 font-bold">Status</th><th className="px-4 py-3 text-right font-bold">Actions</th></tr>
      </thead>
      <tbody className="divide-y divide-line/60">
        {suppliers.map((supplier) => <tr key={supplier.id}>
          <td className="px-4 py-3"><div className="font-semibold text-ink">{supplier.name}</div><div className="text-xs text-muted">{supplier.address}</div></td>
          <td className="px-3 py-3 text-xs text-muted">{supplier.phone || supplier.email || '—'}</td>
          <td className="px-3 py-3 text-muted">{purchases.filter((purchase) => purchase.supplierId === supplier.id).length}</td>
          <td className="px-3 py-3"><Badge tone={supplier.active ? 'success' : 'neutral'}>{supplier.active ? 'Active' : 'Inactive'}</Badge></td>
          <td className="px-4 py-3"><div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(supplier)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => onToggle(supplier)}>{supplier.active ? 'Deactivate' : 'Activate'}</Button>
          </div></td>
        </tr>)}
      </tbody>
    </table>
  </Card>
}

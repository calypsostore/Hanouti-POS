import { Image, Pencil, Truck, Wallet, XCircle } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '../../../components/ui'
import { formatInventoryQuantity } from '../../../lib/inventory'
import { purchaseBalance } from '../../../lib/purchases'
import { fmtDate } from '../../../lib/utils'
import type { InventoryItem, Purchase, PurchasePayment } from '../../../types'

export default function PurchaseList({
  purchases,
  payments,
  inventoryItems,
  onEdit,
  onPay,
  onVoid,
}: {
  purchases: Purchase[]
  payments: PurchasePayment[]
  inventoryItems: InventoryItem[]
  onEdit: (purchase: Purchase) => void
  onPay: (purchase: Purchase) => void
  onVoid: (purchase: Purchase) => void
}) {
  if (!purchases.length) return <EmptyState icon={<Truck className="h-6 w-6" />} title="No purchases found" description="Received purchases and supplier payments will appear here." />
  return (
    <div className="space-y-3">
      {purchases.map((purchase) => {
        const balance = purchaseBalance(purchase.subtotal, purchase.paidAmount)
        const canEdit = purchase.status === 'received' && purchase.paidAmount === 0 &&
          !payments.some((payment) => payment.purchaseId === purchase.id)
        const purchasePayments = payments.filter((payment) => payment.purchaseId === purchase.id)
        return (
          <Card key={purchase.id} className="overflow-hidden">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink">{purchase.supplierName}</span>
                    <Badge tone={purchase.status === 'void' ? 'danger' : balance === 0 ? 'success' : 'warning'}>
                      {purchase.status === 'void' ? 'Voided' : balance === 0 ? 'Paid' : 'Balance due'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {purchase.invoiceNumber || 'No invoice'} · {fmtDate(purchase.receivedAt)} · {purchase.lines.length} line{purchase.lines.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="min-w-24 text-right">
                  <div className="font-extrabold text-ink">{purchase.subtotal.toFixed(3)} TND</div>
                  {purchase.status === 'received' && <div className="text-xs text-muted">{balance.toFixed(3)} due</div>}
                </div>
                <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
                  {purchase.status === 'received' && balance > 0 && <Button size="sm" variant="secondary" onClick={() => onPay(purchase)}><Wallet className="h-3.5 w-3.5" /> Pay</Button>}
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => onEdit(purchase)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
                  {purchase.status === 'received' && purchase.paidAmount === 0 && <Button size="sm" variant="ghost" onClick={() => onVoid(purchase)}><XCircle className="h-3.5 w-3.5" /> Void</Button>}
                </div>
              </summary>
              <div className="border-t border-line/70 bg-cream-50/60 p-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead className="text-muted">
                      <tr><th className="py-2 font-semibold">Item</th><th className="py-2 font-semibold">Packages</th><th className="py-2 font-semibold">Received</th><th className="py-2 text-right font-semibold">Cost / package</th><th className="py-2 text-right font-semibold">Line total</th></tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {purchase.lines.map((line) => {
                        const item = inventoryItems.find((candidate) => candidate.id === line.inventoryItemId)
                        return <tr key={line.id}>
                          <td className="py-2 font-semibold text-ink">{line.itemName}<div className="text-muted">{line.packageLabel}</div></td>
                          <td className="py-2 text-muted">{line.packageCount}</td>
                          <td className="py-2 text-muted">{formatInventoryQuantity(line.baseQuantity, item?.baseUnit ?? 'piece')}</td>
                          <td className="py-2 text-right text-muted">{line.unitCost.toFixed(3)} TND</td>
                          <td className="py-2 text-right font-semibold text-ink">{line.lineTotal.toFixed(3)} TND</td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </div>
                {purchase.note && <p className="mt-3 text-xs text-muted">{purchase.note}</p>}
                {purchase.receiptImage && <a href={purchase.receiptImage} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-700"><Image className="h-3.5 w-3.5" /> View receipt image</a>}
                {purchasePayments.length > 0 && <div className="mt-3 space-y-1">
                  <div className="text-xs font-bold text-ink">Payments</div>
                  {purchasePayments.map((payment) => <div key={payment.id} className="text-xs text-muted">
                    {fmtDate(payment.createdAt)} · {payment.method.replace('_', ' ')} · {payment.amount.toFixed(3)} TND · {payment.userName}{payment.note ? ` · ${payment.note}` : ''}
                  </div>)}
                </div>}
              </div>
            </details>
          </Card>
        )
      })}
    </div>
  )
}

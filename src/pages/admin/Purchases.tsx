import { useState } from 'react'
import { Plus, Truck } from 'lucide-react'
import { Button, EmptyState } from '../../components/ui'
import CsvExportButton from '../../components/data/CsvExportButton'
import DataToolbar from '../../components/data/DataToolbar'
import { useToast } from '../../components/toast'
import { purchaseBalance } from '../../lib/purchases'
import { fmtDate } from '../../lib/utils'
import { useApp } from '../../store/AppStore'
import type { Purchase, Supplier } from '../../types'
import type { PurchaseInput, SupplierInput } from '../../store/types'
import PurchaseEditor from './purchases/PurchaseEditor'
import PurchaseList from './purchases/PurchaseList'
import PurchasePaymentModal from './purchases/PurchasePaymentModal'
import SupplierEditor from './purchases/SupplierEditor'
import SupplierList from './purchases/SupplierList'
import VoidPurchaseModal from './purchases/VoidPurchaseModal'

type Tab = 'purchases' | 'suppliers'

export default function Purchases() {
  const {
    db,
    store,
    addSupplier,
    updateSupplier,
    addPurchase,
    updatePurchase,
    recordPurchasePayment,
    voidPurchase,
  } = useApp()
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>('purchases')
  const [query, setQuery] = useState('')
  const [purchaseEditor, setPurchaseEditor] = useState<Purchase | 'new' | null>(null)
  const [supplierEditor, setSupplierEditor] = useState<Supplier | 'new' | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<Purchase | null>(null)
  const [voidTarget, setVoidTarget] = useState<Purchase | null>(null)
  const [showVoided, setShowVoided] = useState(false)

  if (!store) return null
  const suppliers = db.suppliers.filter((supplier) => supplier.storeId === store.id)
  const activeSuppliers = suppliers.filter((supplier) => supplier.active)
  const inventoryItems = db.inventoryItems.filter((item) => item.storeId === store.id)
  const purchases = db.purchases.filter((purchase) => purchase.storeId === store.id)
  const filteredPurchases = purchases.filter((purchase) => {
    if (!showVoided && purchase.status === 'void') return false
    const text = `${purchase.supplierName} ${purchase.invoiceNumber}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const filteredSuppliers = suppliers.filter((supplier) =>
    `${supplier.name} ${supplier.phone} ${supplier.email}`.toLowerCase().includes(query.trim().toLowerCase()),
  ).sort((a, b) => a.name.localeCompare(b.name))

  const savePurchase = (data: PurchaseInput) => {
    const result = purchaseEditor && purchaseEditor !== 'new'
      ? updatePurchase(purchaseEditor.id, data)
      : addPurchase(store.id, data)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(purchaseEditor && purchaseEditor !== 'new' ? 'Purchase updated' : 'Purchase received')
    setPurchaseEditor(null)
  }

  const saveSupplier = (data: SupplierInput) => {
    const result = supplierEditor && supplierEditor !== 'new'
      ? updateSupplier(supplierEditor.id, data)
      : addSupplier(store.id, data)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(supplierEditor && supplierEditor !== 'new' ? 'Supplier updated' : 'Supplier added')
    setSupplierEditor(null)
  }

  const savePayment = (data: Parameters<typeof recordPurchasePayment>[1]) => {
    if (!paymentTarget) return
    const result = recordPurchasePayment(paymentTarget.id, data)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Supplier payment recorded')
    setPaymentTarget(null)
  }

  const confirmVoid = (reason: string) => {
    if (!voidTarget) return
    const result = voidPurchase(voidTarget.id, reason)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Purchase voided and stock reversed')
    setVoidTarget(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight">Purchases</h1>
          <p className="mt-1 text-[13px] text-muted">Receive supplier goods, track cost, and record payments.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === 'purchases' ? 'primary' : 'secondary'} onClick={() => setTab('purchases')}>
            <Truck className="h-4 w-4" /> Purchases
          </Button>
          <Button variant={tab === 'suppliers' ? 'primary' : 'secondary'} onClick={() => setTab('suppliers')}>
            Suppliers
          </Button>
          {tab === 'purchases'
            ? <Button onClick={() => setPurchaseEditor('new')} disabled={!activeSuppliers.length || !inventoryItems.some((item) => item.active)}>
                <Plus className="h-4 w-4" /> Receive purchase
              </Button>
            : <Button onClick={() => setSupplierEditor('new')}><Plus className="h-4 w-4" /> Add supplier</Button>}
        </div>
      </div>

      <DataToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder={tab === 'purchases' ? 'Search supplier or invoice…' : 'Search suppliers…'}
      >
        {tab === 'purchases' && (
          <>
            <CsvExportButton
              filename="purchases.csv"
              rows={[
                ['Supplier', 'Invoice', 'Received', 'Status', 'Subtotal (TND)', 'Paid (TND)', 'Balance (TND)'],
                ...filteredPurchases.map((purchase) => [
                  purchase.supplierName,
                  purchase.invoiceNumber,
                  fmtDate(purchase.receivedAt),
                  purchase.status,
                  purchase.subtotal,
                  purchase.paidAmount,
                  purchaseBalance(purchase.subtotal, purchase.paidAmount),
                ]),
              ]}
            />
            <Button size="sm" variant="secondary" onClick={() => setShowVoided((current) => !current)}>
              {showVoided ? 'Hide voided' : 'Show voided'}
            </Button>
          </>
        )}
      </DataToolbar>

      {tab === 'purchases' ? (
        activeSuppliers.length && inventoryItems.some((item) => item.active)
          ? <PurchaseList
              purchases={filteredPurchases}
              payments={db.purchasePayments.filter((payment) => payment.storeId === store.id)}
              inventoryItems={inventoryItems}
              onEdit={(purchase) => setPurchaseEditor(purchase)}
              onPay={(purchase) => setPaymentTarget(purchase)}
              onVoid={(purchase) => setVoidTarget(purchase)}
            />
          : <EmptyState
              icon={<Truck className="h-6 w-6" />}
              title="Set up purchases"
              description="Add an active supplier and at least one active inventory item before receiving stock."
              action={<div className="flex flex-wrap justify-center gap-2">
                {!activeSuppliers.length && <Button onClick={() => { setTab('suppliers'); setSupplierEditor('new') }}><Plus className="h-4 w-4" /> Add supplier</Button>}
              </div>}
            />
      ) : <SupplierList suppliers={filteredSuppliers} purchases={purchases} onEdit={setSupplierEditor} onToggle={(supplier) => {
        const result = updateSupplier(supplier.id, { active: !supplier.active })
        if (!result.ok) push(result.error, 'error')
        else push(supplier.active ? 'Supplier deactivated' : 'Supplier activated')
      }} />}

      {purchaseEditor && (
        <PurchaseEditor
          key={purchaseEditor === 'new' ? 'new-purchase' : purchaseEditor.id}
          purchase={purchaseEditor === 'new' ? undefined : purchaseEditor}
          suppliers={activeSuppliers.map(({ id, name }) => ({ id, name }))}
          inventoryItems={inventoryItems}
          onClose={() => setPurchaseEditor(null)}
          onSave={savePurchase}
          onImageError={(message) => push(message, 'error')}
        />
      )}
      {supplierEditor && (
        <SupplierEditor
          key={supplierEditor === 'new' ? 'new-supplier' : supplierEditor.id}
          supplier={supplierEditor === 'new' ? undefined : supplierEditor}
          onClose={() => setSupplierEditor(null)}
          onSave={saveSupplier}
        />
      )}
      {paymentTarget && (
        <PurchasePaymentModal
          purchase={paymentTarget}
          balance={purchaseBalance(paymentTarget.subtotal, paymentTarget.paidAmount)}
          onClose={() => setPaymentTarget(null)}
          onSave={savePayment}
        />
      )}
      {voidTarget && (
        <VoidPurchaseModal purchase={voidTarget} onClose={() => setVoidTarget(null)} onConfirm={confirmVoid} />
      )}
    </div>
  )
}

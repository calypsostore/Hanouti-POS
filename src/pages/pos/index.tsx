import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { computeTotals } from '../../lib/pricing'
import { restorePrinter } from '../../lib/printer'
import { balanceFor } from '../../lib/selectors'
import { money } from '../../lib/utils'
import type { Order, OrderChannel, PaymentMethod } from '../../types'
import { Modal } from '../../components/ui'
import { useToast } from '../../components/toast'
import { CartPanel } from './CartPanel'
import { CustomerPicker } from './CustomerPicker'
import { PaymentModal } from './PaymentModal'
import { POSHeader } from './POSHeader'
import { ProductCatalog } from './ProductCatalog'
import { ReceiptModal } from './ReceiptModal'
import { ProductOptionsModal } from './ProductOptionsModal'
import { useProductCart } from './useProductCart'

export default function POS() {
  const { user, store, db, logout, createOrder } = useApp()
  const navigate = useNavigate()
  const { push } = useToast()
  const [searchParams] = useSearchParams()
  const linkedCustomerId = searchParams.get('customer') ?? undefined

  const [categoryId, setCategoryId] = useState<string>('all')
  const [search, setSearch] = useState('')
  const productCart = useProductCart(db, store, push)
  const { cart, setCart, optionsProduct, setOptionsProduct, qtyInCart, addItem, addSelection, scanBarcode, changeQty, setLineQty } = productCart
  const [channel, setChannel] = useState<OrderChannel>(
    searchParams.get('channel') === 'dine-in' ? 'dine-in' : 'takeaway',
  )
  const [customerId, setCustomerId] = useState<string | undefined>(linkedCustomerId)
  const [discount, setDiscount] = useState(0)
  const [note, setNote] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  // Reconnect a previously authorized USB printer silently (Chrome/Edge).
  useEffect(() => {
    const baud = store?.settings.printer.baudRate ?? 9600
    void restorePrinter(baud)
  }, [store?.settings.printer.baudRate])

  useEffect(() => {
    if (linkedCustomerId) setCustomerId(linkedCustomerId)
  }, [linkedCustomerId])

  if (!user || !store) return null

  const categories = db.categories
    .filter((c) => c.storeId === store.id)
    .sort((a, b) => a.sort - b.sort)
  const products = db.products.filter(
    (p) => p.storeId === store.id && p.active && (categoryId === 'all' || p.categoryId === categoryId),
  )
  const customers = db.customers.filter((c) => c.storeId === store.id)
  const customer = customers.find((c) => c.id === customerId)
  const totals = computeTotals(cart, store.settings, discount)
  const count = cart.reduce((a, i) => a + i.qty, 0)
  const quick = store.settings.posMode === 'quick'
  const registerOpen = db.registerSessions.some((session) => session.storeId === store.id && session.status === 'open')
  const canOpenRegister = user.role === 'admin' || user.permissions.register
  const canUseCredit = store.settings.allowCredit && (user.role === 'admin' || user.permissions.credit)
  const balance = customerId ? balanceFor(db.ledger, customerId) : 0

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const resetSale = () => {
    setCart([])
    setDiscount(0)
    setNote('')
    setCustomerId(undefined)
    setChannel('takeaway')
    setPaymentOpen(false)
    setMobileCartOpen(false)
  }

  const completeSale = (method: PaymentMethod) => {
    const res = createOrder({
      items: cart,
      channel,
      paymentMethod: method,
      customerId,
      discount,
      note,
    })
    if (!res.ok) {
      push(res.error, 'error')
      return
    }
    const order = res.order
    push(`Order #${order.number} · ${money(order.total)} completed`, 'success')
    setPaymentOpen(false)
    setMobileCartOpen(false)
    resetSale()
    setReceipt(order)
  }

  const checkout = () => {
    if (!cart.length) return
    setPaymentOpen(true)
  }

  const addToTab = () => {
    if (!canUseCredit) {
      push('You do not have permission to add orders to tabs.', 'error')
      return
    }
    if (!customerId) {
      push('Select a customer first.', 'error')
      setCustomerOpen(true)
      return
    }
    completeSale('credit')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-cream-100">
      <POSHeader
        store={store}
        user={user}
        now={now}
        registerOpen={registerOpen}
        canOpenRegister={canOpenRegister}
        onLogout={() => {
          logout()
          navigate('/login')
        }}
      />

      <div className="flex min-h-0 flex-1">
        <ProductCatalog
          categories={categories}
          products={filteredProducts}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          search={search}
          setSearch={setSearch}
          channel={channel}
          setChannel={setChannel}
          store={store}
          qtyInCart={qtyInCart}
          addItem={addItem}
          onBarcodeScan={scanBarcode}
          count={count}
          total={totals.total}
          hasCartItems={cart.length > 0}
          onOpenCart={() => setMobileCartOpen(true)}
        />

        {/* Cart */}
        <aside className="hidden w-[380px] shrink-0 border-l border-line bg-cream-50 lg:flex lg:flex-col">
          <CartPanel
            cart={cart}
            channel={channel}
            setChannel={setChannel}
            customer={customer}
            customerId={customerId}
            balance={balance}
            onPickCustomer={() => setCustomerOpen(true)}
            onClearCustomer={() => setCustomerId(undefined)}
            onClear={() => {
              setCart([])
              setDiscount(0)
            }}
            changeQty={changeQty}
            setLineQty={setLineQty}
            totals={totals}
            discount={discount}
            setDiscount={setDiscount}
            canDiscount={user.permissions.discount}
            note={note}
            setNote={setNote}
            quick={quick}
            allowCredit={canUseCredit}
            onCheckout={checkout}
            onAddToTab={addToTab}
            count={count}
          />
        </aside>
      </div>

      {/* Mobile cart modal */}
      <Modal
        open={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        title="Current order"
        subtitle={`${count} item${count === 1 ? '' : 's'} · ${store.name}`}
      >
        <CartPanel
          embedded
          cart={cart}
          channel={channel}
          setChannel={setChannel}
          customer={customer}
          customerId={customerId}
          balance={balance}
          onPickCustomer={() => setCustomerOpen(true)}
          onClearCustomer={() => setCustomerId(undefined)}
          onClear={() => {
            setCart([])
            setDiscount(0)
          }}
          changeQty={changeQty}
          setLineQty={setLineQty}
          totals={totals}
          discount={discount}
          setDiscount={setDiscount}
          canDiscount={user.permissions.discount}
          note={note}
          setNote={setNote}
          quick={quick}
          allowCredit={canUseCredit}
          onCheckout={checkout}
          onAddToTab={addToTab}
          count={count}
        />
      </Modal>

      {/* Customer picker */}
      <CustomerPicker
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        customers={customers}
        ledger={db.ledger}
        selectedId={customerId}
        onSelect={(id) => {
          setCustomerId(id)
          setCustomerOpen(false)
        }}
        allowCredit={canUseCredit}
        isAdmin={user.role === 'admin'}
      />

      <ProductOptionsModal
        key={optionsProduct ? `${optionsProduct.product.id}:${optionsProduct.variantId ?? ''}` : 'none'}
        product={optionsProduct?.product ?? null}
        initialVariantId={optionsProduct?.variantId}
        onClose={() => setOptionsProduct(null)}
        onAdd={(selection) => {
          if (optionsProduct) addSelection(optionsProduct.product, selection)
          setOptionsProduct(null)
        }}
      />

      {/* Payment */}
      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        total={totals.total}
        customers={customers}
        customerId={customerId}
        setCustomerId={setCustomerId}
        ledger={db.ledger}
        allowCredit={canUseCredit}
        onConfirm={completeSale}
        orderNo={null}
      />

      {/* Receipt */}
      <ReceiptModal
        order={receipt}
        customerName={customers.find((c) => c.id === receipt?.customerId)?.name}
        onClose={() => setReceipt(null)}
      />
    </div>
  )
}

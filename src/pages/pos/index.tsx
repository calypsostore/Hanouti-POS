import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { computeTotals } from '../../lib/pricing'
import { PrintModal, type PrintJob } from '../../components/PrintPreview'
import { restorePrinter } from '../../lib/printer'
import { balanceFor } from '../../lib/selectors'
import type { Order, OrderChannel } from '../../types'
import { useToast } from '../../components/toast'
import { can } from '../../lib/permissions'
import { CustomerPicker } from './CustomerPicker'
import { PaymentModal } from './PaymentModal'
import { POSHeader } from './POSHeader'
import { POSWorkspace } from './POSWorkspace'
import { ReceiptModal } from './ReceiptModal'
import { ProductOptionsModal } from './ProductOptionsModal'
import { createPOSActions } from './posActions'
import { useProductCart } from './useProductCart'

export default function POS() {
  const {
    user, store, db, logout, createOrder, addItemsToOpenOrder, sendToKitchen, payOpenOrder,
  } = useApp()
  const navigate = useNavigate()
  const { push } = useToast()
  const [searchParams] = useSearchParams()
  const linkedCustomerId = searchParams.get('customer') ?? undefined
  const openOrderId = searchParams.get('orderId') ?? undefined
  const openOrder = db.openOrders.find((order) =>
    order.id === openOrderId && order.storeId === store?.id,
  )
  const tablePickerFocus = searchParams.get('focus') === 'table'

  const [categoryId, setCategoryId] = useState<string>('all')
  const [search, setSearch] = useState('')
  const productCart = useProductCart(db, store, push)
  const { cart, setCart, optionsProduct, setOptionsProduct, qtyInCart, addItem, addSelection, scanBarcode, changeQty, setLineQty } = productCart
  const [channel, setChannel] = useState<OrderChannel>(
    searchParams.get('channel') === 'dine-in'
      ? 'dine-in'
      : searchParams.get('channel') === 'delivery'
        ? 'delivery'
        : 'takeaway',
  )
  const [tableId, setTableId] = useState<string>()
  const [guests, setGuests] = useState<number>()
  const [customerId, setCustomerId] = useState<string | undefined>(linkedCustomerId)
  const [discount, setDiscount] = useState(0)
  const [note, setNote] = useState('')
  const [openDiscount, setOpenDiscount] = useState<number>()
  const [openNote, setOpenNote] = useState<string>()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(
    () => tablePickerFocus && window.matchMedia('(max-width: 1023px)').matches,
  )
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [kitchenJob, setKitchenJob] = useState<PrintJob | null>(null)
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

  useEffect(() => {
    if (openOrderId && !openOrder && !receipt) {
      push('This table order is no longer open.', 'error')
      navigate('/pos?channel=dine-in&focus=table', { replace: true })
    }
  }, [db.openOrders.length, navigate, openOrder, openOrderId, push, receipt])

  if (!user || !store) return null

  const categories = db.categories
    .filter((c) => c.storeId === store.id)
    .sort((a, b) => a.sort - b.sort)
  const products = db.products.filter(
    (p) => p.storeId === store.id && p.active && (categoryId === 'all' || p.categoryId === categoryId),
  )
  const customers = db.customers.filter((c) => c.storeId === store.id)
  const tables = db.tables
    .filter((table) => table.storeId === store.id && table.active)
    .sort((a, b) => a.sort - b.sort)
  const customer = customers.find((c) => c.id === customerId)
  const displayCart = openOrder ? [...openOrder.items, ...cart] : cart
  const activeDiscount = openOrder ? openDiscount ?? openOrder.discount : discount
  const activeNote = openOrder ? openNote ?? openOrder.note ?? '' : note
  const activeTableId = openOrder?.tableId ?? tableId
  const totals = computeTotals(displayCart, store.settings, activeDiscount)
  const count = displayCart.reduce((a, i) => a + i.qty, 0)
  const pendingCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const canSaveOpenOrder = !!openOrder && (
    cart.length > 0 ||
    activeDiscount !== openOrder.discount ||
    activeNote !== (openOrder.note ?? '')
  )
  const hasUnsentItems = displayCart.some((item) => !item.sentAt)
  const quick = store.settings.posMode === 'quick'
  const registerOpen = db.registerSessions.some((session) => session.storeId === store.id && session.status === 'open')
  const canOpenRegister = user.role === 'admin' || user.permissions.register
  const canUseCredit = store.settings.allowCredit && (user.role === 'admin' || user.permissions.credit)
  const balance = customerId ? balanceFor(db.ledger, customerId) : 0

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const focusTablePicker = () => {
    const picker = Array.from(document.querySelectorAll<HTMLElement>('#table-picker'))
      .find((element) => element.getClientRects().length > 0)
    picker?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const actions = createPOSActions({
    store,
    channel,
    tableId,
    guests,
    openOrder,
    cart,
    customerId,
    discount,
    note,
    activeDiscount,
    activeNote,
    canSaveOpenOrder,
    count,
    canUseCredit,
    createOrder,
    addItemsToOpenOrder,
    sendToKitchen,
    payOpenOrder,
    push,
    focusTablePicker,
    setCart,
    setDiscount,
    setOpenDiscount,
    setOpenNote,
    setChannel,
    setTableId,
    setGuests,
    setCustomerId,
    setCustomerOpen,
    setPaymentOpen,
    setMobileCartOpen,
    setReceipt,
    setKitchenJob,
  })
  const {
    clearCart, completeSale, checkout, addToTab, saveOpenChanges, sendKitchenItems,
  } = actions

  const changeChannel = (next: OrderChannel) => {
    if (openOrder) return
    setChannel(next)
    if (next !== 'dine-in') {
      setTableId(undefined)
      setGuests(undefined)
    }
  }

  const catalogProps = {
    categories,
    products: filteredProducts,
    categoryId,
    setCategoryId,
    search,
    setSearch,
    channel,
    setChannel: changeChannel,
    store,
    qtyInCart,
    addItem,
    onBarcodeScan: scanBarcode,
    count,
    total: totals.total,
    hasCartItems: displayCart.length > 0,
    onOpenCart: () => setMobileCartOpen(true),
    lockedChannel: !!openOrder,
    tableName: openOrder?.tableName,
  }
  const cartProps = {
    cart: displayCart,
    channel,
    setChannel: changeChannel,
    deliveryEnabled: store.settings.features.delivery,
    tablesEnabled: store.settings.features.tables,
    tables,
    tableId: activeTableId,
    setTableId,
    guests,
    setGuests,
    focusTablePicker: tablePickerFocus,
    customer,
    customerId,
    balance,
    onPickCustomer: () => setCustomerOpen(true),
    onClearCustomer: () => setCustomerId(undefined),
    onClear: clearCart,
    changeQty,
    setLineQty,
    totals,
    discount: activeDiscount,
    setDiscount: openOrder ? setOpenDiscount : setDiscount,
    canDiscount: user.permissions.discount,
    note: activeNote,
    setNote: openOrder ? setOpenNote : setNote,
    quick,
    allowCredit: canUseCredit,
    onCheckout: checkout,
    onAddToTab: addToTab,
    count,
    isOpenOrder: !!openOrder,
    tableName: openOrder?.tableName,
    pendingCount,
    persistedLineIds: openOrder?.items.map((item) => item.lineId ?? ''),
    canSaveOpenOrder,
    hasUnsentItems,
    onSaveOpenOrder: saveOpenChanges,
    onSendKitchen: sendKitchenItems,
    onOpenFloor: () => navigate('/pos/floor'),
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
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

      <POSWorkspace
        catalog={catalogProps}
        cart={cartProps}
        mobileCartOpen={mobileCartOpen}
        setMobileCartOpen={setMobileCartOpen}
        storeName={store.name}
      />

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
        isAdmin={can(user, 'voidOrders')}
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
        onClose={() => {
          if (openOrderId) {
            navigate('/pos', { replace: true })
            return
          }
          setReceipt(null)
        }}
      />
      <PrintModal job={kitchenJob} onClose={() => setKitchenJob(null)} />
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { computeTotals } from '../../lib/pricing'
import { PrintModal, type PrintJob } from '../../components/PrintPreview'
import { restorePrinter } from '../../lib/printer'
import { balanceFor } from '../../lib/selectors'
import type { Order, OrderChannel, OrderItem } from '../../types'
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
import { openShiftForStaff } from '../../lib/registerShifts'
import { buildStationTicketLines, buildStationTickets } from '../../lib/tickets'
import { linesToEscpos } from '../../lib/escpos'
import { Button, Field, Modal, Textarea } from '../../components/ui'
import type { OpenOrder, Station, Store } from '../../types'
import type { TicketKind } from '../../lib/tickets'

const stationTicketJob = (
  order: OpenOrder,
  items: OrderItem[],
  stations: Station[],
  store: Store,
  kind: TicketKind = 'NEW',
): PrintJob | null => {
  const tickets = buildStationTickets(order, items, stations, kind)
  if (!tickets.length) return null
  const lines = tickets.flatMap((ticket, index) => [
    ...(index ? [{ text: '' }, { text: '----------------' }] : []),
    ...buildStationTicketLines(ticket),
  ])
  return {
    title: `${kind === 'NEW' ? 'Preparation' : kind.toLowerCase()} tickets`,
    subtitle: `${tickets.length} station ticket${tickets.length === 1 ? '' : 's'} · ${order.tableName}`,
    lines,
    bytes: linesToEscpos(lines, store.settings.printer.width),
    kind: 'kitchen',
    stationTickets: tickets.map((ticket) => ({
      stationId: ticket.stationId,
      lines: buildStationTicketLines(ticket),
    })),
  }
}

export default function POS() {
  const {
    user, store, db, logout, createOrder, addItemsToOpenOrder, sendToStations, updateOpenOrderItem,
    voidSentOrderItem, payOpenOrder, recordOpenOrder,
    enqueuePrint,
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
  const [tableName, setTableName] = useState('')
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
  const [voidTarget, setVoidTarget] = useState<string>()
  const [voidReason, setVoidReason] = useState('')
  const [now, setNow] = useState(new Date())

  const dispatchStationTickets = useCallback((
    order: OpenOrder,
    items: OrderItem[],
    kind: TicketKind,
  ) => {
    if (!store || store.settings.stationTicketPrintPolicy === 'never') return
    const stations = db.stations.filter((station) => station.storeId === store.id)
    const tickets = buildStationTickets(order, items, stations, kind)
    const previewStationIds = new Set<string>()
    for (const ticket of tickets) {
      const station = stations.find((entry) => entry.id === ticket.stationId)
      const route = db.printRoutes.find((entry) =>
        entry.storeId === store.id && entry.type === 'kitchen' && entry.stationId === ticket.stationId,
      )
      const printer = db.printers.find((entry) =>
        entry.storeId === store.id && entry.enabled &&
        entry.id === (route?.printerId ?? station?.printerId),
      )
      if (store.settings.stationTicketPrintPolicy === 'automatic' && printer) {
        void enqueuePrint({
          type: 'kitchen',
          stationId: ticket.stationId,
          printerId: printer.id,
          payload: buildStationTicketLines(ticket),
        }).then((result) => {
          if (result.ok) push(`${station?.name ?? 'Station'} ticket sent`, 'success')
          else push(result.error, 'error')
        })
      } else {
        previewStationIds.add(ticket.stationId)
      }
    }
    if (previewStationIds.size) {
      const previewItems = items.filter((item) => item.stationId && previewStationIds.has(item.stationId))
      const job = stationTicketJob(
        order,
        previewItems,
        stations.filter((station) => previewStationIds.has(station.id)),
        store,
        kind,
      )
      if (job) setKitchenJob(job)
    }
  }, [db.printRoutes, db.printers, db.stations, enqueuePrint, push, store])

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

  useEffect(() => {
    if (!openOrder || !store) return
    const discountValue = openDiscount ?? openOrder.discount
    const noteValue = openNote ?? openOrder.note ?? ''
    const changed = cart.length > 0 || discountValue !== openOrder.discount || noteValue !== (openOrder.note ?? '')
    if (!changed) return
    const lineIds = new Set(cart.map((item) => item.lineId).filter((id): id is string => !!id))
    const timeout = window.setTimeout(() => {
      const result = addItemsToOpenOrder(openOrder.id, cart, discountValue, noteValue)
      if (!result.ok) {
        push(result.error, 'error')
        return
      }
      if (lineIds.size) setCart((items) => items.filter((item) => !lineIds.has(item.lineId ?? '')))
      setOpenDiscount(undefined)
      setOpenNote(undefined)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [addItemsToOpenOrder, cart, openDiscount, openNote, openOrder, push, setCart, store])

  useEffect(() => {
    if (!openOrder || !store || store.settings.ticketSendPolicy === 'done_only') return
    const pending = openOrder.items.filter((item) => item.status === 'draft' && item.stationId)
    if (!pending.length) return
    const latestAddedAt = Math.max(...pending.map((item) => Date.parse(item.addedAt ?? openOrder.updatedAt)))
    const delaySeconds = store.settings.ticketSendPolicy === 'instant'
      ? 0
      : store.settings.ticketSendPolicy === 'delayed'
        ? store.settings.ticketDelaySeconds
        : store.settings.ticketIdleSeconds
    const remaining = Math.max(0, latestAddedAt + delaySeconds * 1000 - Date.now())
    const timeout = window.setTimeout(() => {
      const result = sendToStations(openOrder.id)
      if (!result.ok) {
        push(result.error, 'error')
        return
      }
      dispatchStationTickets(
        result.order,
        result.items,
        openOrder.items.some((item) => item.sentAt || (item.status !== 'draft' && item.status !== 'void'))
          ? 'ADDITION'
          : 'NEW',
      )
    }, remaining)
    return () => window.clearTimeout(timeout)
  }, [dispatchStationTickets, db.stations, openOrder, push, sendToStations, store])

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
  const sections = db.sections
    .filter((section) => section.storeId === store.id && section.active)
    .sort((a, b) => a.sort - b.sort)
  const openTables = db.openOrders.filter((order) => order.storeId === store.id)
  const customer = customers.find((c) => c.id === customerId)
  const displayCart = openOrder ? [...openOrder.items, ...cart] : cart
  const activeDiscount = openOrder ? openDiscount ?? openOrder.discount : discount
  const activeNote = openOrder ? openNote ?? openOrder.note ?? '' : note
  const activeTableId = openOrder?.tableId ?? tableId
  const activeTableName = openOrder?.tableName ??
    tables.find((table) => table.id === tableId)?.name ??
    tableName
  const activeSectionId = openOrder?.sectionId ??
    tables.find((table) => table.id === activeTableId)?.sectionId
  const activeSectionName = sections.find((section) => section.id === activeSectionId)?.name ??
    openOrder?.sectionName
  const billableCart = displayCart.filter((item) => item.status !== 'void')
  const totals = computeTotals(billableCart, store.settings, activeDiscount)
  const count = billableCart.reduce((a, i) => a + i.qty, 0)
  const pendingCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const canSaveOpenOrder = !!openOrder && (
    cart.length > 0 ||
    activeDiscount !== openOrder.discount ||
    activeNote !== (openOrder.note ?? '')
  )
  const quick = store.settings.posMode === 'quick'
  const registerOpen = !!openShiftForStaff(db, store.id, user.id)
  const canOpenRegister = can(user, 'openShift')
  const canUseCredit = store.settings.allowCredit && (user.role === 'admin' || user.permissions.credit)
  const balance = customerId ? balanceFor(db.ledger, customerId) : 0
  const changeOpenItemQty = (lineId: string, delta: number) => {
    const order = openOrder
    const savedItem = order?.items.find((item) => item.lineId === lineId)
    if (!order || !savedItem) {
      changeQty(lineId, delta)
      return
    }
    if (savedItem.status !== 'draft') return
    const result = updateOpenOrderItem(order.id, lineId, { qty: Math.max(0, savedItem.qty + delta) })
    if (!result.ok) push(result.error, 'error')
  }
  const setOpenItemQty = (lineId: string, qty: number) => {
    const order = openOrder
    const savedItem = order?.items.find((item) => item.lineId === lineId)
    if (!order || !savedItem) {
      setLineQty(lineId, qty)
      return
    }
    if (savedItem.status !== 'draft') return
    const result = updateOpenOrderItem(order.id, lineId, { qty })
    if (!result.ok) push(result.error, 'error')
  }
  const confirmVoidSentItem = () => {
    if (!openOrder || !voidTarget) return
    const result = voidSentOrderItem(openOrder.id, voidTarget, voidReason)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    dispatchStationTickets(result.order, [result.item], 'CANCELLED')
    push('Sent item voided; a cancellation ticket is ready to print.', 'success')
    setVoidTarget(undefined)
    setVoidReason('')
  }

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
    tableName: activeTableName,
    guests,
    openOrder,
    quick,
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
    sendToStations,
    dispatchStationTickets,
    payOpenOrder,
    recordOpenOrder,
    push,
    focusTablePicker,
    setCart,
    setDiscount,
    setOpenDiscount,
    setOpenNote,
    setChannel,
    setTableId,
    setTableName,
    setGuests,
    setCustomerId,
    setCustomerOpen,
    setPaymentOpen,
    setMobileCartOpen,
    setReceipt,
    navigateToFloor: () => navigate('/pos/floor'),
  })
  const {
    clearCart, completeSale, checkout, addToTab, doneOpenOrder,
  } = actions

  const changeChannel = (next: OrderChannel) => {
    if (openOrder) return
    setChannel(next)
    if (next !== 'dine-in') {
      setTableId(undefined)
      setTableName('')
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
    sections,
    openTables,
    tableMode: store.settings.tableMode,
    guestRequirement: store.settings.guestRequirement,
    tableId: activeTableId,
    setTableId,
    tableNameInput: openOrder ? '' : tableName,
    setTableNameInput: setTableName,
    guests: openOrder?.guests ?? guests,
    setGuests,
    focusTablePicker: tablePickerFocus,
    customer,
    customerId,
    balance,
    onPickCustomer: () => setCustomerOpen(true),
    onClearCustomer: () => setCustomerId(undefined),
    onClear: clearCart,
    changeQty: changeOpenItemQty,
    setLineQty: setOpenItemQty,
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
    tableName: activeTableName,
    sectionName: activeSectionName,
    ownerStaffName: openOrder?.staffName ?? user.name,
    pendingCount,
    persistedLineIds: openOrder?.items.map((item) => item.lineId ?? ''),
    canVoidSentItems: can(user, 'voidOrders'),
    onVoidSentItem: (lineId: string) => {
      setVoidTarget(lineId)
      setVoidReason('')
    },
    onDone: doneOpenOrder,
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

      <Modal
        open={!!voidTarget}
        onClose={() => setVoidTarget(undefined)}
        title="Void sent item?"
        subtitle="A cancellation ticket will be created for the station."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVoidTarget(undefined)}>Keep item</Button>
            <Button variant="danger" disabled={!voidReason.trim()} onClick={confirmVoidSentItem}>Void sent item</Button>
          </div>
        }
      >
        <Field label="Reason">
          <Textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={240} autoFocus />
        </Field>
      </Modal>

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

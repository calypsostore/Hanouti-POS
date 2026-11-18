import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../store/AppStore'
import { computeTotals } from '../../lib/pricing'
import { PrintModal, type PrintJob } from '../../components/PrintPreview'
import { restorePrinter } from '../../lib/printer'
import { balanceFor } from '../../lib/selectors'
import type { Order, OrderChannel, OrderItem } from '../../types'
import { useToast } from '../../components/toast'
import { can, canOverrideStock } from '../../lib/permissions'
import { isQuick, modeFeatures } from '../../lib/posMode'
import { canAddOrdersToTabs } from '../../lib/customerTabs'
import { CustomerPicker } from './CustomerPicker'
import { PaymentModal } from './PaymentModal'
import { POSHeader } from './POSHeader'
import { POSWorkspace } from './POSWorkspace'
import { ReceiptModal } from './ReceiptModal'
import { ProductOptionsModal } from './ProductOptionsModal'
import { StaffItemsModal } from './StaffItemsModal'
import { createPOSActions } from './posActions'
import { useProductCart } from './useProductCart'
import { openShiftForStaff } from '../../lib/registerShifts'
import { buildStationTicketLines, buildStationTickets } from '../../lib/tickets'
import { linesToEscpos } from '../../lib/escpos'
import { filterPosProducts, shiftReminderDue as isShiftReminderDue } from '../../lib/automation'
import { isUnavailable } from '../../lib/availability'
import { enabledStaffProducts } from '../../lib/staffConsumption'
import { validateOrderLines, computeReservations, availableStock } from '../../shared/orderRules'
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import type { OpenOrder, Product, ProductVariant, Station, Store } from '../../types'
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
    user, store, db, logout, createOrder, addItemsToOpenOrder, sendToStations, updateOpenOrderItem, updateProduct,
    verifyAuthorizationPin,
    voidSentOrderItem, payOpenOrder, recordOpenOrder,
    enqueuePrint,
  } = useApp()
  const navigate = useNavigate()
  const { push } = useToast()
  const [searchParams] = useSearchParams()
  const linkedCustomerId = searchParams.get('customer') ?? undefined
  const currentShift = store && user ? openShiftForStaff(db, store.id, user.id) : undefined
  const registerOpen = !!currentShift
  const openOrderId = searchParams.get('orderId') ?? undefined
  const openOrder = db.openOrders.find((order) =>
    order.id === openOrderId && order.storeId === store?.id,
  )
  const tablePickerFocus = searchParams.get('focus') === 'table'

  const [categoryId, setCategoryId] = useState<string>('all')
  const [search, setSearch] = useState('')
  const productCart = useProductCart(db, store, user, push, registerOpen, verifyAuthorizationPin)
  const {
    cart, setCart, optionsProduct, setOptionsProduct, qtyInCart, addItem, addSelection, scanBarcode, changeQty, setLineQty,
    stockPrompt, resolveStockPrompt, cancelStockPrompt,
  } = productCart
  const [reviewOpen, setReviewOpen] = useState(false)
  const [overridePin, setOverridePin] = useState('')
  const [overrideBusy, setOverrideBusy] = useState(false)
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
  const [staffItemsOpen, setStaffItemsOpen] = useState(false)
  const [eightySixListOpen, setEightySixListOpen] = useState(false)
  const [eightySixTarget, setEightySixTarget] = useState<Product | null>(null)
  const [eightySixReason, setEightySixReason] = useState('')
  const [eightySixReturnMode, setEightySixReturnMode] = useState<Store['settings']['availability']['defaultReturnMode']>('manual')
  const [eightySixBackAt, setEightySixBackAt] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(
    () => tablePickerFocus && window.matchMedia('(max-width: 1023px)').matches,
  )
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [kitchenJob, setKitchenJob] = useState<PrintJob | null>(null)
  const [voidTarget, setVoidTarget] = useState<string>()
  const [voidReason, setVoidReason] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    if (store && !openOrder && isQuick(store) && channel !== 'takeaway') {
      setChannel('takeaway')
      setTableId(undefined)
      setTableName('')
      setGuests(undefined)
    } else if (store && !openOrder && !modeFeatures(store).tablesFloor && channel === 'dine-in') {
      setChannel('takeaway')
      setTableId(undefined)
      setTableName('')
      setGuests(undefined)
    }
  }, [channel, openOrder, store])

  const dispatchStationTickets = useCallback((
    order: OpenOrder,
    items: OrderItem[],
    kind: TicketKind,
  ) => {
    if (!store) return
    if (!modeFeatures(store).kitchenStations) return
    const stations = db.stations.filter((station) => station.storeId === store.id)
    const tickets = buildStationTickets(order, items, stations, kind)
    if (!tickets.length) return
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
        const preview = station
          ? stationTicketJob(order, ticket.items, [station], store, kind)
          : null
        void enqueuePrint({
          type: 'kitchen',
          stationId: ticket.stationId,
          printerId: printer.id,
          payload: buildStationTicketLines(ticket),
        }).then((result) => {
          if (result.ok) {
            push('Ticket printed', 'success')
          } else {
            push(result.error, 'error')
            if (preview) setKitchenJob({ ...preview, reprint: true })
          }
        }).catch((error: unknown) => {
          push(error instanceof Error ? error.message : 'Ticket printing failed.', 'error')
          if (preview) setKitchenJob({ ...preview, reprint: true })
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
      if (job) {
        setKitchenJob(job)
        push('Ticket preview is ready.', 'info')
      }
    }
  }, [db.printRoutes, db.printers, db.stations, enqueuePrint, push, setKitchenJob, store])

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  // Reconnect a previously authorized USB printer silently (Chrome/Edge).
  useEffect(() => {
    if (!store?.settings.automation.autoReconnectPrinters) return
    const baud = store?.settings.printer.baudRate ?? 9600
    let active = true
    let reconnecting = false
    const reconnect = async () => {
      if (!active || reconnecting) return
      reconnecting = true
      try {
        await restorePrinter(baud)
      } finally {
        reconnecting = false
      }
    }
    void reconnect()
    const timer = window.setInterval(() => void reconnect(), 15_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [store?.settings.automation.autoReconnectPrinters, store?.settings.printer.baudRate])

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
      if (lineIds.size) setCart(cart.filter((item) => !lineIds.has(item.lineId ?? '')))
      setOpenDiscount(undefined)
      setOpenNote(undefined)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [addItemsToOpenOrder, cart, openDiscount, openNote, openOrder, push, setCart, store])

  useEffect(() => {
    if (!openOrder || !store || store.settings.ticketSendPolicy === 'done_only') return
    if (!modeFeatures(store).kitchenStations) return
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
  const activeCategoryProducts = db.products.filter(
    (p) => p.storeId === store.id && p.active && (categoryId === 'all' || p.categoryId === categoryId),
  )
  const products = filterPosProducts(
    activeCategoryProducts,
    store.settings.automation.hideOutOfStock,
    store.settings.availability,
    db.inventoryItems,
    store.settings.orderRules.deductIngredientsOnSale,
  )
  const visibleProductIds = new Set(products.map((product) => product.id))
  const hiddenOutOfStockCount = store.settings.automation.hideOutOfStock
    ? activeCategoryProducts.filter((product) =>
        !visibleProductIds.has(product.id) &&
        product.name.toLowerCase().includes(search.trim().toLowerCase()),
      ).length
    : 0
  const customers = db.customers.filter((c) => c.storeId === store.id)
  const eightySixProducts = db.products.filter((product) => {
    if (product.storeId !== store.id || !product.active) return false
    const inventoryItem = db.inventoryItems.find((item) => item.id === product.inventoryItemId)
    return isUnavailable(product, undefined, store.settings.availability, inventoryItem).unavailable ||
      (product.variants ?? []).some((variant) => isUnavailable(product, variant, store.settings.availability, inventoryItem).unavailable)
  })
  const tables = db.tables
    .filter((table) => table.storeId === store.id && table.active)
    .sort((a, b) => a.sort - b.sort)
  const sections = db.sections
    .filter((section) => section.storeId === store.id && section.active)
    .sort((a, b) => a.sort - b.sort)
  const openTables = db.openOrders.filter((order) => order.storeId === store.id)
  const customer = customers.find((c) => c.id === customerId)
  const displayCart = openOrder ? [...openOrder.items, ...cart] : cart
  const reservations = store
    ? computeReservations(
        db.openOrders,
        db.products,
        openOrder?.id,
        store.settings.orderRules.deductIngredientsOnSale,
      )
    : { stock: new Map<string, number>(), ingredients: new Map<string, number>() }
  const availableStockFor = (product: Product) => {
    const stockForVariant = (variant?: ProductVariant) => {
      const available = availableStock(
        product,
        variant,
        reservations,
        db.inventoryItems,
        store.settings.orderRules.deductIngredientsOnSale,
      )
      const inCurrentOrder = displayCart
        .filter((line) => line.productId === product.id && line.variantId === variant?.id)
        .reduce((sum, line) => sum + line.qty, 0)
      return Math.max(0, available - inCurrentOrder)
    }
    if (product.variants?.length) {
      const tracked = product.variants
        .map((variant) => stockForVariant(variant))
        .filter(Number.isFinite)
      return tracked.length ? Math.min(...tracked) : Number.POSITIVE_INFINITY
    }
    return stockForVariant()
  }
  const cartIssues = store
    ? validateOrderLines(displayCart, {
        store,
        products: db.products,
        inventoryItems: db.inventoryItems,
        openOrders: db.openOrders,
        excludeOpenOrderId: openOrder?.id,
        actor: { id: user.id, name: user.name, role: user.role, permissions: user.permissions, stationOnly: user.stationOnly },
        users: db.users,
      })
    : []
  const actionableIssues = cartIssues.filter((issue) => issue.lineId || issue.code === 'CREDIT_LIMIT' || issue.code === 'DISCOUNT_NOT_ALLOWED')
  const unavailableLineIds = cartIssues.flatMap((issue) =>
    issue.code === 'UNAVAILABLE_86' && issue.lineId ? [issue.lineId] : [],
  )
  const issueByLine: Record<string, string> = {}
  for (const issue of cartIssues) {
    if (!issue.lineId) continue
    if (issue.code === 'UNAVAILABLE_86') continue
    issueByLine[issue.lineId] = issue.code === 'PRICE_CHANGED'
      ? 'Price changed'
      : issue.code === 'OVER_STOCK' || issue.code === 'INGREDIENT_SHORT'
        ? `Only ${issue.data?.available ?? 0} left`
        : 'Check item'
  }
  if (store.settings.orderRules.showLowStockHints) {
    for (const line of displayCart) {
      if (!line.lineId || issueByLine[line.lineId]) continue
      const product = db.products.find((candidate) => candidate.id === line.productId)
      if (!product) continue
      const variant = product.variants?.find((candidate) => candidate.id === line.variantId)
      const remaining = availableStock(
        product,
        variant,
        reservations,
        db.inventoryItems,
        store.settings.orderRules.deductIngredientsOnSale,
      ) -
        displayCart
          .filter((candidate) => candidate.productId === product.id && candidate.variantId === variant?.id)
          .reduce((sum, candidate) => sum + candidate.qty, 0)
      if (remaining > 0 && remaining <= store.settings.lowStockThreshold) {
        issueByLine[line.lineId] = `Only ${remaining} left`
      }
    }
  }
  const blockingIssues = cartIssues.filter((issue) => issue.severity === 'block')
  const updateLineQty = (lineId: string, qty: number) => {
    const persisted = openOrder?.items.some((item) => item.lineId === lineId && item.status !== 'void')
    if (persisted && openOrder) {
      const result = updateOpenOrderItem(openOrder.id, lineId, { qty })
      if (!result.ok) push(result.error, 'error')
      return
    }
    if (qty <= 0) setCart(cart.filter((item) => item.lineId !== lineId))
    else setCart(cart.map((item) => item.lineId === lineId ? { ...item, qty } : item))
  }
  const removeLine = (lineId: string) => updateLineQty(lineId, 0)
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
  const quick = isQuick(store)
  const features = modeFeatures(store)
  const canOpenRegister = can(user, 'openShift')
  const canUseCredit = features.customerCredit && store.settings.allowCredit &&
    canAddOrdersToTabs(store, user)
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
  const updateSentItemNote = (lineId: string, note: string): boolean => {
    if (!openOrder || !store) return false
    const item = openOrder.items.find((candidate) => candidate.lineId === lineId)
    if (!item) return false
    if (item.note === note) return true
    const result = updateOpenOrderItem(openOrder.id, lineId, { note })
    if (!result.ok) {
      push(result.error, 'error')
      return false
    }
    const updatedAt = new Date().toISOString()
    const correctedItem = {
      ...item,
      note,
      updatedAt,
      noteCorrectionAt: updatedAt,
    }
    const correctedOrder = {
      ...openOrder,
      items: openOrder.items.map((candidate) => candidate.lineId === lineId ? correctedItem : candidate),
    }
    if (!correctedItem.stationId || !db.stations.some((station) =>
      station.id === correctedItem.stationId && station.storeId === store.id,
    )) {
      push(`No station assigned to ${correctedItem.name}; the note correction was not sent.`, 'error')
    } else {
      dispatchStationTickets(correctedOrder, [correctedItem], 'ADDITION')
    }
    return true
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

  const submitStaffItems = (items: OrderItem[], method: 'cash' | 'card'): boolean => {
    const result = createOrder({
      items,
      channel: 'takeaway',
      paymentMethod: method,
      staffConsumption: true,
    })
    if (!result.ok) {
      push(result.error, 'error')
      return false
    }
    setStaffItemsOpen(false)
    setReceipt(result.order)
    push('Staff items recorded and stock updated.', 'success')
    return true
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
    channel: quick ? 'takeaway' : channel,
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
    if (openOrder || quick) return
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
    hiddenOutOfStockCount,
    categoryId,
    setCategoryId,
    search,
    setSearch,
    quick,
    channel: quick ? 'takeaway' : channel,
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
    inventoryItems: db.inventoryItems,
    availableStockFor,
    onUnavailable: (message: string) => push(message, 'error'),
    canManage86: store.settings.availability.enabled && can(user, 'manage86'),
    onRequest86: (product: Product) => {
      setEightySixTarget(product)
      setEightySixReason(store.settings.availability.reasons[0] ?? '')
      setEightySixReturnMode(store.settings.availability.defaultReturnMode)
      setEightySixBackAt('')
    },
  }
  const cartProps = {
    cart: displayCart,
    channel: quick ? 'takeaway' : channel,
    setChannel: changeChannel,
    deliveryEnabled: store.settings.features.delivery,
    tablesEnabled: features.tablesFloor,
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
    canDiscount: features.payments && user.permissions.discount,
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
    unavailableLineIds,
    hasUnavailableDraft: unavailableLineIds.length > 0,
    issueByLine: store.settings.orderRules.revalidationBanner ? issueByLine : {},
    issueCount: store.settings.orderRules.revalidationBanner ? actionableIssues.length : 0,
    onReview: () => setReviewOpen(true),
    persistedLineIds: openOrder?.items.map((item) => item.lineId ?? ''),
    canVoidSentItems: can(user, 'voidOrders'),
    onVoidSentItem: (lineId: string) => {
      setVoidTarget(lineId)
      setVoidReason('')
    },
    onUpdateSentItemNote: updateSentItemNote,
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
        shiftReminderDue={!!currentShift && store.settings.automation.shiftReminders && isShiftReminderDue(
          currentShift.openedAt,
          store.settings.automation.shiftReminderHours,
          now,
        )}
        eightySixCount={eightySixProducts.length}
        onShowEightySixList={() => setEightySixListOpen(true)}
        onStaffItems={() => setStaffItemsOpen(true)}
        onLogout={() => {
          logout()
          navigate('/login')
        }}
      />

      {features.staffAllowances && <StaffItemsModal
        open={staffItemsOpen}
        onClose={() => setStaffItemsOpen(false)}
        products={enabledStaffProducts(db.products.filter((product) => product.storeId === store.id), store.settings.staffConsumption)}
        orders={db.orders}
        shiftId={currentShift?.id}
        canAutoOpenShift={user.role === 'admin' || user.role === 'manager'}
        staffId={user.id}
        settings={store.settings}
        policy={store.settings.staffConsumption}
        onSubmit={submitStaffItems}
      />}

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
        availability={store.settings.availability}
        inventoryItem={db.inventoryItems.find((item) => item.id === optionsProduct?.product.inventoryItemId)}
        onClose={() => setOptionsProduct(null)}
        onAdd={(selection) => {
          if (optionsProduct) addSelection(optionsProduct.product, selection)
          setOptionsProduct(null)
        }}
      />

      <Modal open={eightySixListOpen} onClose={() => setEightySixListOpen(false)} title={`86 list · ${eightySixProducts.length}`}>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {eightySixProducts.length === 0 ? <p className="text-sm text-muted">No unavailable items.</p> : eightySixProducts.map((product) => {
            const inventoryItem = db.inventoryItems.find((item) => item.id === product.inventoryItemId)
            const baseState = isUnavailable(product, undefined, store.settings.availability, inventoryItem)
            const state = baseState.unavailable
              ? baseState
              : (product.variants ?? []).map((variant) =>
                  isUnavailable(product, variant, store.settings.availability, inventoryItem),
                ).find((variantState) => variantState.unavailable) ?? baseState
            return (
              <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{product.name}</div>
                  <div className="text-xs text-muted">
                    {state.reason} · {db.users.find((member) => member.id === state.byId)?.name ?? 'Automatic'} · {product.eightySix?.at ?? state.since ?? 'Now'}
                  </div>
                </div>
                {can(user, 'manage86') && (product.eightySix?.active || product.variants?.some((variant) => variant.eightySix?.active)) && (
                  <Button size="sm" variant="secondary" onClick={() => {
                    const result = updateProduct(product.id, {
                      eightySix: undefined,
                      variants: product.variants?.map((variant) =>
                        variant.eightySix?.active ? { ...variant, eightySix: undefined } : variant,
                      ),
                    })
                    if (!result.ok) push(result.error, 'error')
                    else push(`${product.name} returned`)
                  }}>Back in stock</Button>
                )}
              </div>
            )
          })}
          {can(user, 'manage86') && eightySixProducts.some((product) =>
            product.eightySix?.active || product.variants?.some((variant) => variant.eightySix?.active),
          ) && (
            <Button variant="secondary" onClick={() => {
              const failures = eightySixProducts.filter((product) =>
                product.eightySix?.active || product.variants?.some((variant) => variant.eightySix?.active),
              ).map((product) => updateProduct(product.id, {
                eightySix: undefined,
                variants: product.variants?.map((variant) =>
                  variant.eightySix?.active ? { ...variant, eightySix: undefined } : variant,
                ),
              }))
                .find((result) => !result.ok)
              if (failures && !failures.ok) push(failures.error, 'error')
              else push('Manual 86 items returned')
            }}>Return all manual 86 items</Button>
          )}
        </div>
      </Modal>

      <Modal
        open={!!eightySixTarget}
        onClose={() => setEightySixTarget(null)}
        title="86 this item"
        subtitle={eightySixTarget?.name}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEightySixTarget(null)}>Cancel</Button>
            <Button
              disabled={!eightySixTarget || (store.settings.availability.requireReason && !eightySixReason) ||
                (eightySixReturnMode === 'at_time' && !eightySixBackAt)}
              onClick={() => {
                if (!eightySixTarget) return
                const result = updateProduct(eightySixTarget.id, {
                  eightySix: {
                    active: true,
                    at: new Date().toISOString(),
                    byId: user.id,
                    reason: eightySixReason,
                    returnMode: eightySixReturnMode,
                    backAt: eightySixReturnMode === 'at_time' ? new Date(eightySixBackAt).toISOString() : undefined,
                  },
                })
                if (!result.ok) push(result.error, 'error')
                else push(`${eightySixTarget.name} 86'd`)
                setEightySixTarget(null)
              }}
            >Confirm 86</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Reason">
            <div className="flex flex-wrap gap-2">
              {store.settings.availability.reasons.map((reason) => (
                <button key={reason} type="button" onClick={() => setEightySixReason(reason)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${eightySixReason === reason ? 'border-red-500 bg-red-50 text-red-700' : 'border-line text-muted'}`}>
                  {reason}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Return mode">
            <Select value={eightySixReturnMode} onChange={(event) => setEightySixReturnMode(event.target.value as typeof eightySixReturnMode)}>
              <option value="manual">Manual</option>
              <option value="on_restock">When restocked</option>
              <option value="at_time">At a time</option>
            </Select>
          </Field>
          {eightySixReturnMode === 'at_time' && (
            <Field label="Back at">
              <Input type="datetime-local" value={eightySixBackAt} onChange={(event) => setEightySixBackAt(event.target.value)} />
            </Field>
          )}
        </div>
      </Modal>

      {/* Review order issues */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={`Review (${actionableIssues.length} issue${actionableIssues.length === 1 ? '' : 's'})`}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReviewOpen(false)}>Close</Button>
            <Button disabled={blockingIssues.length > 0} onClick={() => setReviewOpen(false)}>
              {blockingIssues.length ? 'Fix issues first' : 'Continue'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          {actionableIssues.length === 0 && <p className="text-[12px] text-muted">No outstanding issues.</p>}
          {actionableIssues.map((issue, index) => (
            <div key={`${issue.code}-${issue.lineId ?? index}`} className="rounded-xl border border-line px-2.5 py-2">
              <div className="text-[12px] font-semibold text-ink">{issue.message}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {issue.lineId && (
                  <Button size="sm" variant="secondary" onClick={() => removeLine(issue.lineId!)}>Remove</Button>
                )}
                {issue.lineId && ['OVER_STOCK', 'INGREDIENT_SHORT'].includes(issue.code) &&
                  Number(issue.data?.maxQty ?? issue.data?.available ?? 0) > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateLineQty(issue.lineId!, Number(issue.data?.maxQty ?? issue.data?.available))}
                  >
                    Reduce to {Number(issue.data?.maxQty ?? issue.data?.available)}
                  </Button>
                )}
                {features.payments && issue.code === 'PRICE_CHANGED' && issue.lineId &&
                  openOrder?.items.some((item) => item.lineId === issue.lineId && item.status !== 'void') && (
                  <Button size="sm" variant="secondary" onClick={() => {
                    const lineId = issue.lineId
                    if (!lineId || !openOrder) return
                    const result = updateOpenOrderItem(openOrder.id, lineId, { useCurrentPrice: true })
                    if (!result.ok) push(result.error, 'error')
                  }}>
                    Use current price
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Over-stock confirmation */}
      <Modal
        open={!!stockPrompt}
        onClose={cancelStockPrompt}
        title="Not enough stock"
        subtitle={stockPrompt?.productName}
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={cancelStockPrompt}>Cancel</Button>
            {stockPrompt && stockPrompt.maxQty > 0 && (
              <Button
                variant="secondary"
                onClick={() => void resolveStockPrompt('reduce')}
              >
                Add {stockPrompt.ingredient ? stockPrompt.maxQty : stockPrompt.available} only
              </Button>
            )}
            <Button
              variant="danger"
              disabled={overrideBusy || (!user || !canOverrideStock(user, store.settings.orderRules)) && !overridePin.trim()}
              onClick={() => {
                setOverrideBusy(true)
                void resolveStockPrompt('override', overridePin).finally(() => {
                  setOverrideBusy(false)
                  setOverridePin('')
                })
              }}
            >
              {overrideBusy ? 'Adding…' : `Add ${stockPrompt?.requested ?? 0} anyway`}
            </Button>
          </div>
        }
      >
        {stockPrompt && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-ink">
              Only {stockPrompt.available} {stockPrompt.productName} left. Add {stockPrompt.requested} anyway?{' '}
              {stockPrompt.productName} will be 86'd.
            </p>
            {(!user || !canOverrideStock(user, store.settings.orderRules)) && (
              <Field label="Manager PIN to confirm">
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={overridePin}
                  onChange={(event) => setOverridePin(event.target.value)}
                  placeholder="Manager PIN"
                />
              </Field>
            )}
            {stockPrompt.ingredient && (
              <p className="text-[11px] text-muted">The limit comes from an ingredient in this product's recipe.</p>
            )}
          </div>
        )}
      </Modal>

      {/* Payment */}
      {features.payments && <PaymentModal
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
      />}

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
      {features.receiptPrinting && <ReceiptModal
        order={receipt}
        customerName={customers.find((c) => c.id === receipt?.customerId)?.name}
        onClose={() => {
          if (openOrderId) {
            navigate('/pos', { replace: true })
            return
          }
          setReceipt(null)
        }}
      />}
      <PrintModal job={kitchenJob} onClose={() => setKitchenJob(null)} />
    </div>
  )
}

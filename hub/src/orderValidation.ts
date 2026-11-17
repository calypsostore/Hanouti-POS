import { computeTotals } from '../../src/lib/pricing.ts'
import { round } from '../../src/lib/pricing-utils.ts'
import { balanceFor } from '../../src/lib/selectors.ts'
import { nextOrderNumber } from '../../src/lib/orderNumber.ts'
import { resolveOrderLines, stockOverrideAccepted, validateOrderLines, type OrderRulesContext } from '../../src/shared/orderRules.ts'
import type {
  DiningTable, InventoryItem, LedgerEntry, OpenOrder, Order, OrderItem, Product, Store, User,
} from '../../src/types.ts'
import { requireCapability } from './auth.ts'
import type { AuthenticatedActor, HubStoreState } from './types.ts'
import { staffConsumptionDiscount, staffConsumptionError } from '../../src/lib/staffConsumption.ts'
import { dineInTableError } from '../../src/lib/tableService.ts'
import { isQuick } from '../../src/lib/posMode.ts'
import { quickTabLimitError } from '../../src/lib/customerTabs.ts'

const VALID_ITEM_STATUSES = ['draft', 'sent', 'preparing', 'ready', 'served', 'void']
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export function validateSentItemUpdate(
  old: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  if (!['sent', 'preparing', 'ready'].includes(String(old.status))) return
  if (source.qty !== old.qty || source.price !== old.price) {
    throw new Error('Only the note of a sent item can be changed.')
  }
  if (String(source.note ?? '') !== String(old.note ?? '') &&
    (typeof source.noteCorrectionAt !== 'string' || !Number.isFinite(Date.parse(source.noteCorrectionAt)))) {
    throw new Error('A valid kitchen note correction marker is required.')
  }
}
const isDiningTableReference = (value: unknown): value is Pick<DiningTable, 'id' | 'storeId' | 'active'> =>
  isRecord(value) && typeof value.id === 'string' &&
  typeof value.storeId === 'string' && typeof value.active === 'boolean'
const isOpenOrderReference = (
  value: unknown,
): value is Pick<OpenOrder, 'id' | 'storeId' | 'tableId' | 'tableName'> =>
  isRecord(value) && typeof value.id === 'string' &&
  typeof value.storeId === 'string' && typeof value.tableName === 'string' &&
  (value.tableId === undefined || typeof value.tableId === 'string')

export function validateOrderDocument(
  input: Record<string, unknown>,
  collection: 'orders' | 'openOrders',
  state: HubStoreState,
  actor: AuthenticatedActor,
): Record<string, unknown> {
  const store = state.collections.stores?.[actor.storeId] as unknown as Store | undefined
  const user = state.collections.users?.[actor.userId]
  if (!store?.settings || !user) throw new Error('Store settings or authenticated user are unavailable.')
  const previousDocument = state.collections[collection]?.[String(input.id)]
  if (collection === 'openOrders' || (collection === 'orders' && !isRecord(previousDocument) && input.channel === 'dine-in')) {
    const paymentOrderId = typeof input.clientOrderId === 'string' && input.clientOrderId.startsWith('pay:')
      ? input.clientOrderId.slice(4)
      : undefined
    const paymentOrder = paymentOrderId
      ? state.collections.openOrders?.[paymentOrderId]
      : undefined
    const paymentMatchesTable = isOpenOrderReference(paymentOrder) &&
      paymentOrder.storeId === actor.storeId &&
      (store.settings.tableMode === 'manual'
        ? paymentOrder.tableName.trim().toLowerCase() ===
          (typeof input.tableName === 'string' ? input.tableName.trim().toLowerCase() : '')
        : paymentOrder.tableId === input.tableId)
    const excludeOpenOrderId = collection === 'openOrders'
      ? String(input.id)
      : paymentMatchesTable ? paymentOrderId : undefined
    const tableError = dineInTableError(
      store.settings,
      Object.values(state.collections.tables ?? {}).filter(isDiningTableReference),
      Object.values(state.collections.openOrders ?? {}).filter(isOpenOrderReference),
      {
        storeId: actor.storeId,
        tableId: typeof input.tableId === 'string' ? input.tableId : undefined,
        tableName: typeof input.tableName === 'string' ? input.tableName : undefined,
        excludeOpenOrderId,
      },
    )
    if (tableError) throw new Error(tableError)
  }
  const requiresOpenShift = actor.role === 'staff' && store.settings.requireShiftForOrders &&
    (collection === 'openOrders' || !isRecord(previousDocument))
  const activeShift = Object.values(state.collections.registerSessions ?? {}).find((candidate) =>
    isRecord(candidate) && candidate.storeId === actor.storeId && candidate.status === 'open' &&
    (candidate.staffId ?? candidate.openedById) === actor.userId,
  )
  if (requiresOpenShift && !activeShift) {
    throw new Error('Open your shift before taking orders.')
  }
  if (requiresOpenShift && typeof input.shiftId === 'string' && input.shiftId !== activeShift?.id) {
    throw new Error('Orders must use your own open shift.')
  }
  if ((actor.role === 'admin' || actor.role === 'manager') && typeof input.shiftId === 'string') {
    const shift = state.collections.registerSessions?.[input.shiftId]
    if (!isRecord(shift) || shift.storeId !== actor.storeId ||
      shift.status !== 'open' || (shift.staffId ?? shift.openedById) !== actor.userId) {
      throw new Error('Orders must use your own open shift.')
    }
  }
  if (input.staffConsumption !== undefined && typeof input.staffConsumption !== 'boolean') {
    throw new Error('Staff item checkout is invalid.')
  }
  const staffConsumption = collection === 'orders' && input.staffConsumption === true
  if (staffConsumption) requireCapability(actor, 'useStaffAllowances')
  const previousOrder = state.collections.orders?.[String(input.id)]
  if (isRecord(previousOrder) && Boolean(previousOrder.staffConsumption) !== staffConsumption) {
    throw new Error('Staff item classification cannot be changed after checkout.')
  }
  const validatedShiftId = requiresOpenShift ? activeShift?.id : input.shiftId
  if (!Number.isFinite(store.settings.taxRate) || store.settings.taxRate < 0 ||
    !Number.isFinite(store.settings.serviceCharge) || store.settings.serviceCharge < 0 ||
    typeof store.settings.taxInclusive !== 'boolean') {
    throw new Error('Store tax and service-charge settings are invalid.')
  }
  if (!Array.isArray(input.items) || input.items.length > 300) throw new Error('Order must contain no more than 300 items.')
  const products = Object.values(state.collections.products ?? {}) as unknown as Product[]
  const requestedItems = input.items as OrderItem[]
  if (staffConsumption) {
    if (user.stationOnly || input.channel !== 'takeaway' || input.tableId !== undefined ||
      input.tableName !== undefined || input.customerId !== undefined ||
      (input.paymentMethod !== 'cash' && input.paymentMethod !== 'card') ||
      input.staffId !== actor.userId || typeof input.shiftId !== 'string') {
      throw new Error('Staff items must be recorded for the authenticated staff member as a paid takeaway order.')
    }
    const shift = state.collections.registerSessions?.[input.shiftId]
    if (!shift || shift.status !== 'open' ||
      (shift.staffId ?? shift.openedById) !== actor.userId || shift.storeId !== actor.storeId) {
      throw new Error('Staff items require the authenticated staff member’s open shift.')
    }
  }
  const inventoryItems = Object.values(state.collections.inventoryItems ?? {}) as unknown as InventoryItem[]
  const users = Object.values(state.collections.users ?? {}) as unknown as User[]
  const openOrders = Object.values(state.collections.openOrders ?? {}) as unknown as OpenOrder[]
  const rawPermissions = user.permissions && typeof user.permissions === 'object'
    ? user.permissions as Record<string, unknown>
    : {}
  const capabilityPermissions = Object.fromEntries(
    Object.entries(rawPermissions).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  )
  const ownOpenOrder = collection === 'orders'
    ? openOrders.find((candidate) =>
        typeof input.tableId === 'string'
          ? candidate.tableId === input.tableId
          : typeof input.tableName === 'string' && candidate.tableName === input.tableName,
      )
    : undefined
  const rulesStore = staffConsumption
    ? {
        ...store,
        settings: {
          ...store.settings,
          orderRules: { ...store.settings.orderRules, deductIngredientsOnSale: true },
        },
      }
    : store
  const rulesContext: OrderRulesContext = {
    store: rulesStore,
    products: products.filter((product) => product.storeId === actor.storeId),
    inventoryItems: inventoryItems.filter((item) => item.storeId === actor.storeId),
    openOrders,
    excludeOpenOrderId: collection === 'openOrders' ? String(input.id) : ownOpenOrder?.id,
    actor: {
      id: String(user.id),
      name: String(user.name),
      role: actor.role,
      permissions: {
        discount: rawPermissions.discount === true,
        credit: rawPermissions.credit === true,
        settle: rawPermissions.settle === true,
        reports: rawPermissions.reports === true,
        register: rawPermissions.register === true,
        supervisor: rawPermissions.supervisor === true,
        ...capabilityPermissions,
        ...(staffConsumption ? { discount: true } : {}),
      },
      stationOnly: Boolean(user.stationOnly),
    },
    users,
    validateSentItems: collection === 'orders',
  }
  const previous = state.collections[collection]?.[String(input.id)]
  const previousItems = previous && Array.isArray(previous.items) ? previous.items as Array<Record<string, unknown>> : []
  const requested = requestedItems.map((item, index) => {
    const source = item as unknown as Record<string, unknown>
    const old = previousItems.find((candidate) =>
      (typeof source.lineId === 'string' && candidate.lineId === source.lineId) ||
      (!source.lineId && candidate.productId === item.productId && previousItems.indexOf(candidate) === index),
    )
    if (old) validateSentItemUpdate(old, source)
    return {
      ...item,
      lineId: typeof source.lineId === 'string'
        ? source.lineId
        : typeof old?.lineId === 'string'
          ? old.lineId
          : undefined,
      status: (source.status ?? old?.status) as OrderItem['status'],
    }
  })
  const resolved = resolveOrderLines(requested, rulesContext)
  if (!resolved.ok) throw new Error(resolved.error)
  if (staffConsumption) {
    const orders = Object.values(state.collections.orders ?? {}) as unknown as Order[]
    const issue = staffConsumptionError(
      resolved.items,
      store.settings.staffConsumption,
      orders,
      String(input.shiftId),
      actor.userId,
    )
    if (issue) throw new Error(issue)
  }
  const unconfirmed = resolved.issues.find((issue) => {
    if (issue.code !== 'OVER_STOCK' && issue.code !== 'INGREDIENT_SHORT') return false
    const line = resolved.items.find((item) => item.lineId === issue.lineId)
    return !line || !stockOverrideAccepted(line.stockOverride, line.qty, rulesContext)
  })
  if (unconfirmed) throw new Error(unconfirmed.message)

  const seenLineIds = new Set<string>()
  const categories = Object.values(state.collections.categories ?? {}) as Array<{
    id: string
    storeId: string
    stationId?: string | null
  }>
  const items = resolved.items.map((item, index) => {
    const source = requested[index] as unknown as Record<string, unknown>
    const old = previousItems.find((candidate) =>
      (typeof source.lineId === 'string' && candidate.lineId === source.lineId) ||
      (!source.lineId && candidate.productId === item.productId && previousItems.indexOf(candidate) === index),
    )
    const product = products.find((candidate) => candidate.id === item.productId && candidate.storeId === actor.storeId)
    const savedOpenLine = ownOpenOrder?.items.find((candidate) =>
      candidate.lineId === item.lineId && candidate.productId === item.productId,
    )
    const lineId = typeof source.lineId === 'string'
      ? source.lineId
      : typeof old?.lineId === 'string'
        ? old.lineId
        : typeof source.id === 'string'
          ? source.id
          : undefined
    if (collection === 'openOrders' && !lineId) throw new Error('Open-order items require a stable line ID.')
    if (lineId) {
      if (lineId.length > 128 || seenLineIds.has(lineId)) throw new Error('Order contains an invalid or duplicate line ID.')
      seenLineIds.add(lineId)
    }
    let status: unknown = source.status ?? old?.status
    if (status !== undefined && !VALID_ITEM_STATUSES.includes(String(status))) {
      throw new Error('Order contains an invalid item status.')
    }
    if (old && status !== old.status && status !== 'void') {
      throw new Error('Use the station status endpoint to change a sent item lifecycle.')
    }
    if (!old && status !== undefined && status !== 'draft' && status !== 'sent') {
      throw new Error('New order items must start as draft or sent.')
    }
    const voidReason = status === 'void' ? source.voidReason : undefined
    if (status === 'void') {
      requireCapability(actor, 'voidOrders')
      if (typeof voidReason !== 'string' || !voidReason.trim() || voidReason.length > 240) {
        throw new Error('A reason is required to void an order item.')
      }
    }
    const category = product
      ? categories.find((candidate) =>
          candidate.id === product.categoryId && candidate.storeId === actor.storeId,
        )
      : undefined
    const stationId = (product?.stationId === null ? undefined : product?.stationId ?? category?.stationId) ?? undefined
    if (typeof stationId === 'string' && !state.collections.stations?.[stationId]) {
      throw new Error('Product routing references an unavailable station.')
    }
    return {
      ...item,
      ...(collection === 'orders' && store.settings.orderRules.openOrderPricePolicy !== 'current' &&
        savedOpenLine ? { price: savedOpenLine.price } : {}),
      id: lineId,
      lineId,
      stationId,
      status: status as OrderItem['status'],
      sentAt: status === 'sent'
        ? (typeof old?.sentAt === 'string' ? old.sentAt : new Date().toISOString())
        : typeof old?.sentAt === 'string' ? old.sentAt : undefined,
      noteCorrectionAt: typeof source.noteCorrectionAt === 'string' && Number.isFinite(Date.parse(source.noteCorrectionAt))
        ? source.noteCorrectionAt
        : typeof old?.noteCorrectionAt === 'string' ? old.noteCorrectionAt : undefined,
      addedAt: typeof old?.addedAt === 'string' ? old.addedAt : new Date().toISOString(),
      addedById: typeof old?.addedById === 'string' ? old.addedById : actor.userId,
      addedByName: typeof old?.addedByName === 'string' ? old.addedByName : String(user.name),
      voidReason: typeof voidReason === 'string' ? voidReason : undefined,
    }
  })
  const requestedDiscount = staffConsumption
    ? staffConsumptionDiscount(items, store.settings, store.settings.staffConsumption)
    : input.discount === undefined ? 0 : input.discount
  if (typeof requestedDiscount !== 'number' || !Number.isFinite(requestedDiscount) || requestedDiscount < 0) {
    throw new Error('Order discount must be a non-negative amount.')
  }
  const discount = round(requestedDiscount)
  let creditCustomer: { id: string; limit: number; balance: number } | undefined
  if (collection === 'orders') {
    if (!['cash', 'card', 'credit', 'unpaid'].includes(String(input.paymentMethod))) {
      throw new Error('Order payment method is invalid.')
    }
    if (input.paymentMethod === 'credit') {
      if (!store.settings.allowCredit || typeof input.customerId !== 'string') {
        throw new Error('Credit sales require credit to be enabled and a customer selected.')
      }
      requireCapability(actor, isQuick(store) ? 'addToTabs' : 'credit')
      const customer = state.collections.customers?.[input.customerId]
      if (!customer || customer.storeId !== actor.storeId) {
        throw new Error('Order customerId must reference an entity in this store.')
      }
      const creditLimit = Number(customer.limit)
      if (!Number.isFinite(creditLimit) || creditLimit < 0) {
        throw new Error('Customer credit limit is invalid.')
      }
      const ledger = Object.values(state.collections.ledger ?? {}) as unknown as LedgerEntry[]
      creditCustomer = {
        id: String(customer.id),
        limit: creditLimit,
        balance: balanceFor(ledger, String(customer.id)),
      }
    }
  }
  const payableItems = items.filter((item) => item.status !== 'void')
  const totals = computeTotals(payableItems, store.settings, discount)
  if (collection === 'orders' && input.paymentMethod === 'credit' && isQuick(store) && creditCustomer) {
    const rawLimit = user.tabCreditLimit
    if (rawLimit !== undefined && (typeof rawLimit !== 'number' || !Number.isFinite(rawLimit) || rawLimit < 0)) {
      throw new Error('Staff tab credit limit is invalid.')
    }
    const limitError = quickTabLimitError({
      role: actor.role,
      tabCreditLimit: typeof rawLimit === 'number' ? rawLimit : 0,
    }, creditCustomer.balance, totals.total)
    if (limitError) throw new Error(limitError)
  }
  if (discount > round(totals.subtotal + totals.service)) throw new Error('Order discount exceeds the order amount.')
  const checkoutIssues = validateOrderLines(payableItems, {
    ...rulesContext,
    validateSentItems: collection === 'orders',
    payWithCredit: true,
    discount,
    estimatedTotal: totals.total,
    customer: creditCustomer,
  })
  const checkoutBlocker = checkoutIssues.find((issue) => issue.severity === 'block')
  if (checkoutBlocker) throw new Error(checkoutBlocker.message)
  const checkoutOverride = checkoutIssues.find((issue) =>
    (issue.code === 'OVER_STOCK' || issue.code === 'INGREDIENT_SHORT') &&
    !stockOverrideAccepted(
      items.find((item) => item.lineId === issue.lineId)?.stockOverride,
      items.find((item) => item.lineId === issue.lineId)?.qty ?? 0,
      rulesContext,
    ),
  )
  if (checkoutOverride) throw new Error(checkoutOverride.message)

  const existingDocument = state.collections[collection]?.[String(input.id)]
  const matchingOpenOrder = collection === 'orders'
    ? ownOpenOrder
    : undefined
  const existingNumber = existingDocument && Number.isSafeInteger(Number(existingDocument.number)) &&
    Number(existingDocument.number) > 0
    ? Number(existingDocument.number)
    : matchingOpenOrder && Number.isSafeInteger(Number(matchingOpenOrder.number)) &&
      Number(matchingOpenOrder.number) > 0
      ? Number(matchingOpenOrder.number)
      : 0
  const usedNumbers = [
    ...Object.values(state.collections.orders ?? {}),
    ...Object.values(state.collections.openOrders ?? {}),
  ]
    .filter((candidate) => candidate.id !== input.id && candidate.id !== matchingOpenOrder?.id)
    .map((candidate) => Number(candidate.number))
    .filter((value) => Number.isSafeInteger(value) && value > 0)
  const requestedNumber = Number(input.number)
  const rules = store.settings.orderRules
  let number: number
  if (existingNumber > 0) {
    number = existingNumber
  } else {
    if (Number.isSafeInteger(requestedNumber) && requestedNumber > 0 && usedNumbers.includes(requestedNumber)) {
      throw new Error('Order number is already in use in this store.')
    }
    number = nextOrderNumber(usedNumbers, rules?.orderNumberFormat ?? 'plain')
  }
  for (const [field, collectionName] of [
    ['tableId', 'tables'], ['sectionId', 'sections'], ['customerId', 'customers'], ['shiftId', 'registerSessions'],
  ] as const) {
    const reference = input[field]
    if (reference !== undefined && (typeof reference !== 'string' || state.collections[collectionName]?.[reference]?.storeId !== actor.storeId)) {
      throw new Error(`Order ${field} must reference an entity in this store.`)
    }
  }
  if (collection === 'orders' && input.status === 'void') requireCapability(actor, 'voidOrders')
  return {
    ...input,
    shiftId: validatedShiftId,
    items,
    number,
    discount: round(discount),
    ...totals,
    taxRate: store.settings.taxRate,
    staffConsumption: staffConsumption || undefined,
    staffId: typeof previous?.staffId === 'string' ? previous.staffId : actor.userId,
    staffName: typeof previous?.staffName === 'string' ? previous.staffName : String(user.name),
    createdAt: typeof previous?.createdAt === 'string' ? previous.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

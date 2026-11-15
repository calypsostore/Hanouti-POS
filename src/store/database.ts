import type {
  Advance, Attendance, AuditAction, AuditEntity, AuditJsonValue, AuditLog, AuditRole, BusinessType,
  Category, Customer, Database, DiningTable, Expense, IconColor, IconName, InventoryItem,
  InventoryUnit, Order, OpenOrder, OrderModifier, PaymentMethod, Payroll, Product, ProductModifierGroup,
  ProductVariant, Purchase, PurchasePayment, RegisterItemRow, RegisterReportDetails, RegisterSession,
  SaleUnit, Shift, Station, StockMovement,
  Store, StoreSettings, Supplier, TableOrderEvent, TableSection, User,
} from '../types'
import { ICON_NAMES } from '../types'
import { normalizePayrollSettings, normalizePrinter, normalizeUser } from '../lib/defaults'
import { hashRandomSecret, hashSecret, isSecretHash } from '../lib/hash'
import { businessTemplate } from '../lib/businessTemplates'
import { readIndexedValue } from '../lib/storage'
import { isValidUsername } from '../lib/staff'
import { isAccentPalette } from '../lib/theme'
import { round } from '../lib/pricing-utils'

export const DB_KEY = '7anouti.db.v26'
const INDEXED_DB_MIGRATION_KEYS = ['7anouti.db.v25', '7anouti.db.v24', '7anouti.db.v23', '7anouti.db.v22', '7anouti.db.v21', '7anouti.db.v20', '7anouti.db.v19', '7anouti.db.v18', '7anouti.db.v17', '7anouti.db.v16', '7anouti.db.v15', '7anouti.db.v14', '7anouti.db.v13', '7anouti.db.v12', '7anouti.db.v11', '7anouti.db.v10']
const LEGACY_DB_KEYS = [
  '7anouti.db.v25', '7anouti.db.v24', '7anouti.db.v23', '7anouti.db.v22', '7anouti.db.v21', '7anouti.db.v20', '7anouti.db.v19', '7anouti.db.v18', '7anouti.db.v17', '7anouti.db.v16', '7anouti.db.v15', '7anouti.db.v14', '7anouti.db.v13', '7anouti.db.v12', '7anouti.db.v11', '7anouti.db.v10', '7anouti.db.v9', '7anouti.db.v8',
  'cafepos.db.v8', 'cafepos.db.v7', 'cafepos.db.v6',
]
export const SESSION_KEY = '7anouti.session.v2'
export const LEGACY_SESSION_KEYS = ['cafepos.session.v2']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isDateKey = (value: string) => {
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) &&
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}
const LEGACY_EMOJI_ICONS: Record<string, IconName> = {
  '☕': 'Coffee', '🧁': 'Cake', '🥐': 'Croissant', '🍰': 'Cake',
  '🥤': 'CupSoda', '🍽️': 'Utensils', '🌿': 'Leaf', '🍵': 'Coffee',
  '🫖': 'Coffee', '🫘': 'Package', '🧃': 'CupSoda', '🥪': 'Sandwich',
  '🍟': 'Utensils', '🥗': 'Salad', '🍞': 'Croissant', '🎂': 'Cake',
  '🍪': 'Cookie', '🍩': 'Cake', '🛒': 'ShoppingBasket', '🧹': 'Wrench',
  '🧴': 'Flower2', '💇': 'Scissors', '💅': 'Star', '✨': 'Sparkles',
  '🍋': 'Apple', '🍊': 'Apple', '🍓': 'Apple', '🍫': 'Cookie',
  '🫓': 'Sandwich', '🥚': 'Utensils', '🍗': 'Beef', '💧': 'CupSoda',
  '🧊': 'CupSoda', '🥖': 'Croissant', '🥧': 'Cake', '🐟': 'Fish',
  '🍲': 'Soup', '🥦': 'Salad', '🫒': 'Apple', '🌴': 'Leaf',
  '🧻': 'Package', '💨': 'Sparkles', '🧖': 'Flower2', '✂️': 'Scissors',
}
const isIconName = (value: unknown): value is IconName =>
  typeof value === 'string' && ICON_NAMES.some((name) => name === value)
const isIconColor = (value: unknown): value is IconColor =>
  value === 'green' || value === 'blue' || value === 'amber' || value === 'rose' ||
  value === 'violet' || value === 'teal' || value === 'slate' || value === 'orange'
const iconFromLegacyEmoji = (value: unknown, fallback: IconName): IconName =>
  typeof value === 'string' ? LEGACY_EMOJI_ICONS[value] ?? fallback : fallback
const legacyEmoji = (record: object): unknown => Reflect.get(record, 'emoji')
const withoutLegacyEmoji = <T extends object>(record: T): Omit<T, 'emoji'> => {
  const cleaned = { ...record } as T & { emoji?: unknown }
  delete cleaned.emoji
  return cleaned as Omit<T, 'emoji'>
}
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  value === 'cash' || value === 'card' || value === 'credit' || value === 'unpaid'
const normalizeRegisterItem = (value: unknown): RegisterItemRow | undefined => {
  if (
    !isRecord(value) ||
    typeof value.key !== 'string' ||
    typeof value.productId !== 'string' ||
    typeof value.category !== 'string' ||
    typeof value.name !== 'string' ||
    !isFiniteNumber(value.qty) || value.qty <= 0 ||
    typeof value.soldByWeight !== 'boolean' ||
    (value.saleUnit !== undefined && !isSaleUnit(value.saleUnit)) ||
    (value.unitPrice !== null && (!isFiniteNumber(value.unitPrice) || value.unitPrice < 0)) ||
    !isFiniteNumber(value.total) || value.total < 0
  ) return undefined
  return {
    key: value.key,
    productId: value.productId,
    variantId: typeof value.variantId === 'string' ? value.variantId : undefined,
    category: value.category,
    name: value.name,
    qty: value.qty,
    soldByWeight: value.soldByWeight,
    saleUnit: value.saleUnit,
    unitPrice: value.unitPrice,
    total: value.total,
  }
}
const normalizeReportDetails = (value: unknown): RegisterReportDetails | undefined => {
  if (!isRecord(value)) return undefined
  const isAmount = (candidate: unknown): candidate is number =>
    isFiniteNumber(candidate) && candidate >= 0
  const taxBreakdown = Array.isArray(value.taxBreakdown)
    ? value.taxBreakdown.flatMap((row) =>
        isRecord(row) &&
        (row.rate === null || (isFiniteNumber(row.rate) && row.rate >= 0)) &&
        isAmount(row.amount)
          ? [{ rate: row.rate as number | null, amount: row.amount }]
          : [],
      )
    : null
  const byEmployee = Array.isArray(value.byEmployee)
    ? value.byEmployee.flatMap((row) =>
        isRecord(row) && typeof row.name === 'string' &&
        Number.isSafeInteger(row.count) && Number(row.count) >= 0 && isAmount(row.total)
          ? [{ name: row.name.slice(0, 100), count: Number(row.count), total: row.total }]
          : [],
      )
    : null
  const byCategory = Array.isArray(value.byCategory)
    ? value.byCategory.flatMap((row) =>
        isRecord(row) && typeof row.name === 'string' &&
        isAmount(row.qty) && isAmount(row.total)
          ? [{ name: row.name.slice(0, 100), qty: row.qty, total: row.total }]
          : [],
      )
    : null
  const itemsSold = Array.isArray(value.itemsSold)
    ? value.itemsSold.flatMap((row) => {
        const item = normalizeRegisterItem(row)
        return item ? [item] : []
      })
    : undefined
  const recordedItems = Array.isArray(value.recordedItems)
    ? value.recordedItems.flatMap((row) => {
        const item = normalizeRegisterItem(row)
        return item ? [item] : []
      })
    : undefined
  const voidedItems = Array.isArray(value.voidedItems)
    ? value.voidedItems.flatMap((row) => {
        if (!isRecord(row) || typeof row.voidedByName !== 'string') return []
        const item = normalizeRegisterItem(row)
        return item ? [{ ...item, voidedByName: row.voidedByName }] : []
      })
    : undefined
  const voidedOrders = Array.isArray(value.voidedOrders)
    ? value.voidedOrders.flatMap((row) =>
        isRecord(row) && Number.isSafeInteger(row.number) && isAmount(row.total) &&
        isPaymentMethod(row.paymentMethod) &&
        typeof row.reason === 'string' && Array.isArray(row.items) &&
        row.items.every((item) => typeof item === 'string')
          ? [{
              number: Number(row.number),
              total: row.total,
              paymentMethod: row.paymentMethod,
              reason: row.reason.slice(0, 240),
              items: row.items.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 120)),
            }]
          : [],
      )
    : null
  const cancelledItems = Array.isArray(value.cancelledItems)
    ? value.cancelledItems.flatMap((row) =>
        isRecord(row) && typeof row.tableName === 'string' &&
        isAmount(row.total) && Array.isArray(row.items) &&
        row.items.every((item) => typeof item === 'string')
          ? [{
              tableName: row.tableName.slice(0, 100),
              total: row.total,
              items: row.items.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 120)),
            }]
          : [],
      )
    : null
  if (
    typeof value.storeName !== 'string' || typeof value.storeAddress !== 'string' ||
    typeof value.storeCity !== 'string' || typeof value.storePhone !== 'string' ||
    (value.receiptWidth !== 58 && value.receiptWidth !== 80) ||
    !isAmount(value.grossSales) || !isAmount(value.netSales) ||
    !Number.isSafeInteger(value.completedOrders) || Number(value.completedOrders) < 0 ||
    !Number.isSafeInteger(value.totalTransactions) || Number(value.totalTransactions) < 0 ||
    !isAmount(value.storeCreditRefunds) || !isAmount(value.cashReceived) ||
    !isAmount(value.cashExpenses) || !isAmount(value.supplierCashPayments) ||
    !taxBreakdown || !byEmployee || !byCategory || !voidedOrders || !cancelledItems
  ) return undefined
  return {
    storeName: value.storeName.slice(0, 100),
    storeAddress: value.storeAddress.slice(0, 240),
    storeCity: value.storeCity.slice(0, 100),
    storePhone: value.storePhone.slice(0, 40),
    receiptWidth: value.receiptWidth,
    grossSales: value.grossSales,
    netSales: value.netSales,
    completedOrders: Number(value.completedOrders),
    totalTransactions: Number(value.totalTransactions),
    storeCreditRefunds: value.storeCreditRefunds,
    cashReceived: value.cashReceived,
    cashExpenses: value.cashExpenses,
    supplierCashPayments: value.supplierCashPayments,
    taxBreakdown,
    byEmployee,
    byCategory,
    itemsSold,
    recordedItems,
    voidedItems,
    voidedOrders,
    cancelledItems,
  }
}
const normalizeTableHistory = (value: unknown): TableOrderEvent[] =>
  Array.isArray(value)
    ? value.slice(-10_000).flatMap((event) =>
        isRecord(event) &&
        typeof event.id === 'string' &&
        ['opened', 'items_added', 'items_removed', 'guests_changed', 'moved', 'merged', 'transferred', 'payment', 'closed', 'voided'].includes(String(event.type)) &&
        typeof event.actorId === 'string' &&
        typeof event.actorName === 'string' &&
        typeof event.at === 'string' &&
        Number.isFinite(Date.parse(event.at))
          ? [{
              id: event.id,
              type: event.type as TableOrderEvent['type'],
              actorId: event.actorId,
              actorName: event.actorName.slice(0, 100),
              at: event.at,
              details: typeof event.details === 'string' ? event.details.slice(0, 240) : undefined,
            }]
          : [],
      )
    : []
const auditActions: AuditAction[] = [
  'created', 'edited', 'deleted', 'voided', 'discount_applied', 'refund_applied',
  'debt_payment', 'activated', 'deactivated', 'pin_reset', 'register_opened',
  'register_closed', 'settings_updated', 'login_success', 'login_failure', 'logout', 'demo_reset',
  'app_updated', 'backup_exported', 'backup_imported',
  'inventory_opening', 'stock_adjusted', 'waste_recorded', 'stock_counted',
]
const auditEntities: AuditEntity[] = [
  'order', 'product', 'category', 'customer', 'staff', 'expense',
  'register', 'settings', 'auth', 'payroll', 'shift', 'table', 'inventory',
  'purchase', 'supplier',
]
const auditRoles: AuditRole[] = ['super', 'admin', 'manager', 'staff', 'unknown']
const normalizeAuditValue = (value: unknown, depth = 0): AuditJsonValue | undefined => {
  if (value === null || typeof value === 'boolean' || isFiniteNumber(value)) return value
  if (typeof value === 'string') return value.slice(0, 500)
  if (depth >= 3) return undefined
  if (Array.isArray(value)) {
    return value.slice(0, 30)
      .map((item) => normalizeAuditValue(item, depth + 1))
      .filter((item): item is AuditJsonValue => item !== undefined)
  }
  if (!isRecord(value)) return undefined
  return Object.fromEntries(
    Object.entries(value).slice(0, 30)
      .flatMap(([key, item]) => {
        const normalized = normalizeAuditValue(item, depth + 1)
        return normalized === undefined ? [] : [[key.slice(0, 80), normalized]]
      }),
  )
}
const normalizeAuditChanges = (value: unknown): Record<string, AuditJsonValue> | undefined => {
  const normalized = normalizeAuditValue(value)
  return isRecord(normalized) ? normalized as Record<string, AuditJsonValue> : undefined
}
const isAuditLog = (value: unknown): value is AuditLog =>
  isRecord(value) && typeof value.id === 'string' && typeof value.storeId === 'string' &&
  typeof value.userId === 'string' && typeof value.userName === 'string' &&
  auditRoles.includes(value.role as AuditRole) && auditActions.includes(value.action as AuditAction) &&
  auditEntities.includes(value.entity as AuditEntity) && typeof value.summary === 'string' &&
  typeof value.createdAt === 'string' &&
  (value.entityId === undefined || typeof value.entityId === 'string')
const isBusinessType = (value: unknown): value is BusinessType =>
  value === 'cafe' || value === 'restaurant' || value === 'bakery' ||
  value === 'snack' || value === 'retail' || value === 'salon'
const isSaleUnit = (value: unknown): value is SaleUnit =>
  value === 'kg' || value === 'g' || value === 'piece'
const isInventoryUnit = (value: unknown): value is InventoryUnit =>
  value === 'g' || value === 'ml' || value === 'piece'
const normalizeModifierGroup = (value: unknown): ProductModifierGroup | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' ||
      (value.selection !== 'single' && value.selection !== 'multiple') || !Array.isArray(value.options)) return null
  const options = value.options.filter((option): option is ProductModifierGroup['options'][number] =>
    isRecord(option) && typeof option.id === 'string' && typeof option.name === 'string' &&
    isFiniteNumber(option.priceDelta),
  )
  return {
    id: value.id,
    name: value.name,
    selection: value.selection,
    required: value.required === true,
    options,
  }
}
const normalizeVariant = (value: unknown): ProductVariant | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' ||
      !isFiniteNumber(value.price) || !isFiniteNumber(value.cost) || !isFiniteNumber(value.stock)) return null
  return {
    id: value.id,
    name: value.name,
    size: typeof value.size === 'string' ? value.size : undefined,
    color: typeof value.color === 'string' ? value.color : undefined,
    price: value.price,
    cost: value.cost,
    barcode: typeof value.barcode === 'string' ? value.barcode : '',
    trackStock: value.trackStock === true,
    stock: Math.max(0, value.stock),
  }
}
const isOrderModifier = (value: unknown): value is OrderModifier =>
  isRecord(value) && typeof value.groupId === 'string' && typeof value.groupName === 'string' &&
  typeof value.optionId === 'string' && typeof value.optionName === 'string' &&
  isFiniteNumber(value.priceDelta)

export const normalizeDb = (value: unknown, seed: Database): Database | null => {
  if (!isRecord(value)) return null
  const stores = Array.isArray(value.stores)
    ? value.stores.filter((s): s is Store =>
        isRecord(s) && typeof s.id === 'string' && typeof s.name === 'string' &&
        typeof s.slug === 'string' && typeof s.createdAt === 'string' &&
        (s.status === 'active' || s.status === 'trial' || s.status === 'suspended') &&
        (s.plan === 'starter' || s.plan === 'growth' || s.plan === 'pro') && isRecord(s.settings),
      )
      .map((s) => {
        const businessType = isBusinessType(s.businessType)
          ? s.businessType
          : seed.stores.find((seedStore) => seedStore.id === s.id)?.businessType ?? 'cafe'
        const template = businessTemplate(businessType)
        const legacyKitchenScreen = isRecord(s.settings.features) && typeof s.settings.features.kitchenScreen === 'boolean'
          ? s.settings.features.kitchenScreen
          : isRecord(s.settings.printer) && typeof s.settings.printer.kitchenTicket === 'boolean'
            ? s.settings.printer.kitchenTicket
            : template.features.kitchenScreen
        return ({
        ...seed.stores[0],
        ...withoutLegacyEmoji(s),
        businessType,
        setupComplete: typeof s.setupComplete === 'boolean' ? s.setupComplete : false,
        ownerName: typeof s.ownerName === 'string' ? s.ownerName : '',
        ownerEmail: typeof s.ownerEmail === 'string' ? s.ownerEmail : '',
        phone: typeof s.phone === 'string' ? s.phone : '',
        address: typeof s.address === 'string' ? s.address : '',
        city: typeof s.city === 'string' ? s.city : '',
        icon: isIconName(s.icon) ? s.icon : iconFromLegacyEmoji(legacyEmoji(s), 'Store'),
        iconColor: isIconColor(s.iconColor) ? s.iconColor : 'amber',
        logo: typeof s.logo === 'string' && s.logo.length <= 307200 ? s.logo : undefined,
        settings: {
          ...seed.stores.find((item) => item.id === s.id)?.settings ?? seed.stores[0].settings,
          ...s.settings,
          features: {
            ...template.features,
            ...(isRecord(s.settings.features) ? s.settings.features : {}),
            tables: isRecord(s.settings.features) && typeof s.settings.features.tables === 'boolean'
              ? s.settings.features.tables : template.features.tables,
            delivery: isRecord(s.settings.features) && typeof s.settings.features.delivery === 'boolean'
              ? s.settings.features.delivery : false,
            kitchenScreen: legacyKitchenScreen,
            barcode: isRecord(s.settings.features) && typeof s.settings.features.barcode === 'boolean'
              ? s.settings.features.barcode : template.features.barcode,
            weightItems: isRecord(s.settings.features) && typeof s.settings.features.weightItems === 'boolean'
              ? s.settings.features.weightItems : template.features.weightItems,
          },
          posMode: s.settings.posMode === 'quick' ? 'quick' as const : 'cashier' as const,
          currency: typeof s.settings.currency === 'string' ? s.settings.currency : 'TND',
          taxRate: isFiniteNumber(s.settings.taxRate) ? s.settings.taxRate : 0,
          taxInclusive: typeof s.settings.taxInclusive === 'boolean' ? s.settings.taxInclusive : true,
          serviceCharge: isFiniteNumber(s.settings.serviceCharge) ? s.settings.serviceCharge : 0,
          allowCredit: typeof s.settings.allowCredit === 'boolean' ? s.settings.allowCredit : true,
          requireCustomerForCredit: typeof s.settings.requireCustomerForCredit === 'boolean'
            ? s.settings.requireCustomerForCredit
            : true,
          receiptFooter: typeof s.settings.receiptFooter === 'string' ? s.settings.receiptFooter : '',
          lowStockThreshold: isFiniteNumber(s.settings.lowStockThreshold) ? s.settings.lowStockThreshold : 10,
          tableMode: s.settings.tableMode === 'tables_only'
            ? 'tables_only' as const
            : s.settings.tableMode === 'manual'
              ? 'manual' as const
              : 'sections_tables' as const,
          guestRequirement: s.settings.guestRequirement === 'optional' || s.settings.guestRequirement === 'off'
            ? s.settings.guestRequirement as 'optional' | 'off'
            : 'required' as const,
          staffPickSectionsOnShift: s.settings.staffPickSectionsOnShift === true,
          requireShiftForOrders: typeof s.settings.requireShiftForOrders === 'boolean'
            ? s.settings.requireShiftForOrders
            : s.settings.posMode !== 'quick',
          accent: isAccentPalette(s.settings.accent) ? s.settings.accent : '7anouti',
          colorMode: s.settings.colorMode === 'dark' || s.settings.colorMode === 'light' || s.settings.colorMode === 'system'
            ? s.settings.colorMode
            : 'system' as const,
          printer: normalizePrinter({
            ...(isRecord(s.settings) && isRecord(s.settings.printer)
              ? s.settings.printer as StoreSettings['printer']
              : {}),
            kitchenTicket: isRecord(s.settings.printer) && typeof s.settings.printer.kitchenTicket === 'boolean'
              ? Boolean(s.settings.printer.kitchenTicket || legacyKitchenScreen)
              : Boolean(legacyKitchenScreen),
          }),
          payroll: normalizePayrollSettings(
            isRecord(s.settings.payroll) ? s.settings.payroll as Partial<StoreSettings['payroll']> : undefined,
          ),
        },
      })})
    : []
  const normalizedUsers = Array.isArray(value.users)
    ? value.users.filter((u): u is User =>
        isRecord(u) && typeof u.id === 'string' && typeof u.name === 'string' &&
        (typeof u.email === 'string' || ((u.role === 'staff' || u.role === 'manager') && u.email === undefined)) &&
        typeof u.password === 'string' &&
        typeof u.pin === 'string' && typeof u.active === 'boolean' &&
        typeof u.createdAt === 'string' &&
        (u.storeId === null || typeof u.storeId === 'string') &&
        (u.role === 'super' || u.role === 'admin' || u.role === 'manager' || u.role === 'staff'),
      ).map((user) => {
        const seedUsername = seed.users.find((seedUser) => seedUser.id === user.id)?.username
        return normalizeUser({
          ...user,
          username: typeof user.username === 'string' ? user.username : seedUsername,
        })
      })
    : []
  const usedUsernames = new Set<string>()
  const users = normalizedUsers.map((user, index) => {
    const base = user.username ?? `user${index}`
    const storeSlug = stores.find((store) => store.id === user.storeId)?.slug ?? ''
    const storeSuffix = storeSlug.toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const storeCandidate = storeSuffix
      ? `${base.slice(0, Math.max(3, 23 - storeSuffix.length))}.${storeSuffix}`.slice(0, 24)
      : ''
    let username = [base, storeCandidate].find(
      (candidate) => isValidUsername(candidate) && !usedUsernames.has(candidate),
    )
    for (let number = 2; !username; number += 1) {
      const suffix = String(number)
      const candidate = `${base.slice(0, 24 - suffix.length)}${suffix}`
      if (isValidUsername(candidate) && !usedUsernames.has(candidate)) username = candidate
    }
    usedUsernames.add(username)
    return { ...user, username }
  })
  if (!stores.length || !users.length) return null
  const collection = <T,>(name: string, guard: (item: unknown) => item is T): T[] =>
    Array.isArray(value[name]) ? value[name].filter(guard) : []
  const hasId = (item: unknown): item is Record<string, unknown> & { id: string } =>
    isRecord(item) && typeof item.id === 'string'
  const orders = collection<Order>('orders', (item): item is Order =>
    hasId(item) && typeof item.storeId === 'string' && Array.isArray(item.items) &&
    typeof item.createdAt === 'string' && isFiniteNumber(item.total) &&
    isFiniteNumber(item.number) && isFiniteNumber(item.subtotal) &&
    isFiniteNumber(item.tax) && isFiniteNumber(item.service) &&
    isFiniteNumber(item.discount) && typeof item.staffId === 'string' &&
    typeof item.staffName === 'string' &&
    (item.status === 'completed' || item.status === 'recorded' || item.status === 'void') &&
    ((item.status === 'recorded' && item.paymentMethod === 'unpaid') ||
      (item.status !== 'recorded' &&
        (item.paymentMethod === 'cash' || item.paymentMethod === 'card' || item.paymentMethod === 'credit'))) &&
    (item.channel === 'takeaway' || item.channel === 'dine-in' || item.channel === 'delivery'),
  ).map((order) => ({
    ...order,
    taxRate: isFiniteNumber(order.taxRate) && order.taxRate >= 0 ? order.taxRate : undefined,
    tableId: typeof order.tableId === 'string' ? order.tableId : undefined,
    tableName: typeof order.tableName === 'string' ? order.tableName : undefined,
    sectionId: typeof order.sectionId === 'string' ? order.sectionId : undefined,
    sectionName: typeof order.sectionName === 'string' ? order.sectionName.slice(0, 60) : undefined,
    guests: Number.isSafeInteger(order.guests) && Number(order.guests) >= 1 && Number(order.guests) <= 50
      ? Number(order.guests)
      : undefined,
    tableHistory: normalizeTableHistory(order.tableHistory),
    ownerStaffId: typeof order.ownerStaffId === 'string' ? order.ownerStaffId : order.staffId,
    ownerStaffName: typeof order.ownerStaffName === 'string' ? order.ownerStaffName.slice(0, 100) : order.staffName,
    items: order.items.filter((item) =>
      isRecord(item) && typeof item.productId === 'string' &&
      typeof item.name === 'string' && isFiniteNumber(item.price) &&
      isFiniteNumber(item.qty) && item.qty > 0,
    ).map((item, index) => ({
      ...withoutLegacyEmoji(item),
      lineId: typeof item.lineId === 'string' ? item.lineId : `${order.id}:${index}`,
      addedById: typeof item.addedById === 'string' ? item.addedById : order.staffId,
      addedByName: typeof item.addedByName === 'string' ? item.addedByName : order.staffName,
      modifiers: Array.isArray(item.modifiers) ? item.modifiers.filter(isOrderModifier) : [],
      note: typeof item.note === 'string' ? item.note : '',
      variantId: typeof item.variantId === 'string' ? item.variantId : undefined,
      variantName: typeof item.variantName === 'string' ? item.variantName : undefined,
      saleUnit: isSaleUnit(item.saleUnit) ? item.saleUnit : undefined,
      soldByWeight: item.soldByWeight === true,
    })),
  }))
  const rawTables = collection<DiningTable & { zone?: unknown }>('tables', (item): item is DiningTable & { zone?: unknown } =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.name === 'string' &&
    item.name.trim().length > 0 && isFiniteNumber(item.seats) &&
    Number.isSafeInteger(item.seats) && item.seats >= 1 && item.seats <= 50 &&
    typeof item.active === 'boolean' && isFiniteNumber(item.sort),
  )
  const sections = collection<TableSection>('sections', (item): item is TableSection =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.name === 'string' &&
    typeof item.active === 'boolean' && isFiniteNumber(item.sort),
  ).map((section) => ({
    ...section,
    name: section.name.trim().slice(0, 60),
    color: isIconColor(section.color) ? section.color : 'amber',
    icon: isIconName(section.icon) ? section.icon : 'Utensils',
  })).filter((section) =>
    stores.some((store) => store.id === section.storeId) && section.name.length > 0,
  )
  const sectionByLegacyName = new Map<string, TableSection>()
  for (const section of sections) {
    sectionByLegacyName.set(`${section.storeId}:${section.name.toLowerCase()}`, section)
  }
  const migratedSections: TableSection[] = []
  for (const table of rawTables) {
    const zone = typeof table.zone === 'string' ? table.zone.trim().slice(0, 60) : ''
    if (table.sectionId || !zone || !stores.some((store) => store.id === table.storeId)) continue
    const key = `${table.storeId}:${zone.toLowerCase()}`
    if (sectionByLegacyName.has(key)) continue
    const section: TableSection = {
      id: `sec_migrated_${table.storeId}_${migratedSections.length + 1}`,
      storeId: table.storeId,
      name: zone,
      color: migratedSections.length % 2 === 0 ? 'blue' : 'amber',
      icon: 'Utensils',
      sort: migratedSections.filter((item) => item.storeId === table.storeId).length,
      active: true,
    }
    migratedSections.push(section)
    sectionByLegacyName.set(key, section)
  }
  const allSections = [...sections, ...migratedSections]
  const tables = rawTables.map((table) => {
    const { zone, ...withoutZone } = table
    const legacySection = typeof zone === 'string'
      ? sectionByLegacyName.get(`${table.storeId}:${zone.trim().toLowerCase()}`)
      : undefined
    const assignedSection = typeof table.sectionId === 'string'
      ? allSections.find((section) => section.id === table.sectionId && section.storeId === table.storeId)
      : legacySection
    return {
      ...withoutZone,
      name: table.name.trim().slice(0, 60),
      sectionId: assignedSection?.id,
    }
  }).filter((table, index, list) =>
    stores.some((store) => store.id === table.storeId) &&
    list.findIndex((other) =>
      other.id === table.id ||
      (other.storeId === table.storeId && other.name.toLowerCase() === table.name.toLowerCase()),
    ) === index,
  )
  const inventoryItems = collection<InventoryItem>('inventoryItems', (item): item is InventoryItem =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.name === 'string' &&
    isRecord(item) && isInventoryUnit(item.baseUnit) && typeof item.category === 'string' &&
    isFiniteNumber(item.onHand) && item.onHand >= 0 &&
    isFiniteNumber(item.reorderLevel) && item.reorderLevel >= 0 &&
    isFiniteNumber(item.avgCostPerBaseUnit) && item.avgCostPerBaseUnit >= 0 &&
    isFiniteNumber(item.lastCostPerBaseUnit) && item.lastCostPerBaseUnit >= 0 &&
    typeof item.active === 'boolean' && Array.isArray(item.packages),
  ).map((item) => ({
    ...item,
    name: item.name.trim().slice(0, 100),
    category: item.category.trim().slice(0, 60) || 'other',
    packages: item.packages.filter((pkg): pkg is InventoryItem['packages'][number] =>
      isRecord(pkg) && typeof pkg.id === 'string' && typeof pkg.label === 'string' &&
      pkg.label.trim().length > 0 && isFiniteNumber(pkg.baseQtyPerPackage) && pkg.baseQtyPerPackage > 0,
    ).map((pkg) => ({
      id: pkg.id,
      label: pkg.label.trim().slice(0, 100),
      baseQtyPerPackage: pkg.baseQtyPerPackage,
    })),
  })).filter((item) =>
    stores.some((store) => store.id === item.storeId) && Boolean(item.name),
  )
  const movementTypes: StockMovement['type'][] = [
    'opening', 'purchase', 'sale_use', 'staff_use', 'waste', 'adjustment',
    'count_correction', 'void_return',
  ]
  const stockMovements = collection<StockMovement>('stockMovements', (item): item is StockMovement =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.itemId === 'string' &&
    movementTypes.includes(item.type as StockMovement['type']) &&
    isFiniteNumber(item.qtyDelta) &&
    (item.qtyDelta !== 0 || item.type === 'count_correction') &&
    isFiniteNumber(item.unitCostSnapshot) && item.unitCostSnapshot >= 0 &&
    typeof item.userId === 'string' && typeof item.userName === 'string' &&
    typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)) &&
    (item.reason === undefined || typeof item.reason === 'string') &&
    (item.refType === undefined || typeof item.refType === 'string') &&
    (item.refId === undefined || typeof item.refId === 'string'),
  ).map((movement) => ({
    ...movement,
    unitCostSnapshot: Math.max(0, movement.unitCostSnapshot),
    reason: typeof movement.reason === 'string' ? movement.reason.trim().slice(0, 240) || undefined : undefined,
  })).filter((movement) =>
    inventoryItems.some((item) => item.id === movement.itemId && item.storeId === movement.storeId),
  )
  const suppliers = collection<Supplier>('suppliers', (item): item is Supplier =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.name === 'string' &&
    typeof item.phone === 'string' && typeof item.email === 'string' &&
    typeof item.address === 'string' && typeof item.notes === 'string' &&
    typeof item.active === 'boolean' && typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)),
  ).map((supplier) => ({
    ...supplier,
    name: supplier.name.trim().slice(0, 100),
    phone: supplier.phone.trim().slice(0, 40),
    email: supplier.email.trim().slice(0, 120),
    address: supplier.address.trim().slice(0, 240),
    notes: supplier.notes.trim().slice(0, 500),
  })).filter((supplier, index, list) =>
    stores.some((store) => store.id === supplier.storeId) && Boolean(supplier.name) &&
    list.findIndex((other) =>
      other.id === supplier.id ||
      (other.storeId === supplier.storeId && other.name.toLowerCase() === supplier.name.toLowerCase()),
    ) === index,
  )
  const purchases = collection<Purchase>('purchases', (item): item is Purchase =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.supplierId === 'string' &&
    typeof item.supplierName === 'string' && typeof item.invoiceNumber === 'string' &&
    typeof item.receivedAt === 'string' && Number.isFinite(Date.parse(item.receivedAt)) &&
    Array.isArray(item.lines) && item.lines.length > 0 &&
    item.lines.every((line) =>
      isRecord(line) && typeof line.id === 'string' &&
      typeof line.inventoryItemId === 'string' && typeof line.itemName === 'string' &&
      typeof line.packageId === 'string' && typeof line.packageLabel === 'string' &&
      isFiniteNumber(line.packageCount) && line.packageCount > 0 &&
      isFiniteNumber(line.baseQuantity) && line.baseQuantity > 0 &&
      isFiniteNumber(line.unitCost) && line.unitCost >= 0 &&
      isFiniteNumber(line.lineTotal) && line.lineTotal >= 0,
    ) &&
    isFiniteNumber(item.subtotal) && item.subtotal >= 0 &&
    isFiniteNumber(item.paidAmount) && item.paidAmount >= 0 && item.paidAmount <= item.subtotal &&
    (item.status === 'received' || item.status === 'void') &&
    typeof item.note === 'string' && typeof item.createdById === 'string' &&
    typeof item.createdByName === 'string' && typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    (item.receiptImage === undefined ||
      (typeof item.receiptImage === 'string' && item.receiptImage.length <= 700_000 &&
        /^data:image\/(?:jpeg|png|webp);base64,/.test(item.receiptImage))),
  ).map((purchase) => ({
    ...purchase,
    supplierName: purchase.supplierName.trim().slice(0, 100),
    invoiceNumber: purchase.invoiceNumber.trim().slice(0, 100),
    note: purchase.note.trim().slice(0, 500),
    lines: purchase.lines.map((line) => ({
      ...line,
      itemName: line.itemName.trim().slice(0, 100),
      packageLabel: line.packageLabel.trim().slice(0, 100),
    })),
    receiptImage: typeof purchase.receiptImage === 'string' ? purchase.receiptImage : undefined,
    voidedAt: typeof purchase.voidedAt === 'string' ? purchase.voidedAt : undefined,
    voidedById: typeof purchase.voidedById === 'string' ? purchase.voidedById : undefined,
    voidedByName: typeof purchase.voidedByName === 'string' ? purchase.voidedByName : undefined,
  })).filter((purchase) =>
    stores.some((store) => store.id === purchase.storeId) &&
    suppliers.some((supplier) => supplier.id === purchase.supplierId && supplier.storeId === purchase.storeId) &&
    purchase.lines.every((line) =>
      inventoryItems.some((inventoryItem) =>
        inventoryItem.id === line.inventoryItemId && inventoryItem.storeId === purchase.storeId,
      ),
    ),
  )
  const purchasePayments = collection<PurchasePayment>('purchasePayments', (item): item is PurchasePayment =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.purchaseId === 'string' &&
    isFiniteNumber(item.amount) && item.amount > 0 &&
    (item.method === 'cash' || item.method === 'card' || item.method === 'bank_transfer' || item.method === 'other') &&
    typeof item.note === 'string' && typeof item.userId === 'string' &&
    typeof item.userName === 'string' && typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)),
  ).map((payment) => ({
    ...payment,
    note: payment.note.trim().slice(0, 240),
  })).filter((payment) =>
    purchases.some((purchase) =>
      purchase.id === payment.purchaseId && purchase.storeId === payment.storeId && purchase.status === 'received',
    ) && users.some((user) => user.id === payment.userId && user.storeId === payment.storeId),
  )
  const usedOpenTables = new Set<string>()
  const openOrders = collection<OpenOrder>('openOrders', (item): item is OpenOrder =>
    hasId(item) && typeof item.storeId === 'string' &&
    (item.tableId === undefined || typeof item.tableId === 'string') &&
    typeof item.tableName === 'string' && Array.isArray(item.items) &&
    isFiniteNumber(item.subtotal) && isFiniteNumber(item.tax) && isFiniteNumber(item.service) &&
    isFiniteNumber(item.discount) && isFiniteNumber(item.total) &&
    item.channel === 'dine-in' && item.status === 'open' &&
    typeof item.staffId === 'string' && typeof item.staffName === 'string' &&
    typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)),
  ).map((order) => ({
    ...order,
    tableId: typeof order.tableId === 'string' ? order.tableId : undefined,
    shiftId: typeof order.shiftId === 'string' ? order.shiftId : undefined,
    sectionId: typeof order.sectionId === 'string' ? order.sectionId : undefined,
    sectionName: typeof order.sectionName === 'string' ? order.sectionName.slice(0, 60) : undefined,
    guests: Number.isSafeInteger(order.guests) && Number(order.guests) >= 1 && Number(order.guests) <= 50
      ? Number(order.guests)
      : undefined,
    recordedOrderId: typeof order.recordedOrderId === 'string' ? order.recordedOrderId : undefined,
    tableHistory: normalizeTableHistory(order.tableHistory),
    note: typeof order.note === 'string' ? order.note.slice(0, 500) : undefined,
    items: order.items.filter((item) =>
      isRecord(item) && typeof item.productId === 'string' && typeof item.name === 'string' &&
      isFiniteNumber(item.price) && isFiniteNumber(item.qty) && item.qty > 0,
    ).map((item, index) => ({
      ...withoutLegacyEmoji(item),
      lineId: typeof item.lineId === 'string' ? item.lineId : `${order.id}:${index}`,
      addedById: typeof item.addedById === 'string' ? item.addedById : order.staffId,
      addedByName: typeof item.addedByName === 'string' ? item.addedByName : order.staffName,
      modifiers: Array.isArray(item.modifiers) ? item.modifiers.filter(isOrderModifier) : [],
      note: typeof item.note === 'string' ? item.note.slice(0, 240) : '',
      variantId: typeof item.variantId === 'string' ? item.variantId : undefined,
      variantName: typeof item.variantName === 'string' ? item.variantName : undefined,
      saleUnit: isSaleUnit(item.saleUnit) ? item.saleUnit : undefined,
      soldByWeight: item.soldByWeight === true,
      sentAt: typeof item.sentAt === 'string' && Number.isFinite(Date.parse(item.sentAt))
        ? item.sentAt
        : undefined,
    })),
  })).filter((order) => {
    const tableKey = order.tableId
      ? `${order.storeId}:id:${order.tableId}`
      : `${order.storeId}:name:${order.tableName.trim().toLowerCase()}`
    const valid = stores.some((store) => store.id === order.storeId) &&
      (order.tableId
        ? tables.some((table) => table.id === order.tableId && table.storeId === order.storeId)
        : order.tableName.trim().length > 0 && order.tableName.trim().length <= 60) &&
      !usedOpenTables.has(tableKey)
    if (valid) usedOpenTables.add(tableKey)
    return valid
  })
  const ledger = collection<Database['ledger'][number]>('ledger', (item): item is Database['ledger'][number] =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.customerId === 'string' &&
    (item.type === 'charge' || item.type === 'payment') &&
    isFiniteNumber(item.amount) && typeof item.createdAt === 'string',
  )
  const expenses = collection<Expense>('expenses', (item): item is Expense =>
    hasId(item) && typeof item.storeId === 'string' && isFiniteNumber(item.amount) &&
    typeof item.date === 'string' && typeof item.category === 'string' &&
    typeof item.createdBy === 'string',
  )
  const attendance = collection<Attendance>('attendance', (item): item is Attendance =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.userId === 'string' &&
    typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    typeof item.clockIn === 'string' && Number.isFinite(Date.parse(item.clockIn)) &&
    typeof item.lastSeen === 'string' && Number.isFinite(Date.parse(item.lastSeen)) &&
    (item.clockOut === undefined || (typeof item.clockOut === 'string' && Number.isFinite(Date.parse(item.clockOut)))) &&
    (item.status === 'present' || item.status === 'half' || item.status === 'absent') &&
    (item.source === 'auto' || item.source === 'manual'),
  ).map((item) => ({
    ...item,
    note: typeof item.note === 'string' ? item.note.slice(0, 500) : undefined,
  }))
  const advances = collection<Advance>('advances', (item): item is Advance =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.userId === 'string' &&
    isFiniteNumber(item.amount) && item.amount > 0 && typeof item.date === 'string' &&
    Number.isFinite(Date.parse(item.date)) && (item.status === 'open' || item.status === 'deducted') &&
    (item.payrollId === undefined || typeof item.payrollId === 'string'),
  ).map((item) => ({
    ...item,
    amount: round(item.amount),
    note: typeof item.note === 'string' ? item.note.slice(0, 500) : '',
  }))
  const payrolls = collection<Payroll>('payrolls', (item): item is Payroll =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.userId === 'string' &&
    typeof item.month === 'string' && /^\d{4}-\d{2}$/.test(item.month) &&
    isFiniteNumber(item.daysWorked) && item.daysWorked >= 0 &&
    isFiniteNumber(item.earned) && item.earned >= 0 &&
    isFiniteNumber(item.advancesDeducted) && item.advancesDeducted >= 0 &&
    isFiniteNumber(item.netPaid) && item.netPaid >= 0 &&
    typeof item.paidAt === 'string' && Number.isFinite(Date.parse(item.paidAt)) &&
    typeof item.paidBy === 'string',
  ).map((item) => ({
    ...item,
    daysWorked: round(item.daysWorked),
    earned: round(item.earned),
    advancesDeducted: round(item.advancesDeducted),
    netPaid: round(item.netPaid),
  }))
  const auditCounts = new Map<string, number>()
  const auditLogs = collection<AuditLog>('auditLogs', isAuditLog).map((log) => ({
    ...log,
    summary: log.summary.slice(0, 500),
    before: normalizeAuditChanges(log.before),
    after: normalizeAuditChanges(log.after),
  })).reverse().filter((log) => {
    const count = auditCounts.get(log.storeId) ?? 0
    if (count >= 3000) return false
    auditCounts.set(log.storeId, count + 1)
    return true
  }).reverse()
  const shifts = Array.isArray(value.shifts)
    ? collection<Shift>('shifts', (item): item is Shift =>
        hasId(item) && typeof item.storeId === 'string' && typeof item.userId === 'string' &&
        typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && isDateKey(item.date) &&
        typeof item.startTime === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.startTime) &&
        typeof item.endTime === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.endTime) &&
        item.endTime > item.startTime && typeof item.createdBy === 'string' &&
        typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)),
      ).map((item) => ({
        ...item,
        note: typeof item.note === 'string' ? item.note.slice(0, 500) : undefined,
      })).filter((shift) =>
        users.some((member) =>
          member.id === shift.userId && member.storeId === shift.storeId && member.role === 'staff',
        ) &&
        stores.some((store) => store.id === shift.storeId) &&
        users.some((actor) => actor.id === shift.createdBy && actor.storeId === shift.storeId),
      )
    : []
  const rawRegisterSessions = collection<RegisterSession>('registerSessions', (item): item is RegisterSession =>
    hasId(item) && typeof item.storeId === 'string' &&
    (item.status === 'open' || item.status === 'closed') && typeof item.openedAt === 'string' &&
    typeof item.openedById === 'string' && typeof item.openedByName === 'string' &&
    isFiniteNumber(item.openingCash),
  ).map((session) => ({
    ...session,
    snapshot: isRecord(session.snapshot) &&
      Object.values(session.snapshot).length === 16 &&
      Object.values(session.snapshot).every(isFiniteNumber)
      ? session.snapshot as RegisterSession['snapshot']
      : undefined,
    reportDetails: normalizeReportDetails(session.reportDetails),
    zReportNumber: Number.isSafeInteger(session.zReportNumber) && Number(session.zReportNumber) > 0
      ? Number(session.zReportNumber)
      : undefined,
  }))
  const usedReportNumbers = new Map<string, Set<number>>()
  const orderedClosedSessions = rawRegisterSessions
    .filter((session) => session.status === 'closed')
    .sort((a, b) => (a.closedAt ?? a.openedAt).localeCompare(b.closedAt ?? b.openedAt))
  const reportNumbers = new Map<RegisterSession, number>()
  for (const session of orderedClosedSessions) {
    const used = usedReportNumbers.get(session.storeId) ?? new Set<number>()
    if (session.zReportNumber !== undefined && !used.has(session.zReportNumber)) {
      used.add(session.zReportNumber)
      reportNumbers.set(session, session.zReportNumber)
      usedReportNumbers.set(session.storeId, used)
    }
  }
  for (const session of orderedClosedSessions) {
    if (reportNumbers.has(session)) continue
    const used = usedReportNumbers.get(session.storeId) ?? new Set<number>()
    let number = 1
    while (used.has(number)) number += 1
    used.add(number)
    reportNumbers.set(session, number)
    usedReportNumbers.set(session.storeId, used)
  }
  const staffShiftNumbers = new Map<string, number>()
  const registerSessions = rawRegisterSessions
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
    .map((session) => {
      const staffId = typeof session.staffId === 'string' &&
        users.some((member) => member.id === session.staffId && member.storeId === session.storeId)
        ? session.staffId
        : session.openedById
      const key = `${session.storeId}:${staffId}`
      const number = (staffShiftNumbers.get(key) ?? 0) + 1
      staffShiftNumbers.set(key, number)
      return {
        ...session,
        staffId,
        shiftNumber: typeof session.shiftNumber === 'string' && /^S-\d{6}$/.test(session.shiftNumber)
          ? session.shiftNumber
          : `S-${String(number).padStart(6, '0')}`,
        zReportNumber: reportNumbers.get(session),
      }
    })
  const sessionForTimestamp = (storeId: string, value: string | undefined) => {
    const time = value ? Date.parse(value) : Number.NaN
    if (!Number.isFinite(time)) return undefined
    return registerSessions
      .filter((session) => session.storeId === storeId &&
        time >= Date.parse(session.openedAt) &&
        time <= Date.parse(session.closedAt ?? new Date().toISOString()))
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0]
  }
  const attributedOrders = orders.map((order) => {
    const session = sessionForTimestamp(order.storeId, order.createdAt)
    const voidSession = sessionForTimestamp(order.storeId, order.voidedAt)
    return {
      ...order,
      shiftId: registerSessions.some((candidate) =>
        candidate.id === order.shiftId && candidate.storeId === order.storeId,
      ) ? order.shiftId : session?.id,
      voidShiftId: registerSessions.some((candidate) =>
        candidate.id === order.voidShiftId && candidate.storeId === order.storeId,
      ) ? order.voidShiftId : voidSession?.id,
    }
  })
  const attributedOpenOrders = openOrders.map((order) => ({
    ...order,
    shiftId: registerSessions.some((candidate) =>
      candidate.id === order.shiftId && candidate.storeId === order.storeId,
    ) ? order.shiftId : sessionForTimestamp(order.storeId, order.createdAt)?.id,
  }))
  const attributedLedger = ledger.map((entry) => ({
    ...entry,
    shiftId: registerSessions.some((candidate) =>
      candidate.id === entry.shiftId && candidate.storeId === entry.storeId,
    ) ? entry.shiftId : sessionForTimestamp(entry.storeId, entry.createdAt)?.id,
  }))
  const attributedExpenses = expenses.map((expense) => ({
    ...expense,
    shiftId: registerSessions.some((candidate) =>
      candidate.id === expense.shiftId && candidate.storeId === expense.storeId,
    ) ? expense.shiftId : sessionForTimestamp(expense.storeId, expense.createdAt ?? expense.date)?.id,
  }))
  const attributedPurchasePayments = purchasePayments.map((payment) => ({
    ...payment,
    shiftId: registerSessions.some((candidate) =>
      candidate.id === payment.shiftId && candidate.storeId === payment.storeId,
    ) ? payment.shiftId : sessionForTimestamp(payment.storeId, payment.createdAt)?.id,
  }))

  const stations = collection<Station>('stations', (item): item is Station =>
    hasId(item) && typeof item.storeId === 'string' && typeof item.name === 'string' &&
    typeof item.active === 'boolean' && isFiniteNumber(item.sort),
  ).map((station) => ({
    ...withoutLegacyEmoji(station),
    name: station.name.trim().slice(0, 80),
    icon: isIconName(station.icon) ? station.icon : 'Utensils',
    color: isIconColor(station.color) ? station.color : 'amber',
    printerId: typeof station.printerId === 'string' ? station.printerId : undefined,
    screen: station.screen === true,
    active: station.active,
    sort: isFiniteNumber(station.sort) ? station.sort : 0,
  })).filter((station) => stores.some((store) => store.id === station.storeId) && station.name.length > 0)
  const validStationIds = new Set(stations.map((station) => station.id))
  return {
    stores,
    users,
    stations,
    categories: collection<Category>('categories', (item): item is Category =>
      hasId(item) && typeof item.storeId === 'string' && typeof item.name === 'string',
    ).map((category) => ({
      ...withoutLegacyEmoji(category),
      icon: isIconName(category.icon) ? category.icon : iconFromLegacyEmoji(legacyEmoji(category), 'Store'),
      iconColor: isIconColor(category.iconColor) ? category.iconColor : 'amber',
      stationId: typeof category.stationId === 'string' && validStationIds.has(category.stationId)
        ? category.stationId
        : undefined,
      sort: isFiniteNumber(category.sort) ? category.sort : 0,
    })),
    sections: allSections,
    tables,
    inventoryItems,
    stockMovements,
    suppliers,
    purchases,
    purchasePayments: attributedPurchasePayments,
    openOrders: attributedOpenOrders,
    products: collection<Product>('products', (item): item is Product =>
      hasId(item) && typeof item.storeId === 'string' && typeof item.categoryId === 'string' &&
      typeof item.name === 'string' && isFiniteNumber(item.price) && isFiniteNumber(item.cost) &&
      isFiniteNumber(item.stock),
    ).map((product) => ({
      ...withoutLegacyEmoji(product),
      icon: isIconName(product.icon) ? product.icon : iconFromLegacyEmoji(legacyEmoji(product), 'Store'),
      iconColor: isIconColor(product.iconColor) ? product.iconColor : 'amber',
      stationId: typeof product.stationId === 'string' && validStationIds.has(product.stationId)
        ? product.stationId
        : undefined,
      image: typeof product.image === 'string' && product.image.length <= 307200 ? product.image : undefined,
      trackStock: Boolean(product.trackStock),
      active: product.active !== false,
      barcode: typeof product.barcode === 'string' ? product.barcode : '',
      modifiers: Array.isArray(product.modifiers)
        ? product.modifiers.map(normalizeModifierGroup).filter((group): group is ProductModifierGroup => group !== null)
        : [],
      variants: Array.isArray(product.variants)
        ? product.variants.map(normalizeVariant).filter((variant): variant is ProductVariant => variant !== null)
        : [],
      soldByWeight: product.soldByWeight === true,
      saleUnit: isSaleUnit(product.saleUnit) ? product.saleUnit : 'piece',
    })),
    customers: collection<Customer>('customers', (item): item is Customer =>
      hasId(item) && typeof item.storeId === 'string' && typeof item.name === 'string' &&
      isFiniteNumber(item.limit),
    ).map((customer) => ({
      ...customer,
      phone: typeof customer.phone === 'string' ? customer.phone : '',
      notes: typeof customer.notes === 'string' ? customer.notes : '',
      createdAt: typeof customer.createdAt === 'string' ? customer.createdAt : new Date(0).toISOString(),
    })),
    orders: attributedOrders,
    ledger: attributedLedger,
    expenses: attributedExpenses,
    attendance,
    advances,
    payrolls,
    shifts,
    registerSessions,
    auditLogs,
  }
}

const databaseCollectionKeys: Array<keyof Database> = [
  'stores', 'users', 'stations', 'categories', 'tables', 'inventoryItems', 'stockMovements',
  'suppliers', 'purchases', 'purchasePayments', 'products', 'customers', 'orders', 'openOrders', 'ledger', 'expenses',
  'attendance', 'advances', 'payrolls', 'shifts', 'registerSessions', 'auditLogs',
]

export function normalizeDatabaseBackup(value: unknown, seed: Database): Database | null {
  const optionalCollections: Array<keyof Database> = ['suppliers', 'purchases', 'purchasePayments']
  if (!isRecord(value) || !databaseCollectionKeys.every((key) =>
    optionalCollections.includes(key) || Array.isArray(value[key]),
  )) return null
  const normalized = normalizeDb(value, seed)
  if (!normalized) return null
  if (databaseCollectionKeys.some((key) => {
    const rawCollection = value[key]
    if (optionalCollections.includes(key) && rawCollection === undefined) return false
    return !Array.isArray(rawCollection) || normalized[key].length !== rawCollection.length
  })) return null
  return normalized
}

export const clearLocalDatabaseCopies = () => {
  for (const key of [DB_KEY, ...LEGACY_DB_KEYS]) {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('7anouti: could not remove a local database copy.', error)
    }
  }
}

export const loadDb = async (
  seed: Database,
  reportStorageError: (operation: string, error: unknown) => void = () => {},
): Promise<{ database: Database; hasPersistedData: boolean }> => {
  let db: Database | null = null
  let loadedFromIndexedDb = false
  let loadedFromPreviousKey = false
  let hasPersistedData = false
  for (const key of [DB_KEY, ...INDEXED_DB_MIGRATION_KEYS]) {
    try {
      const raw = await readIndexedValue(key)
      if (!raw) continue
      try {
        db = normalizeDb(JSON.parse(raw), seed)
      } catch {
        db = null
      }
      if (db) {
        loadedFromIndexedDb = true
        loadedFromPreviousKey = key !== DB_KEY
        hasPersistedData = true
        break
      }
    } catch (error) {
      reportStorageError('reading IndexedDB', error)
    }
  }

  if (!db) {
    for (const key of [DB_KEY, ...LEGACY_DB_KEYS]) {
      let raw: string | null = null
      try {
        raw = localStorage.getItem(key)
      } catch (error) {
        reportStorageError('reading localStorage', error)
        break
      }
      if (!raw) continue
      try {
        db = normalizeDb(JSON.parse(raw), seed)
      } catch { /* Try the next key when local data is corrupted. */ }
      if (db) {
        loadedFromPreviousKey = key !== DB_KEY
        hasPersistedData = true
        break
      }
    }
  }
  const source = db ?? seed
  const users = await Promise.all(source.users.map(async (user) => ({
    ...user,
    email: user.role === 'staff' || user.role === 'manager' ? '' : user.email ?? '',
    password: user.role === 'staff' || user.role === 'manager'
      ? await hashRandomSecret()
      : user.password
        ? isSecretHash(user.password) ? user.password : await hashSecret(user.password)
        : '',
    pin: user.pin
      ? isSecretHash(user.pin) ? user.pin : await hashSecret(user.pin)
      : '',
  })))
  const stores = loadedFromPreviousKey
    ? source.stores.map((store) =>
        !store.settings.features.tables && source.tables.some((table) => table.storeId === store.id)
          ? {
              ...store,
              settings: {
                ...store.settings,
                features: { ...store.settings.features, tables: true },
              },
            }
          : store,
      )
    : source.stores
  const migrated = { ...source, stores, users }
  if (loadedFromIndexedDb) clearLocalDatabaseCopies()
  return { database: migrated, hasPersistedData }
}

import type {
  Advance, Attendance, AuditAction, AuditEntity, AuditJsonValue, AuditLog, AuditRole, BusinessType,
  Category, Customer, Database, Expense, IconColor, IconName, Order,
  OrderModifier, Payroll, Product, ProductModifierGroup, ProductVariant, RegisterSession, SaleUnit,
  Store, StoreSettings, User,
} from '../types'
import { ICON_NAMES } from '../types'
import { normalizePayrollSettings, normalizePrinter, normalizeUser } from '../lib/defaults'
import { hashRandomSecret, hashSecret, isSecretHash } from '../lib/hash'
import { businessTemplate } from '../lib/businessTemplates'
import { readIndexedValue } from '../lib/storage'
import { isValidUsername } from '../lib/staff'
import { isAccentPalette } from '../lib/theme'
import { round } from '../lib/pricing-utils'

export const DB_KEY = '7anouti.db.v13'
const INDEXED_DB_MIGRATION_KEYS = ['7anouti.db.v12', '7anouti.db.v11', '7anouti.db.v10']
const LEGACY_DB_KEYS = [
  '7anouti.db.v12', '7anouti.db.v11', '7anouti.db.v10', '7anouti.db.v9', '7anouti.db.v8',
  'cafepos.db.v8', 'cafepos.db.v7', 'cafepos.db.v6',
]
export const SESSION_KEY = '7anouti.session.v2'
export const LEGACY_SESSION_KEYS = ['cafepos.session.v2']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
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
const auditActions: AuditAction[] = [
  'created', 'edited', 'deleted', 'voided', 'discount_applied', 'refund_applied',
  'debt_payment', 'activated', 'deactivated', 'pin_reset', 'register_opened',
  'register_closed', 'settings_updated', 'login_success', 'login_failure', 'logout', 'demo_reset',
]
const auditEntities: AuditEntity[] = [
  'order', 'product', 'category', 'customer', 'staff', 'expense',
  'register', 'settings', 'auth', 'payroll',
]
const auditRoles: AuditRole[] = ['super', 'admin', 'staff', 'unknown']
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

const normalizeDb = (value: unknown, seed: Database): Database | null => {
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
            kitchenScreen: isRecord(s.settings.features) && typeof s.settings.features.kitchenScreen === 'boolean'
              ? s.settings.features.kitchenScreen : template.features.kitchenScreen,
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
          accent: isAccentPalette(s.settings.accent) ? s.settings.accent : '7anouti',
          colorMode: s.settings.colorMode === 'dark' ? 'dark' as const : 'light' as const,
          printer: normalizePrinter(
            isRecord(s.settings) && isRecord(s.settings.printer)
              ? s.settings.printer as StoreSettings['printer']
              : undefined,
          ),
          payroll: normalizePayrollSettings(
            isRecord(s.settings.payroll) ? s.settings.payroll as Partial<StoreSettings['payroll']> : undefined,
          ),
        },
      })})
    : []
  const normalizedUsers = Array.isArray(value.users)
    ? value.users.filter((u): u is User =>
        isRecord(u) && typeof u.id === 'string' && typeof u.name === 'string' &&
        (typeof u.email === 'string' || (u.role === 'staff' && u.email === undefined)) &&
        typeof u.password === 'string' &&
        typeof u.pin === 'string' && typeof u.active === 'boolean' &&
        typeof u.createdAt === 'string' &&
        (u.storeId === null || typeof u.storeId === 'string') &&
        (u.role === 'super' || u.role === 'admin' || u.role === 'staff'),
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
    (item.status === 'completed' || item.status === 'void') &&
    (item.paymentMethod === 'cash' || item.paymentMethod === 'card' || item.paymentMethod === 'credit') &&
    (item.channel === 'takeaway' || item.channel === 'dine-in' || item.channel === 'delivery'),
  ).map((order) => ({
    ...order,
    items: order.items.filter((item) =>
      isRecord(item) && typeof item.productId === 'string' &&
      typeof item.name === 'string' && isFiniteNumber(item.price) &&
      isFiniteNumber(item.qty) && item.qty > 0,
    ).map((item, index) => ({
      ...withoutLegacyEmoji(item),
      lineId: typeof item.lineId === 'string' ? item.lineId : `${order.id}:${index}`,
      modifiers: Array.isArray(item.modifiers) ? item.modifiers.filter(isOrderModifier) : [],
      note: typeof item.note === 'string' ? item.note : '',
      variantId: typeof item.variantId === 'string' ? item.variantId : undefined,
      variantName: typeof item.variantName === 'string' ? item.variantName : undefined,
      saleUnit: isSaleUnit(item.saleUnit) ? item.saleUnit : undefined,
      soldByWeight: item.soldByWeight === true,
    })),
  }))
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
  return {
    stores,
    users,
    categories: collection<Category>('categories', (item): item is Category =>
      hasId(item) && typeof item.storeId === 'string' && typeof item.name === 'string',
    ).map((category) => ({
      ...withoutLegacyEmoji(category),
      icon: isIconName(category.icon) ? category.icon : iconFromLegacyEmoji(legacyEmoji(category), 'Store'),
      iconColor: isIconColor(category.iconColor) ? category.iconColor : 'amber',
      sort: isFiniteNumber(category.sort) ? category.sort : 0,
    })),
    products: collection<Product>('products', (item): item is Product =>
      hasId(item) && typeof item.storeId === 'string' && typeof item.categoryId === 'string' &&
      typeof item.name === 'string' && isFiniteNumber(item.price) && isFiniteNumber(item.cost) &&
      isFiniteNumber(item.stock),
    ).map((product) => ({
      ...withoutLegacyEmoji(product),
      icon: isIconName(product.icon) ? product.icon : iconFromLegacyEmoji(legacyEmoji(product), 'Store'),
      iconColor: isIconColor(product.iconColor) ? product.iconColor : 'amber',
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
    orders,
    ledger,
    expenses,
    attendance,
    advances,
    payrolls,
    registerSessions: collection<RegisterSession>('registerSessions', (item): item is RegisterSession =>
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
    })),
    auditLogs,
  }
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
): Promise<Database> => {
  let db: Database | null = null
  let loadedFromIndexedDb = false
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
      if (db) break
    }
  }
  const source = db ?? seed
  const users = await Promise.all(source.users.map(async (user) => ({
    ...user,
    email: user.role === 'staff' ? '' : user.email ?? '',
    password: user.role === 'staff'
      ? await hashRandomSecret()
      : user.password
        ? isSecretHash(user.password) ? user.password : await hashSecret(user.password)
        : '',
    pin: user.pin
      ? isSecretHash(user.pin) ? user.pin : await hashSecret(user.pin)
      : '',
  })))
  const migrated = { ...source, users }
  if (loadedFromIndexedDb) clearLocalDatabaseCopies()
  return migrated
}

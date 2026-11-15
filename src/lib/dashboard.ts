import type { Customer, Database, Order, Product, Store, User } from '../types'
import { balanceFor } from './selectors'
import { round } from './pricing-utils'
import { dateKey, monthLabel, nextDueLabel, sum } from './utils'

type AdminInput = { db: Database; store: Store; now?: Date }

export type AdminDashboardData = {
  todayRevenue: number
  yesterdayRevenue: number
  todayOrders: Order[]
  yesterdayOrders: Order[]
  averageTicket: number
  itemsSold: number
  openOrders: number
  trackedOrders: number
  isTrackingMode: boolean
  monthRevenue: number
  monthProfit: number
  monthExpenses: number
  outstanding: number
  debtorCount: number
  trackedProducts: boolean
  lowStockCount: number
  outOfStockCount: number
  lowStock: DashboardStockAlert[]
  outOfStock: DashboardStockAlert[]
  registerSession: Database['registerSessions'][number] | null
  monthly: Array<{ month: string; sales: number; expenses: number }>
  categories: Array<{ name: string; revenue: number }>
  hourly: Array<{ hour: number; revenue: number }>
  topProducts: Array<{ id: string; name: string; qty: number; revenue: number }>
  recentOrders: Order[]
  debtors: Array<{ customerId: string; name: string; balance: number; cycle?: Customer['cycle'] }>
}

export type DashboardStockAlert = { id: string; name: string; stock: number }

function trackedStockItems(db: Database, storeId: string): DashboardStockAlert[] {
  return db.products
    .filter((product) => product.storeId === storeId && product.active)
    .flatMap((product) => [
      ...(product.trackStock ? [{ id: product.id, name: product.name, stock: product.stock }] : []),
      ...(product.variants ?? [])
        .filter((variant) => variant.trackStock)
        .map((variant) => ({ id: `${product.id}-${variant.id}`, name: `${product.name} · ${variant.name}`, stock: variant.stock })),
    ])
}

const isInMonth = (value: string, year: number, month: number) => {
  const date = new Date(value)
  return date.getFullYear() === year && date.getMonth() === month
}

const expenseDate = (date: string, createdAt?: string) => createdAt ?? date

function itemCost(item: Order['items'][number], products: Map<string, Product>) {
  const product = products.get(item.productId)
  if (!product) return 0
  const variant = product.variants?.find((candidate) => candidate.id === item.variantId)
  return round((variant?.cost ?? product.cost) * item.qty)
}

export function getAdminDashboardData({ db, store, now = new Date() }: AdminInput): AdminDashboardData {
  const todayKey = dateKey(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayKey = dateKey(yesterdayDate)
  const orders = db.orders.filter((order) => order.storeId === store.id)
  const completed = orders.filter((order) => order.status === 'completed')
  const todayOrders = completed.filter((order) => dateKey(order.createdAt) === todayKey)
  const todayRecordedOrders = orders.filter((order) => dateKey(order.createdAt) === todayKey && String(order.status) === 'recorded')
  const yesterdayOrders = completed.filter((order) => dateKey(order.createdAt) === yesterdayKey)
  const todayRevenue = round(sum(todayOrders, (order) => order.total))
  const yesterdayRevenue = round(sum(yesterdayOrders, (order) => order.total))
  const monthOrders = completed.filter((order) => isInMonth(order.createdAt, now.getFullYear(), now.getMonth()))
  const monthRevenue = round(sum(monthOrders, (order) => order.total))
  const expenses = db.expenses.filter((expense) => expense.storeId === store.id)
  const monthExpenses = round(sum(
    expenses.filter((expense) => isInMonth(expenseDate(expense.date, expense.createdAt), now.getFullYear(), now.getMonth())),
    (expense) => expense.amount,
  ))
  const productMap = new Map(db.products.filter((product) => product.storeId === store.id).map((product) => [product.id, product]))
  const monthCost = round(sum(
    monthOrders.flatMap((order) => order.items),
    (item) => itemCost(item, productMap),
  ))
  const customers = db.customers.filter((customer) => customer.storeId === store.id)
  const debtorRows = customers
    .map((customer) => ({ customerId: customer.id, name: customer.name, balance: Math.max(0, balanceFor(db.ledger, customer.id)), cycle: customer.cycle }))
    .filter((customer) => customer.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5)
  const stockItems = trackedStockItems(db, store.id)
  const allLowStock = stockItems.filter((product) => product.stock > 0 && product.stock <= store.settings.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock)
  const allOutOfStock = stockItems.filter((product) => product.stock <= 0).sort((a, b) => a.name.localeCompare(b.name))
  const lowStock = allLowStock
    .slice(0, 5)
  const outOfStock = allOutOfStock
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    const monthSales = completed.filter((order) => isInMonth(order.createdAt, monthStart.getFullYear(), monthStart.getMonth()))
    const monthCosts = expenses.filter((expense) => isInMonth(expenseDate(expense.date, expense.createdAt), monthStart.getFullYear(), monthStart.getMonth()))
    return {
      month: monthLabel(monthStart),
      sales: round(sum(monthSales, (order) => order.total)),
      expenses: round(sum(monthCosts, (expense) => expense.amount)),
    }
  })
  const categoryTotals = new Map<string, number>()
  for (const order of monthOrders) {
    for (const item of order.items) {
      const product = productMap.get(item.productId)
      const category = db.categories.find((entry) => entry.id === product?.categoryId && entry.storeId === store.id)
      const name = category?.name ?? 'Other'
      categoryTotals.set(name, round((categoryTotals.get(name) ?? 0) + item.price * item.qty))
    }
  }
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    revenue: round(sum(todayOrders.filter((order) => new Date(order.createdAt).getHours() === hour), (order) => order.total)),
  }))
  const since30 = new Date(now)
  since30.setDate(since30.getDate() - 30)
  const productTotals = new Map<string, { id: string; name: string; qty: number; revenue: number }>()
  for (const order of orders) {
    if (order.status === 'void' || (!['completed', 'recorded'].includes(String(order.status)))) continue
    if (new Date(order.createdAt) < since30) continue
    for (const item of order.items) {
      const current = productTotals.get(item.productId) ?? { id: item.productId, name: item.name, qty: 0, revenue: 0 }
      current.qty = round(current.qty + item.qty)
      current.revenue = round(current.revenue + item.qty * item.price)
      productTotals.set(item.productId, current)
    }
  }
  const isTrackingMode = 'usageMode' in store.settings && store.settings.usageMode === 'tracking'
  const trackedOrders = todayRecordedOrders.length
  const openOrders = orders.filter((order) => ['open', 'pending'].includes(String(order.status))).length
  const registerSession = db.registerSessions.find((session) => session.storeId === store.id && session.status === 'open') ?? null

  return {
    todayRevenue,
    yesterdayRevenue,
    todayOrders,
    yesterdayOrders,
    averageTicket: todayOrders.length ? round(todayRevenue / todayOrders.length) : 0,
    itemsSold: round(sum(
      [...todayOrders, ...todayRecordedOrders].flatMap((order) => order.items),
      (item) => item.qty,
    )),
    openOrders,
    trackedOrders,
    isTrackingMode,
    monthRevenue,
    monthProfit: round(monthRevenue - monthCost - monthExpenses),
    monthExpenses,
    outstanding: round(sum(debtorRows, (customer) => customer.balance)),
    debtorCount: customers.filter((customer) => balanceFor(db.ledger, customer.id) > 0).length,
    trackedProducts: stockItems.length > 0,
    lowStockCount: allLowStock.length,
    outOfStockCount: allOutOfStock.length,
    lowStock,
    outOfStock,
    registerSession,
    monthly,
    categories: [...categoryTotals.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue),
    hourly,
    topProducts: [...productTotals.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    recentOrders: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    debtors: debtorRows,
  }

}

export function percentChange(current: number, previous: number) {
  return previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null
}

export function getStaffDashboardData(db: Database, storeId: string, userId: string, now = new Date()) {
  const today = dateKey(now)
  const orders = db.orders.filter((order) =>
    order.storeId === storeId && order.staffId === userId && order.status === 'completed' && dateKey(order.createdAt) === today,
  )
  return {
    orders,
    count: orders.length,
    total: round(sum(orders, (order) => order.total)),
    items: round(sum(orders.flatMap((order) => order.items), (item) => item.qty)),
    recentOrders: [...db.orders]
      .filter((order) => order.storeId === storeId && order.staffId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
  }
}

export function getTableOccupancy(db: Database, storeId: string) {
  const activeTables = db.tables.filter((table) => table.storeId === storeId && table.active)
  const occupied = new Set(db.openOrders
    .filter((order) => order.storeId === storeId)
    .map((order) => order.tableId))
  const occupiedCount = activeTables.filter((table) => occupied.has(table.id)).length
  return {
    free: activeTables.length - occupiedCount,
    occupied: occupiedCount,
  }
}

export function getSuperDashboardData(db: Database, now = new Date()) {
  const monthStores = db.stores.filter((store) => isInMonth(store.createdAt, now.getFullYear(), now.getMonth()))
  const signupTrend = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    return {
      month: monthLabel(month),
      signups: db.stores.filter((store) => isInMonth(store.createdAt, month.getFullYear(), month.getMonth())).length,
    }
  })
  const businessTypes = [...new Set(db.stores.map((store) => store.businessType))]
    .map((type) => ({ type, count: db.stores.filter((store) => store.businessType === type).length }))
    .sort((a, b) => b.count - a.count)
  return {
    total: db.stores.length,
    active: db.stores.filter((store) => store.status === 'active').length,
    trial: db.stores.filter((store) => store.status === 'trial').length,
    suspended: db.stores.filter((store) => store.status === 'suspended').length,
    newThisMonth: monthStores.length,
    businessTypes,
    signupTrend,
    recentStores: [...db.stores].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
  }
}

export type DashboardNotice = { id: 'stock' | 'tabs' | 'register'; label: string; count: number; href: string }

export function getDashboardNotices(db: Database, store: Store, now = new Date()): DashboardNotice[] {
  const stock = trackedStockItems(db, store.id)
  const lowStock = store.settings.automation.lowStockAlerts
    ? stock.filter((product) => product.stock <= store.settings.lowStockThreshold).length
    : 0
  const customers = db.customers.filter((customer) =>
    customer.storeId === store.id
      && balanceFor(db.ledger, customer.id) > 0
      && nextDueLabel(customer.cycle, now) === 'Due today',
  ).length
  const longOpenRegister = db.registerSessions.filter((session) =>
    session.storeId === store.id && session.status === 'open'
      && now.getTime() - new Date(session.openedAt).getTime() >= 8 * 60 * 60 * 1000,
  ).length
  const notices: DashboardNotice[] = [
    { id: 'stock', label: 'Low-stock products', count: lowStock, href: '/admin/products' },
    { id: 'tabs', label: 'Tabs due today', count: customers, href: '/admin/customers' },
    { id: 'register', label: 'Register open over 8 hours', count: longOpenRegister, href: '/admin/register' },
  ]
  return notices.filter((notice) => notice.count > 0)
}

export function canViewFinancials(user: User) {
  return user.role === 'admin' || user.permissions.reports
}

export function getOutstandingBalance(db: Database, storeId: string) {
  return round(sum(
    db.customers.filter((customer) => customer.storeId === storeId),
    (customer) => Math.max(0, balanceFor(db.ledger, customer.id)),
  ))
}

export type DashboardActivity = { id: string; title: string; detail: string; at?: string }

export function getDashboardActivity(db: Database, storeId: string, threshold: number): DashboardActivity[] {
  const voids: DashboardActivity[] = db.orders
    .filter((order) => order.storeId === storeId && order.status === 'void' && order.voidedAt)
    .map((order) => ({ id: `void-${order.id}`, title: `Order #${order.number} voided`, detail: order.voidedByName ?? order.staffName, at: order.voidedAt }))
  const staff: DashboardActivity[] = db.users
    .filter((user) => user.storeId === storeId && user.role === 'staff')
    .map((user) => ({ id: `staff-${user.id}`, title: 'Staff account added', detail: user.name, at: user.createdAt }))
  const stock: DashboardActivity[] = trackedStockItems(db, storeId)
    .filter((product) => product.stock <= threshold)
    .slice(0, 3)
    .map((product) => ({ id: `stock-${product.id}`, title: 'Stock alert', detail: `${product.name} · ${product.stock} left` }))
  return [...voids, ...staff, ...stock]
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
    .slice(0, 6)
}

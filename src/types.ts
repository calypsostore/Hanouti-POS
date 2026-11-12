export type Role = 'super' | 'admin' | 'staff'
export type PosMode = 'quick' | 'cashier'
export type Plan = 'starter' | 'growth' | 'pro'
export type StoreStatus = 'active' | 'trial' | 'suspended'
export type OrderChannel = 'takeaway' | 'dine-in' | 'delivery'
export type PaymentMethod = 'cash' | 'card' | 'credit'
export type OrderStatus = 'completed' | 'void'
export type SettlementCycle = 'monthly' | 'weekly' | 'on-demand'
export type PrinterWidth = 58 | 80
export type PrintMode = 'auto' | 'manual'
export type PrinterConnection = 'webserial' | 'browser'

export interface PrinterSettings {
  enabled: boolean
  width: PrinterWidth
  mode: PrintMode
  connection: PrinterConnection
  baudRate: number
  kitchenTicket: boolean
}

export interface StoreSettings {
  posMode: PosMode
  currency: string
  taxRate: number
  taxInclusive: boolean
  serviceCharge: number
  allowCredit: boolean
  requireCustomerForCredit: boolean
  receiptFooter: string
  lowStockThreshold: number
  accent: string
  printer: PrinterSettings
}

export interface Store {
  id: string
  name: string
  slug: string
  ownerName: string
  ownerEmail: string
  phone: string
  address: string
  city: string
  emoji: string
  plan: Plan
  status: StoreStatus
  createdAt: string
  trialEndsAt?: string
  settings: StoreSettings
}

export interface User {
  id: string
  storeId: string | null
  name: string
  email: string
  password: string
  pin: string
  role: Role
  active: boolean
  createdAt: string
  permissions: {
    discount: boolean
    credit: boolean
    settle: boolean
    reports: boolean
    register: boolean
  }
}

export interface Category {
  id: string
  storeId: string
  name: string
  emoji: string
  sort: number
}

export interface Product {
  id: string
  storeId: string
  categoryId: string
  name: string
  emoji: string
  price: number
  cost: number
  trackStock: boolean
  stock: number
  active: boolean
}

export interface Customer {
  id: string
  storeId: string
  name: string
  phone: string
  limit: number
  notes: string
  cycle?: SettlementCycle
  createdAt: string
}

export interface OrderItem {
  productId: string
  name: string
  emoji: string
  price: number
  qty: number
}

export interface Order {
  id: string
  storeId: string
  number: number
  items: OrderItem[]
  subtotal: number
  tax: number
  service: number
  discount: number
  total: number
  channel: OrderChannel
  status: OrderStatus
  paymentMethod: PaymentMethod
  customerId?: string
  staffId: string
  staffName: string
  note?: string
  createdAt: string
  voidedById?: string
  voidedByName?: string
}

export interface LedgerEntry {
  id: string
  storeId: string
  customerId: string
  type: 'charge' | 'payment'
  amount: number
  method?: 'cash' | 'card'
  orderId?: string
  note?: string
  staffName?: string
  createdAt: string
}

export interface Expense {
  id: string
  storeId: string
  category: string
  note: string
  amount: number
  date: string
  createdBy: string
}

export interface RegisterSnapshot {
  salesTotal: number
  cashSales: number
  cardSales: number
  creditSales: number
  ordersCount: number
  voidedCount: number
  voidedTotal: number
  cashRefunds: number
  discounts: number
  tax: number
  service: number
  expenses: number
  cashSettlements: number
  cardSettlements: number
  settlementCount: number
  expectedCash: number
}

export interface RegisterSession {
  id: string
  storeId: string
  status: 'open' | 'closed'
  openedAt: string
  openedById: string
  openedByName: string
  openingCash: number
  closedAt?: string
  closedById?: string
  closedByName?: string
  countedCash?: number
  difference?: number
  note?: string
  snapshot?: RegisterSnapshot
}

export interface Database {
  stores: Store[]
  users: User[]
  categories: Category[]
  products: Product[]
  customers: Customer[]
  orders: Order[]
  ledger: LedgerEntry[]
  expenses: Expense[]
  registerSessions: RegisterSession[]
}

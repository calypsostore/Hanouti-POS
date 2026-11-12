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
export type BusinessType = 'cafe' | 'restaurant' | 'bakery' | 'snack' | 'retail' | 'salon'
export type SaleUnit = 'kg' | 'g' | 'piece'
export type IconColor = 'green' | 'blue' | 'amber' | 'rose' | 'violet' | 'teal' | 'slate' | 'orange'
export const ICON_NAMES = [
  'Coffee', 'CupSoda', 'Cake', 'Croissant', 'Cookie', 'IceCream', 'Sandwich',
  'Pizza', 'Soup', 'Salad', 'Utensils', 'UtensilsCrossed', 'Beef', 'Fish',
  'Wine', 'Beer', 'Milk', 'Apple', 'Candy', 'Store', 'ShoppingBasket',
  'ShoppingBag', 'Shirt', 'Gift', 'Pill', 'Scissors', 'Flower2', 'Book',
  'Smartphone', 'Wrench', 'Package', 'Star', 'Heart', 'Flame', 'Leaf',
  'Sparkles', 'Tag',
] as const
export type IconName = typeof ICON_NAMES[number]

export interface StoreFeatures {
  tables: boolean
  kitchenScreen: boolean
  barcode: boolean
  weightItems: boolean
}

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
  colorMode: 'light' | 'dark'
  printer: PrinterSettings
  features: StoreFeatures
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
  icon: IconName
  iconColor: IconColor
  logo?: string
  plan: Plan
  status: StoreStatus
  businessType: BusinessType
  setupComplete: boolean
  createdAt: string
  trialEndsAt?: string
  settings: StoreSettings
}

export interface User {
  id: string
  storeId: string | null
  name: string
  email?: string
  username?: string
  password: string
  pin: string
  role: Role
  active: boolean
  photo?: string
  createdAt: string
  permissions: {
    discount: boolean
    credit: boolean
    settle: boolean
    reports: boolean
    register: boolean
    /** Shift supervisor: sees every register session and the whole team's sales. */
    supervisor: boolean
  }
}

export interface Category {
  id: string
  storeId: string
  name: string
  icon: IconName
  iconColor: IconColor
  sort: number
}

export interface Product {
  id: string
  storeId: string
  categoryId: string
  name: string
  icon: IconName
  iconColor: IconColor
  image?: string
  price: number
  cost: number
  trackStock: boolean
  stock: number
  active: boolean
  barcode?: string
  modifiers?: ProductModifierGroup[]
  variants?: ProductVariant[]
  soldByWeight?: boolean
  saleUnit?: SaleUnit
}

export interface ProductModifierOption {
  id: string
  name: string
  priceDelta: number
}

export interface ProductModifierGroup {
  id: string
  name: string
  selection: 'single' | 'multiple'
  required: boolean
  options: ProductModifierOption[]
}

export interface ProductVariant {
  id: string
  name: string
  size?: string
  color?: string
  price: number
  cost: number
  barcode?: string
  trackStock: boolean
  stock: number
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
  lineId?: string
  productId: string
  name: string
  price: number
  qty: number
  variantId?: string
  variantName?: string
  modifiers?: OrderModifier[]
  note?: string
  saleUnit?: SaleUnit
  soldByWeight?: boolean
}

export interface OrderModifier {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  priceDelta: number
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
  voidedAt?: string
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
  creditAdjustment?: boolean
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
  createdAt?: string
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

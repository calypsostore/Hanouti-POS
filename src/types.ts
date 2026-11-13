export type Role = 'super' | 'admin' | 'manager' | 'staff'
export type Capability =
  | 'manageInventory'
  | 'recordPurchases'
  | 'viewCosts'
  | 'manageStaffAllowances'
  | 'approveOverrides'
  | 'viewReports'
  | 'manageProducts'
  | 'voidOrders'
  | 'manageStaff'
  | 'manageSettings'
  | 'managePayroll'
export type InventoryUnit = 'g' | 'ml' | 'piece'
export type StockMovementType =
  | 'opening'
  | 'purchase'
  | 'sale_use'
  | 'staff_use'
  | 'waste'
  | 'adjustment'
  | 'count_correction'
  | 'void_return'
export type InventoryCategory =
  | 'coffee'
  | 'soft_drinks'
  | 'water'
  | 'dairy'
  | 'pastry'
  | 'packaging'
  | 'other'
  | (string & {})
export type AuditRole = Role | 'unknown'
export type AuditEntity =
  | 'order'
  | 'product'
  | 'category'
  | 'customer'
  | 'staff'
  | 'expense'
  | 'register'
  | 'settings'
  | 'auth'
  | 'payroll'
  | 'shift'
  | 'table'
  | 'inventory'
  | 'purchase'
  | 'supplier'
export type AuditAction =
  | 'created'
  | 'edited'
  | 'deleted'
  | 'voided'
  | 'discount_applied'
  | 'refund_applied'
  | 'debt_payment'
  | 'activated'
  | 'deactivated'
  | 'pin_reset'
  | 'register_opened'
  | 'register_closed'
  | 'settings_updated'
  | 'app_updated'
  | 'backup_exported'
  | 'backup_imported'
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'demo_reset'
  | 'inventory_opening'
  | 'stock_adjusted'
  | 'waste_recorded'
  | 'stock_counted'
export type AuditJsonValue =
  | string
  | number
  | boolean
  | null
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue }

export type PosMode = 'quick' | 'cashier'
export type Plan = 'starter' | 'growth' | 'pro'
export type StoreStatus = 'active' | 'trial' | 'suspended'
export type OrderChannel = 'takeaway' | 'dine-in' | 'delivery'
export type PaymentMethod = 'cash' | 'card' | 'credit' | 'unpaid'
export type OrderStatus = 'open' | 'completed' | 'recorded' | 'void'
export type SettlementCycle = 'monthly' | 'weekly' | 'on-demand'
export type SalaryType = 'daily' | 'monthly' | 'none'
export type AttendanceStatus = 'present' | 'half' | 'absent'
export type AttendanceSource = 'auto' | 'manual'
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
  delivery: boolean
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

export interface PayrollSettings {
  workingDaysPerMonth: number
  fullDayHours: number
  halfDayHours: number
  autoCloseHours: number
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
  payroll: PayrollSettings
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
  salaryType: SalaryType
  salaryAmount: number
  createdAt: string
  permissions: {
    discount: boolean
    credit: boolean
    settle: boolean
    reports: boolean
    register: boolean
    /** Shift supervisor: sees every register session and the whole team's sales. */
    supervisor: boolean
    manageInventory?: boolean
    recordPurchases?: boolean
    viewCosts?: boolean
    manageStaffAllowances?: boolean
    approveOverrides?: boolean
    viewReports?: boolean
    manageProducts?: boolean
    voidOrders?: boolean
    manageStaff?: boolean
    manageSettings?: boolean
    managePayroll?: boolean
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

export interface DiningTable {
  id: string
  storeId: string
  name: string
  seats: number
  zone?: string
  active: boolean
  sort: number
}

export interface InventoryPackage {
  id: string
  label: string
  baseQtyPerPackage: number
}

export interface InventoryItem {
  id: string
  storeId: string
  name: string
  category: InventoryCategory
  baseUnit: InventoryUnit
  packages: InventoryPackage[]
  onHand: number
  reorderLevel: number
  avgCostPerBaseUnit: number
  lastCostPerBaseUnit: number
  supplierId?: string
  active: boolean
}

export interface StockMovement {
  id: string
  storeId: string
  itemId: string
  type: StockMovementType
  qtyDelta: number
  unitCostSnapshot: number
  reason?: string
  userId: string
  userName: string
  refType?: string
  refId?: string
  createdAt: string
}

export interface Supplier {
  id: string
  storeId: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
  active: boolean
  createdAt: string
}

export interface PurchaseLine {
  id: string
  inventoryItemId: string
  itemName: string
  packageId: string
  packageLabel: string
  packageCount: number
  baseQuantity: number
  unitCost: number
  lineTotal: number
}

export interface Purchase {
  id: string
  storeId: string
  supplierId: string
  supplierName: string
  invoiceNumber: string
  receivedAt: string
  lines: PurchaseLine[]
  subtotal: number
  paidAmount: number
  status: 'received' | 'void'
  note: string
  receiptImage?: string
  createdById: string
  createdByName: string
  createdAt: string
  voidedAt?: string
  voidedById?: string
  voidedByName?: string
}

export interface PurchasePayment {
  id: string
  storeId: string
  purchaseId: string
  amount: number
  method: 'cash' | 'card' | 'bank_transfer' | 'other'
  note: string
  userId: string
  userName: string
  createdAt: string
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
  sentAt?: string
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
  tableId?: string
  tableName?: string
  guests?: number
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

export interface OpenOrder {
  id: string
  storeId: string
  tableId: string
  tableName: string
  recordedOrderId?: string
  guests?: number
  items: OrderItem[]
  subtotal: number
  tax: number
  service: number
  discount: number
  total: number
  channel: 'dine-in'
  status: 'open'
  staffId: string
  staffName: string
  note?: string
  createdAt: string
  updatedAt: string
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

export interface Attendance {
  id: string
  storeId: string
  userId: string
  date: string
  clockIn: string
  clockOut?: string
  lastSeen: string
  status: AttendanceStatus
  source: AttendanceSource
  note?: string
}

export interface Advance {
  id: string
  storeId: string
  userId: string
  amount: number
  date: string
  note: string
  status: 'open' | 'deducted'
  payrollId?: string
}

export interface Payroll {
  id: string
  storeId: string
  userId: string
  month: string
  daysWorked: number
  earned: number
  advancesDeducted: number
  netPaid: number
  paidAt: string
  paidBy: string
}

export interface Shift {
  id: string
  storeId: string
  userId: string
  date: string
  startTime: string
  endTime: string
  note?: string
  createdBy: string
  createdAt: string
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

export interface AuditLog {
  id: string
  storeId: string
  userId: string
  userName: string
  role: AuditRole
  action: AuditAction
  entity: AuditEntity
  entityId?: string
  summary: string
  before?: Record<string, AuditJsonValue>
  after?: Record<string, AuditJsonValue>
  createdAt: string
}

export interface Database {
  stores: Store[]
  users: User[]
  categories: Category[]
  tables: DiningTable[]
  inventoryItems: InventoryItem[]
  stockMovements: StockMovement[]
  suppliers: Supplier[]
  purchases: Purchase[]
  purchasePayments: PurchasePayment[]
  products: Product[]
  customers: Customer[]
  orders: Order[]
  openOrders: OpenOrder[]
  ledger: LedgerEntry[]
  expenses: Expense[]
  attendance: Attendance[]
  advances: Advance[]
  payrolls: Payroll[]
  shifts: Shift[]
  registerSessions: RegisterSession[]
  auditLogs: AuditLog[]
}

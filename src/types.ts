export type Role = 'super' | 'admin' | 'manager' | 'staff'
export type Capability =
  | 'manageInventory'
  | 'recordPurchases'
  | 'viewCosts'
  | 'manageStaffAllowances'
  | 'useStaffAllowances'
  | 'approveOverrides'
  | 'viewOrders'
  | 'viewReports'
  | 'viewExpenses'
  | 'addExpenses'
  | 'editExpenses'
  | 'manageProducts'
  | 'voidOrders'
  | 'manageStaff'
  | 'manageSettings'
  | 'managePayroll'
  | 'manageTables'
  | 'manageSections'
  | 'viewStation'
  | 'openShift'
  | 'closeShift'
  | 'takeOverTables'
  | 'forceCloseShift'
  | 'manageCashDifferences'
  | 'viewStaffAnalytics'
  | 'manage86'
  | 'overrideStock'
  | 'manageCustomers'
  | 'viewTabs'
  | 'settleTabs'
  | 'addToTabs'
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
  | 'section'
  | 'station'
  | 'inventory'
  | 'purchase'
  | 'supplier'
  | 'cash_difference'
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
  | 'shift_access_denied'
  | 'cash_difference_resolved'
  | 'cash_difference_voided'
  | 'cash_difference_archived'
  | 'cash_difference_restored'
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
export type TableMode = 'sections_tables' | 'tables_only' | 'manual'
export type GuestRequirement = 'required' | 'optional' | 'off'
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
export type PrintConnection =
  | 'hub-tcp'
  | 'hub-usb'
  | 'hub-serial'
  | 'hub-epson-epos'
  | 'hub-star'
  | 'browser-webserial'
  | 'browser-bluetooth'
  | 'browser-print'
  | 'screen'
export type PrintCodepage = 'cp1252' | 'cp437' | 'cp850' | 'cp858'
export type DevicePrintPreference = 'hub' | 'this-device' | 'browser'
export type PrintJobType = 'receipt' | 'kitchen' | 'bar' | 'report' | 'label' | 'test'
export type PrintJobStatus = 'queued' | 'sending' | 'printed' | 'failed' | 'cancelled'
export type ReceiptPrintPolicy = 'auto' | 'ask' | 'never'
export type TicketPrintPolicy = 'automatic' | 'manual' | 'never'
export type BusinessType = 'cafe' | 'restaurant' | 'bakery' | 'snack' | 'retail' | 'salon'
export type SaleUnit = 'kg' | 'g' | 'piece'
export type TicketSendPolicy = 'done_or_idle' | 'instant' | 'delayed' | 'done_only'
export type OrderItemStatus = 'draft' | 'sent' | 'preparing' | 'ready' | 'served' | 'void'
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

export interface AutomationSettings {
  drawerKickOnCash: boolean
  autoLockMinutes: number
  autoLogoutMinutes: number
  shiftReminders: boolean
  shiftReminderHours: number
  maxShiftHours: number
  cashDifferenceTolerance: number
  warnAboutOpenTablesAtShiftClose: boolean
  lowStockAlerts: boolean
  hideOutOfStock: boolean
  retryPrintJobs: boolean
  fallbackPrintJobs: boolean
  printerRetryLimit: number
  autoReconnectPrinters: boolean
  printerOfflineAlerts: boolean
  printerOfflineAlertMinutes: number
  backupHealthAlerts: boolean
}

export interface ShiftAccessSettings {
  requireOpenShiftForStoreAccess: boolean
  enforceScheduleForShiftOpen: boolean
  allowUnscheduledShiftOpen: boolean
  restrictLoginToSchedule: boolean
  earlyOpenMinutes: number
  lateOpenMinutes: number
}

export type StockOverflowMode = 'block' | 'warn' | 'allow'
export type OpenOrderPricePolicy = 'keep' | 'current' | 'ask'
export type OrderNumberFormat = 'plain' | 'daily' | 'prefix'

export interface RecipeLine {
  inventoryItemId: string
  qtyPerUnit: number
}

export interface StockOverride {
  confirmedById: string
  confirmedByName: string
  requested: number
  available: number
  at: string
}

/** Every order/stock rule lives here so the app and the hub read one config. */
export interface OrderRulesSettings {
  stockOverflowMode: StockOverflowMode
  deductIngredientsOnSale: boolean
  openOrderPricePolicy: OpenOrderPricePolicy
  orderNumberFormat: OrderNumberFormat
  orderNumberPrefix: string
  showLowStockHints: boolean
  revalidationBanner: boolean
  stockOverrideRoles: { admin: boolean; manager: boolean; staff: boolean }
}

export interface AvailabilitySettings {
  enabled: boolean
  autoEightySixAtZero: boolean
  autoReturnOnRestock: boolean
  requireReason: boolean
  reasons: string[]
  defaultReturnMode: 'manual' | 'on_restock' | 'at_time'
  resetManualAtDayStart: boolean
  resetManualAtFirstShift: boolean
  displayStyle: 'big_red_x' | 'dimmed_badge'
  showListButton: boolean
  notifyStaffAboutChanges: boolean
  showCountOnStationScreens: boolean
}

export interface CoffeeTrackingSettings {
  enabled: boolean
  inventoryItemId?: string
  servingsPerKgMin: number
  servingsPerKgMax: number
}

export interface InventoryYieldTracker {
  inventoryItemId: string
  referenceQuantity: number
  servingsMin: number
  servingsMax: number
  productIds: string[]
  categoryIds: string[]
}

export interface InventoryYieldTrackingSettings {
  enabled: boolean
  trackers: InventoryYieldTracker[]
}

export interface StaffConsumptionSettings {
  enabled: boolean
  pricing: 'full_price' | 'discount' | 'free'
  discountPercent: number
  allowances: Array<{ productId: string; maxPerShift: number }>
}

export interface StoreSettings {
  posMode: PosMode
  cashierModeEnabled: boolean
  currency: string
  taxRate: number
  taxInclusive: boolean
  serviceCharge: number
  allowCredit: boolean
  requireCustomerForCredit: boolean
  receiptFooter: string
  lowStockThreshold: number
  tableMode: TableMode
  guestRequirement: GuestRequirement
  staffPickSectionsOnShift: boolean
  requireShiftForOrders: boolean
  allowQuickOpeningFloatEdit: boolean
  staffLoginDestination: 'pos' | 'dashboard'
  shiftAccess: ShiftAccessSettings
  accent: string
  colorMode: 'system' | 'light' | 'dark'
  printer: PrinterSettings
  features: StoreFeatures
  payroll: PayrollSettings
  ticketSendPolicy: TicketSendPolicy
  ticketDelaySeconds: number
  ticketIdleSeconds: number
  stationTimerMinutes: number
  receiptPrintPolicy: ReceiptPrintPolicy
  stationTicketPrintPolicy: TicketPrintPolicy
  reportPrintPolicy: 'manual'
  automation: AutomationSettings
  availability: AvailabilitySettings
  orderRules: OrderRulesSettings
  coffeeTracking: CoffeeTrackingSettings
  inventoryYieldTracking: InventoryYieldTrackingSettings
  staffConsumption: StaffConsumptionSettings
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
  mustChangePassword?: boolean
  password: string
  pin: string
  role: Role
  active: boolean
  photo?: string
  salaryType: SalaryType
  salaryAmount: number
  tabCreditLimit?: number
  createdAt: string
  stationId?: string
  goStraightToStation?: boolean
  stationOnly?: boolean
  attendanceEnabled?: boolean
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
    useStaffAllowances?: boolean
    approveOverrides?: boolean
    viewOrders?: boolean
    viewReports?: boolean
    viewExpenses?: boolean
    addExpenses?: boolean
    editExpenses?: boolean
    manageProducts?: boolean
    voidOrders?: boolean
    manageStaff?: boolean
    manageSettings?: boolean
    managePayroll?: boolean
    manageTables?: boolean
    manageSections?: boolean
    viewStation?: boolean
    openShift?: boolean
    closeShift?: boolean
    takeOverTables?: boolean
    forceCloseShift?: boolean
    manageCashDifferences?: boolean
    viewStaffAnalytics?: boolean
    manage86?: boolean
    /** May confirm an over-stock sale (admin/manager default, staff off). */
    overrideStock?: boolean
    manageCustomers?: boolean
    viewTabs?: boolean
    settleTabs?: boolean
    addToTabs?: boolean
  }
}

export interface Station {
  id: string
  storeId: string
  name: string
  icon: IconName
  color: IconColor
  printerId?: string
  screen: boolean
  active: boolean
  sort: number
}

export interface StationDevice {
  id: string
  storeId: string
  name: string
  stationIds: string[]
  pairingCode?: string
  pairingCodeExpiresAt?: string
  pairedAt?: string
  lastSeenAt?: string
  active: boolean
  deviceTokenHash?: string
}

export interface Printer {
  id: string
  storeId: string
  name: string
  connection: PrintConnection
  host?: string
  port: number
  osPrinterName?: string
  baudRate: number
  paperWidth: PrinterWidth
  codepage: PrintCodepage
  cutMode: 'none' | 'partial' | 'full'
  openDrawerOnCash: boolean
  copies: number
  enabled: boolean
  fallbackPrinterId?: string
}

export interface PrintLine {
  text: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  size?: 'normal' | 'double'
}

export interface PrintJob {
  id: string
  storeId: string
  type: PrintJobType
  stationId?: string
  printerId: string
  payload: PrintLine[]
  copies: number
  createdById: string
  deviceId?: string
  createdAt: string
  status: PrintJobStatus
  attempts: number
  lastError?: string
  openDrawer?: boolean
}

export interface PrintRoute {
  id: string
  storeId: string
  type: PrintJobType
  stationId?: string
  printerId?: string
}

export interface Category {
  id: string
  storeId: string
  name: string
  icon: IconName
  iconColor: IconColor
  stationId?: string
  sort: number
}

export interface DiningTable {
  id: string
  storeId: string
  name: string
  seats: number
  sectionId?: string
  active: boolean
  sort: number
}

export interface TableSection {
  id: string
  storeId: string
  name: string
  color: IconColor
  icon: IconName
  sort: number
  active: boolean
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

export interface EightySixState {
  active: boolean
  at: string
  byId: string
  reason?: string
  returnMode: 'manual' | 'on_restock' | 'at_time'
  backAt?: string
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
  shiftId?: string
}

export interface Product {
  id: string
  storeId: string
  categoryId: string
  stationId?: string | null // null overrides category routing and leaves the product unsent.
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
  inventoryItemId?: string
  eightySix?: EightySixState
  recipe?: RecipeLine[]
}

export interface ProductModifierOption {
  id: string
  name: string
  priceDelta: number
  recipe?: RecipeLine[]
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
  eightySix?: EightySixState
  recipe?: RecipeLine[]
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
  stationId?: string
  sentAt?: string
  status?: OrderItemStatus
  addedAt?: string
  updatedAt?: string
  noteCorrectionAt?: string
  addedById?: string
  addedByName?: string
  voidReason?: string
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
  /** Accepted over-stock confirmation, validated by the store and the hub. */
  stockOverride?: StockOverride
}

export interface OrderModifier {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  priceDelta: number
}

export interface TableOrderEvent {
  id: string
  type: 'opened' | 'items_added' | 'items_removed' | 'guests_changed' | 'moved' | 'merged' | 'transferred' | 'payment' | 'closed' | 'voided'
  actorId: string
  actorName: string
  at: string
  details?: string
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
  taxRate?: number
  channel: OrderChannel
  tableId?: string
  tableName?: string
  sectionId?: string
  sectionName?: string
  guests?: number
  status: OrderStatus
  paymentMethod: PaymentMethod
  customerId?: string
  shiftId?: string
  staffId: string
  staffName: string
  paidById?: string
  paidByName?: string
  ownerStaffId?: string
  ownerStaffName?: string
  note?: string
  createdAt: string
  voidedById?: string
  voidedByName?: string
  voidedAt?: string
  voidShiftId?: string
  tableHistory?: TableOrderEvent[]
  /** Idempotency key for checkout retries. */
  clientOrderId?: string
  staffConsumption?: boolean
  /** Device-prefixed number shown offline until the hub assigns the real one. */
  provisionalNumber?: string
}

export interface OpenOrder {
  id: string
  storeId: string
  number: number
  provisionalNumber?: string
  shiftId?: string
  tableId?: string
  tableName: string
  sectionId?: string
  sectionName?: string
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
  tableHistory?: TableOrderEvent[]
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
  shiftId?: string
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
  shiftId?: string
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
  recordedCount?: number
  recordedTotal?: number
}

export interface RegisterItemRow {
  key: string
  productId: string
  variantId?: string
  category: string
  name: string
  qty: number
  soldByWeight: boolean
  saleUnit?: SaleUnit
  unitPrice: number | null
  total: number
}

export interface RegisterVoidedItemRow extends RegisterItemRow {
  voidedByName: string
}

export interface RegisterItemsReport {
  itemsSold: RegisterItemRow[]
  recordedItems: RegisterItemRow[]
  voidedItems: RegisterVoidedItemRow[]
}

export interface RegisterSessionBreakdown {
  sessionId: string
  name: string
  role: Role | 'unknown'
  orders: number
  cash: number
  card: number
  credit: number
  discounts: number
  voids: number
  staffItemOrders: number
  staffItemTotal: number
  expectedCash: number
}

export interface RegisterReportDetails {
  storeName: string
  storeAddress: string
  storeCity: string
  storePhone: string
  receiptWidth: PrinterWidth
  grossSales: number
  netSales: number
  completedOrders: number
  totalTransactions: number
  storeCreditRefunds: number
  cashReceived: number
  cashExpenses: number
  supplierCashPayments: number
  taxBreakdown: Array<{ rate: number | null; amount: number }>
  byEmployee: Array<{ name: string; count: number; total: number }>
  sessionBreakdown?: RegisterSessionBreakdown[]
  byCategory: Array<{ name: string; qty: number; total: number }>
  itemsSold?: RegisterItemRow[]
  recordedItems?: RegisterItemRow[]
  voidedItems?: RegisterVoidedItemRow[]
  voidedOrders: Array<{
    number: number
    total: number
    paymentMethod: PaymentMethod
    reason: string
    items: string[]
  }>
  cancelledItems: Array<{
    tableName: string
    total: number
    items: string[]
  }>
  staffConsumptions?: Array<{ staffName: string; itemName: string; quantity: number; retailValue: number; chargedValue: number }>
  inventoryYieldSummaries?: Array<{
    itemName: string
    soldQuantity: number
    referenceQuantity: number
    expectedUseMin: number
    expectedUseMax: number
    recipeUse: number
    expectedRemainingMin: number
    expectedRemainingMax: number
    ledgerRemaining: number
    unit: InventoryUnit
  }>
  coffeeBeanSummary?: {
    itemName: string
    servingsSold: number
    expectedUseMin: number
    expectedUseMax: number
    recipeUse: number
    expectedRemainingMin?: number
    expectedRemainingMax?: number
    ledgerRemaining?: number
    unit: InventoryUnit
  }
}

export interface RegisterSession {
  id: string
  storeId: string
  status: 'open' | 'closed'
  closeType?: 'shift'
  openedAt: string
  openedById: string
  openedByName: string
  staffId?: string
  shiftNumber?: string
  openingCash: number
  autoOpened?: boolean
  openingFloat?: number
  declaredSales?: number
  expectedSales?: number
  leaveFloatForNextShift?: boolean
  closedAt?: string
  closedById?: string
  closedByName?: string
  countedCash?: number
  difference?: number
  note?: string
  snapshot?: RegisterSnapshot
  zReportNumber?: number
  reportDetails?: RegisterReportDetails
}

export interface RegisterDayReport {
  id: string
  storeId: string
  date: string
  closedAt: string
  closedById: string
  closedByName: string
  zReportNumber: number
  openingCash: number
  countedCash: number
  difference: number
  note?: string
  snapshot: RegisterSnapshot
  reportDetails: RegisterReportDetails
  quickShiftSummary?: QuickShiftDaySummary
}

export interface QuickShiftDayEntry {
  shiftId: string
  staffId: string
  staffName: string
  openedAt: string
  closedAt?: string
  openingFloat: number
  countedCash?: number
  declaredSales: number
  expectedSales?: number
  difference: number
  correctionEntries: CashDifferenceCorrection[]
  note?: string
  forceClosed: boolean
}

export interface QuickShiftDaySummary {
  shifts: QuickShiftDayEntry[]
  declaredSales: number
  retainedFloat: number
  expectedCash: number
  countedCash: number
  difference: number
  staffDifferences: Array<{ staffId: string; staffName: string; amount: number }>
}

export type CashDifferenceStatus = 'open' | 'settled' | 'voided' | 'archived'
export type CashDifferenceResolution = 'paid_back' | 'salary_deduction' | 'waived' | 'error_voided' | 'other'

export interface CashDifference {
  id: string
  storeId: string
  staffId: string
  shiftId: string
  amount: number
  type: 'shortage' | 'overage'
  status: CashDifferenceStatus
  createdAt: string
  resolvedAt?: string
  resolvedById?: string
  resolution?: CashDifferenceResolution
  note?: string
  correctionEntries?: CashDifferenceCorrection[]
  archivedFromStatus?: Exclude<CashDifferenceStatus, 'archived'>
}

export interface CashDifferenceCorrection {
  id: string
  amount: number
  staffId: string
  staffName: string
  at: string
  note?: string
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
  stations: Station[]
  stationDevices: StationDevice[]
  printers: Printer[]
  printRoutes: PrintRoute[]
  printJobs: PrintJob[]
  categories: Category[]
  sections: TableSection[]
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
  registerDayReports: RegisterDayReport[]
  cashDifferences: CashDifference[]
  auditLogs: AuditLog[]
}

import type {
  AttendanceStatus, BusinessType, Category, Customer, Database, InventoryCategory, InventoryUnit,
  Order, OrderChannel, OrderItem, OrderItemStatus, OpenOrder, PaymentMethod, Product, Purchase, SalaryType,
  Station, Store, StoreSettings, StoreStatus, TableSection, User,
} from '../types'

export type Result = { ok: true } | { ok: false; error: string }
export type ActorResult = { ok: true; actor: User } | { ok: false; error: string }
export type BackupExportResult =
  | { ok: true; database: Database }
  | { ok: false; error: string }

export interface CreateOrderInput {
  items: OrderItem[]
  channel: OrderChannel
  tableId?: string
  tableName?: string
  guests?: number
  paymentMethod: PaymentMethod
  customerId?: string
  discount?: number
  note?: string
}

export interface CreateStoreInput {
  name: string
  slug: string
  ownerName: string
  ownerEmail: string
  phone: string
  address: string
  city: string
  adminName: string
  adminEmail: string
  adminPassword: string
  adminPin: string
}

export interface AddStaffInput {
  role?: 'staff' | 'manager'
  name: string
  username: string
  pin: string
  active: boolean
  salaryType: SalaryType
  salaryAmount: number
  photo?: string
  permissions: User['permissions']
}

export interface InventoryItemInput {
  name: string
  category: InventoryCategory
  baseUnit: InventoryUnit
  packages: Array<{ label: string; baseQtyPerPackage: number }>
  reorderLevel: number
}

export type InventoryItemPatch = Partial<InventoryItemInput> & { active?: boolean }

export interface SupplierInput {
  name: string
  phone: string
  email: string
  address: string
  notes: string
  active?: boolean
}

export interface PurchaseLineInput {
  inventoryItemId: string
  packageId: string
  packageCount: number
  unitCost: number
}

export interface PurchaseInput {
  supplierId: string
  invoiceNumber: string
  receivedAt: string
  lines: PurchaseLineInput[]
  note: string
  receiptImage?: string
}

export type PurchaseResult = { ok: true; purchase: Purchase } | { ok: false; error: string }

export interface ManualAttendanceInput {
  date: string
  status: AttendanceStatus
  clockIn?: string
  clockOut?: string
  note?: string
}

export interface ShiftInput {
  date: string
  startTime: string
  endTime: string
  note?: string
}

export interface DiningTableInput {
  name: string
  seats: number
  sectionId?: string
  active?: boolean
  sort?: number
}

export interface TableSectionInput {
  name: string
  color: TableSection['color']
  icon: TableSection['icon']
  active?: boolean
  sort?: number
}

export type OpenOrderActionResult =
  | { ok: true; order: OpenOrder }
  | { ok: false; error: string }

export type RecordedOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: string }

export type KitchenSendResult =
  | { ok: true; order: OpenOrder; items: OrderItem[] }
  | { ok: false; error: string }
export type SentItemVoidResult =
  | { ok: true; order: OpenOrder; item: OrderItem }
  | { ok: false; error: string }

export type PaidOpenOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: string }

export interface AddAdvanceInput {
  amount: number
  date: string
  note: string
}

export interface AppContextValue {
  db: Database
  databaseReady: boolean
  databaseError: string
  user: User | null
  store: Store | null
  login: (email: string, password: string) => Promise<Result>
  loginPin: (username: string, pin: string) => Promise<Result>
  logout: () => void
  createOrder: (input: CreateOrderInput) => { ok: true; order: Order } | { ok: false; error: string }
  addTable: (storeId: string, data: Pick<DiningTableInput, 'name' | 'seats' | 'sectionId'>) => Result
  updateTable: (id: string, patch: Partial<DiningTableInput>) => Result
  deleteTable: (id: string) => Result
  addSection: (storeId: string, data: TableSectionInput) => Result
  updateSection: (id: string, patch: Partial<TableSectionInput>) => Result
  deleteSection: (id: string) => Result
  openTableOrder: (storeId: string, tableId: string | undefined, guests?: number, tableName?: string) => OpenOrderActionResult
  recordOpenOrder: (orderId: string) => RecordedOrderResult
  addItemsToOpenOrder: (
    orderId: string,
    items: OrderItem[],
    discount?: number,
    note?: string,
  ) => OpenOrderActionResult
  sendToStations: (orderId: string) => KitchenSendResult
  updateOpenOrderItem: (orderId: string, lineId: string, patch: { qty?: number; note?: string }) => Result
  setOpenOrderItemStatus: (orderId: string, lineId: string, status: OrderItemStatus) => Result
  voidSentOrderItem: (orderId: string, lineId: string, reason: string) => SentItemVoidResult
  payOpenOrder: (
    orderId: string,
    paymentMethod: PaymentMethod,
    customerId?: string,
  ) => PaidOpenOrderResult
  moveOrderToTable: (orderId: string, tableId: string) => Result
  mergeTableOrders: (sourceOrderId: string, targetOrderId: string) => Result
  cancelOpenOrder: (orderId: string, managerPin: string) => Promise<Result>
  voidOrder: (orderId: string, managerPin?: string, reason?: string) => Promise<Result>
  openRegister: (storeId: string, openingCash: number) => Result
  closeRegister: (sessionId: string, countedCash: number, note?: string) => Result
  settleCredit: (customerId: string, amount: number, method: 'cash' | 'card', note?: string) => Result
  addCategory: (storeId: string, data: Pick<Category, 'name' | 'icon' | 'iconColor' | 'stationId'>) => Result
  updateCategory: (id: string, patch: Partial<Category>) => Result
  deleteCategory: (id: string) => Result
  addProduct: (storeId: string, data: Omit<Product, 'id' | 'storeId'>) => Result
  updateProduct: (id: string, patch: Partial<Product>) => Result
  deleteProduct: (id: string) => Result
  addStation: (storeId: string, data: Pick<Station, 'name' | 'icon' | 'color' | 'screen'>) => Result
  updateStation: (id: string, patch: Partial<Station>) => Result
  deleteStation: (id: string) => Result
  reorderStations: (storeId: string, ids: string[]) => Result
  bulkAssignProductStation: (storeId: string, productIds: string[], stationId?: string) => Result
  bulkAssignCategoryStation: (storeId: string, categoryIds: string[], stationId?: string) => Result
  addInventoryItem: (storeId: string, data: InventoryItemInput) => Result
  updateInventoryItem: (id: string, patch: InventoryItemPatch) => Result
  recordOpeningStock: (itemId: string, quantity: number, reason?: string) => Result
  recordWaste: (itemId: string, quantity: number, reason: string) => Result
  adjustStock: (itemId: string, quantityDelta: number, reason: string) => Result
  recordStockCount: (itemId: string, actualQuantity: number, reason: string) => Result
  addSupplier: (storeId: string, data: SupplierInput) => Result
  updateSupplier: (id: string, patch: Partial<SupplierInput>) => Result
  addPurchase: (storeId: string, data: PurchaseInput) => PurchaseResult
  updatePurchase: (id: string, data: PurchaseInput) => Result
  recordPurchasePayment: (
    purchaseId: string,
    data: { amount: number; method: 'cash' | 'card' | 'bank_transfer' | 'other'; note: string },
  ) => Result
  voidPurchase: (id: string, reason: string) => Result
  addStaff: (storeId: string, data: AddStaffInput) => Promise<Result>
  updateStaff: (id: string, patch: Partial<User>) => Promise<Result>
  deleteStaff: (id: string) => Result
  addCustomer: (
    storeId: string,
    data: { name: string; phone: string; limit: number; notes: string; cycle: Customer['cycle'] },
  ) => Result
  updateCustomer: (id: string, patch: Partial<Customer>) => Result
  deleteCustomer: (id: string) => Result
  addExpense: (storeId: string, data: { category: string; note: string; amount: number; date: string }) => Result
  updateExpense: (id: string, data: { category: string; note: string; amount: number; date: string }) => Result
  deleteExpense: (id: string) => Result
  addAdvance: (storeId: string, userId: string, data: AddAdvanceInput) => Result
  paySalary: (storeId: string, userId: string, month: string) => Result
  saveManualAttendance: (storeId: string, userId: string, data: ManualAttendanceInput) => Result
  addShift: (storeId: string, userId: string, data: ShiftInput) => Result
  updateShift: (id: string, patch: Partial<ShiftInput>) => Result
  deleteShift: (id: string) => Result
  updateSettings: (storeId: string, patch: Partial<StoreSettings>) => Result
  completeBusinessSetup: (storeId: string, businessType: BusinessType) => Result
  createStore: (data: CreateStoreInput) => Promise<Result>
  updateStore: (storeId: string, patch: Partial<Store>) => Result
  setStoreStatus: (storeId: string, status: StoreStatus) => Result
  changePlan: (storeId: string, plan: Store['plan']) => Result
  exportDatabaseBackup: () => BackupExportResult
  importDatabaseBackup: (value: unknown) => Promise<Result>
  resetDemo: (confirmation: string) => Promise<Result>
}

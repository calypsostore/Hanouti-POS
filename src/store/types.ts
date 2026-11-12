import type {
  BusinessType, Category, Customer, Database, Order, OrderChannel, OrderItem,
  PaymentMethod, Product, Store, StoreSettings, StoreStatus, User,
} from '../types'

export type Result = { ok: true } | { ok: false; error: string }
export type ActorResult = { ok: true; actor: User } | { ok: false; error: string }

export interface CreateOrderInput {
  items: OrderItem[]
  channel: OrderChannel
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
  name: string
  username: string
  pin: string
  active: boolean
  photo?: string
  permissions: User['permissions']
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
  voidOrder: (orderId: string, managerPin?: string, reason?: string) => Promise<Result>
  openRegister: (storeId: string, openingCash: number) => Result
  closeRegister: (sessionId: string, countedCash: number, note?: string) => Result
  settleCredit: (customerId: string, amount: number, method: 'cash' | 'card', note?: string) => Result
  addCategory: (storeId: string, data: Pick<Category, 'name' | 'icon' | 'iconColor'>) => Result
  updateCategory: (id: string, patch: Partial<Category>) => Result
  deleteCategory: (id: string) => Result
  addProduct: (storeId: string, data: Omit<Product, 'id' | 'storeId'>) => Result
  updateProduct: (id: string, patch: Partial<Product>) => Result
  deleteProduct: (id: string) => Result
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
  updateSettings: (storeId: string, patch: Partial<StoreSettings>) => Result
  completeBusinessSetup: (storeId: string, businessType: BusinessType) => Result
  createStore: (data: CreateStoreInput) => Promise<Result>
  updateStore: (storeId: string, patch: Partial<Store>) => Result
  setStoreStatus: (storeId: string, status: StoreStatus) => Result
  changePlan: (storeId: string, plan: Store['plan']) => Result
  resetDemo: () => Promise<Result>
}

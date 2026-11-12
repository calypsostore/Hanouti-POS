import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  Category,
  Customer,
  Database,
  Order,
  OrderChannel,
  OrderItem,
  PaymentMethod,
  Product,
  Store,
  StoreSettings,
  StoreStatus,
  User,
} from '../types'
import { buildSeed } from '../data/seed'
import { computeTotals } from '../lib/pricing'
import { round } from '../lib/pricing-utils'
import { isoDaysAgo, uid } from '../lib/utils'
import { balanceFor } from '../lib/selectors'
import { applyAccent } from '../lib/theme'

const DB_KEY = 'cafepos.db.v3'
const SESSION_KEY = 'cafepos.session.v2'

type Result = { ok: true } | { ok: false; error: string }

interface CreateOrderInput {
  items: OrderItem[]
  channel: OrderChannel
  paymentMethod: PaymentMethod
  customerId?: string
  discount?: number
  note?: string
}

interface AppContextValue {
  db: Database
  user: User | null
  store: Store | null
  login: (email: string, password: string) => Result
  loginPin: (slug: string, pin: string) => Result
  logout: () => void
  createOrder: (input: CreateOrderInput) => { ok: true; order: Order } | { ok: false; error: string }
  voidOrder: (orderId: string) => void
  settleCredit: (customerId: string, amount: number, method: 'cash' | 'card', note?: string) => Result
  addCategory: (storeId: string, data: { name: string; emoji: string }) => void
  updateCategory: (id: string, patch: Partial<Category>) => void
  deleteCategory: (id: string) => Result
  addProduct: (storeId: string, data: Omit<Product, 'id' | 'storeId'>) => void
  updateProduct: (id: string, patch: Partial<Product>) => void
  deleteProduct: (id: string) => void
  addStaff: (storeId: string, data: Omit<User, 'id' | 'storeId' | 'createdAt'>) => Result
  updateStaff: (id: string, patch: Partial<User>) => void
  deleteStaff: (id: string) => Result
  addCustomer: (storeId: string, data: { name: string; phone: string; limit: number; notes: string }) => void
  updateCustomer: (id: string, patch: Partial<Customer>) => void
  deleteCustomer: (id: string) => Result
  addExpense: (storeId: string, data: { category: string; note: string; amount: number; date: string }) => void
  deleteExpense: (id: string) => void
  updateSettings: (storeId: string, patch: Partial<StoreSettings>) => void
  updateStore: (storeId: string, patch: Partial<Store>) => void
  setStoreStatus: (storeId: string, status: StoreStatus) => void
  changePlan: (storeId: string, plan: Store['plan']) => void
  resetDemo: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

const loadDb = (): Database => {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Database
      if (parsed?.stores?.length && parsed?.users?.length) return parsed
    }
  } catch {
    /* corrupted cache — rebuild */
  }
  return buildSeed()
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(loadDb)
  const [userId, setUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db))
    } catch {
      /* storage full — ignore in demo */
    }
  }, [db])

  useEffect(() => {
    try {
      if (userId) localStorage.setItem(SESSION_KEY, userId)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [userId])

  const user = useMemo(() => db.users.find((u) => u.id === userId) ?? null, [db.users, userId])
  const store = useMemo(
    () => (user?.storeId ? db.stores.find((s) => s.id === user.storeId) ?? null : null),
    [db.stores, user],
  )

  useEffect(() => {
    applyAccent(store?.settings.accent ?? 'caramel')
  }, [store?.settings.accent])

  const login = useCallback(
    (email: string, password: string): Result => {
      const found = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
      if (!found || found.password !== password) {
        return { ok: false, error: 'Incorrect email or password.' }
      }
      if (!found.active) return { ok: false, error: 'This account has been deactivated.' }
      if (found.storeId) {
        const owner = db.stores.find((s) => s.id === found.storeId)
        if (owner?.status === 'suspended') {
          return { ok: false, error: 'This store is suspended. Contact the platform owner.' }
        }
      }
      setUserId(found.id)
      return { ok: true }
    },
    [db.users, db.stores],
  )

  const loginPin = useCallback(
    (slug: string, pin: string): Result => {
      const needle = slug.trim().toLowerCase()
      const target = db.stores.find(
        (s) => s.slug.toLowerCase() === needle || s.id.toLowerCase() === needle,
      )
      if (!target) return { ok: false, error: 'Store code not found.' }
      if (target.status === 'suspended') {
        return { ok: false, error: 'This store is suspended. Contact your manager.' }
      }
      const found = db.users.find(
        (u) => u.storeId === target.id && u.pin === pin.trim() && u.active,
      )
      if (!found) return { ok: false, error: 'PIN not recognised for this store.' }
      setUserId(found.id)
      return { ok: true }
    },
    [db.stores, db.users],
  )

  const logout = useCallback(() => setUserId(null), [])

  const createOrder = useCallback<AppContextValue['createOrder']>(
    (input) => {
      const seller = db.users.find((u) => u.id === userId)
      if (!seller?.storeId) return { ok: false, error: 'No active session.' }
      const target = db.stores.find((s) => s.id === seller.storeId)
      if (!target) return { ok: false, error: 'Store not found.' }
      if (!input.items.length) return { ok: false, error: 'Cart is empty.' }
      if (input.paymentMethod === 'credit') {
        if (!target.settings.allowCredit) return { ok: false, error: 'Credit tabs are disabled for this store.' }
        if (!input.customerId) return { ok: false, error: 'Select a customer to add this order to a tab.' }
      }

      const discount = round(input.discount ?? 0)
      const totals = computeTotals(input.items, target.settings, discount, input.channel)
      const orderNo =
        db.orders.filter((o) => o.storeId === target.id).reduce((max, o) => Math.max(max, o.number), 1000) + 1
      const order: Order = {
        id: uid('ord'),
        storeId: target.id,
        number: orderNo,
        items: input.items,
        subtotal: totals.subtotal,
        tax: totals.tax,
        service: totals.service,
        discount,
        total: totals.total,
        channel: input.channel,
        status: 'completed',
        paymentMethod: input.paymentMethod,
        customerId: input.customerId,
        staffId: seller.id,
        staffName: seller.name,
        note: input.note,
        createdAt: new Date().toISOString(),
      }

      setDb((prev) => ({
        ...prev,
        orders: [order, ...prev.orders],
        products: prev.products.map((p) => {
          const line = input.items.find((it) => it.productId === p.id)
          if (!line || !p.trackStock) return p
          return { ...p, stock: Math.max(0, p.stock - line.qty) }
        }),
        ledger:
          input.paymentMethod === 'credit' && input.customerId
            ? [
                {
                  id: uid('led'),
                  storeId: target.id,
                  customerId: input.customerId,
                  type: 'charge' as const,
                  amount: order.total,
                  orderId: order.id,
                  staffName: seller.name,
                  createdAt: order.createdAt,
                },
                ...prev.ledger,
              ]
            : prev.ledger,
      }))
      return { ok: true, order }
    },
    [db.users, db.stores, db.orders, userId],
  )

  const voidOrder = useCallback(
    (orderId: string) => {
      setDb((prev) => {
        const order = prev.orders.find((o) => o.id === orderId)
        if (!order || order.status === 'void') return prev
        const reversal =
          order.paymentMethod === 'credit' && order.customerId
            ? [
                {
                  id: uid('led'),
                  storeId: order.storeId,
                  customerId: order.customerId,
                  type: 'charge' as const,
                  amount: -order.total,
                  orderId: order.id,
                  note: `Voided order #${order.number}`,
                  createdAt: new Date().toISOString(),
                },
              ]
            : []
        return {
          ...prev,
          orders: prev.orders.map((o) => (o.id === orderId ? { ...o, status: 'void' } : o)),
          ledger: [...reversal, ...prev.ledger],
        }
      })
    },
    [],
  )

  const settleCredit = useCallback<AppContextValue['settleCredit']>(
    (customerId, amount, method, note) => {
      const customer = db.customers.find((c) => c.id === customerId)
      if (!customer) return { ok: false, error: 'Customer not found.' }
      const balance = balanceFor(db.ledger, customerId)
      if (amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.' }
      if (amount > balance + 0.0001) {
        return { ok: false, error: `Amount exceeds the outstanding balance (${balance.toFixed(3)} DT).` }
      }
      const staff = db.users.find((u) => u.id === userId)
      setDb((prev) => ({
        ...prev,
        ledger: [
          {
            id: uid('led'),
            storeId: customer.storeId,
            customerId,
            type: 'payment',
            amount: round(amount),
            method,
            note: note || 'Tab settlement',
            staffName: staff?.name ?? 'Staff',
            createdAt: new Date().toISOString(),
          },
          ...prev.ledger,
        ],
      }))
      return { ok: true }
    },
    [db.customers, db.ledger, db.users, userId],
  )

  const addCategory = useCallback<AppContextValue['addCategory']>((storeId, data) => {
    setDb((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        {
          id: uid('cat'),
          storeId,
          name: data.name,
          emoji: data.emoji || '🍽️',
          sort: prev.categories.filter((c) => c.storeId === storeId).length,
        },
      ],
    }))
  }, [])

  const updateCategory = useCallback<AppContextValue['updateCategory']>((id, patch) => {
    setDb((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }, [])

  const deleteCategory = useCallback<AppContextValue['deleteCategory']>(
    (id) => {
      const products = db.products.filter((p) => p.categoryId === id)
      if (products.length) {
        return { ok: false, error: `Move or delete the ${products.length} item(s) in this category first.` }
      }
      setDb((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== id) }))
      return { ok: true }
    },
    [db.products],
  )

  const addProduct = useCallback<AppContextValue['addProduct']>((storeId, data) => {
    setDb((prev) => ({
      ...prev,
      products: [...prev.products, { ...data, id: uid('prd'), storeId }],
    }))
  }, [])

  const updateProduct = useCallback<AppContextValue['updateProduct']>((id, patch) => {
    setDb((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }, [])

  const deleteProduct = useCallback<AppContextValue['deleteProduct']>((id) => {
    setDb((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }))
  }, [])

  const addStaff = useCallback<AppContextValue['addStaff']>(
    (storeId, data) => {
      if (db.users.some((u) => u.email.toLowerCase() === data.email.trim().toLowerCase())) {
        return { ok: false, error: 'That email is already in use.' }
      }
      if (db.users.some((u) => u.storeId === storeId && u.pin === data.pin)) {
        return { ok: false, error: 'That PIN is already used by another team member.' }
      }
      setDb((prev) => ({
        ...prev,
        users: [
          ...prev.users,
          {
            ...data,
            email: data.email.trim(),
            id: uid('usr'),
            storeId,
            createdAt: new Date().toISOString(),
          },
        ],
      }))
      return { ok: true }
    },
    [db.users],
  )

  const updateStaff = useCallback<AppContextValue['updateStaff']>((id, patch) => {
    setDb((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    }))
  }, [])

  const deleteStaff = useCallback<AppContextValue['deleteStaff']>(
    (id) => {
      const remainingAdmins = db.users.filter(
        (u) => u.storeId === db.users.find((x) => x.id === id)?.storeId && u.role === 'admin' && u.active,
      )
      if (remainingAdmins.length <= 1 && remainingAdmins.some((u) => u.id === id)) {
        return { ok: false, error: 'You cannot remove the only store admin.' }
      }
      setDb((prev) => ({ ...prev, users: prev.users.filter((u) => u.id !== id) }))
      return { ok: true }
    },
    [db.users],
  )

  const addCustomer = useCallback<AppContextValue['addCustomer']>((storeId, data) => {
    setDb((prev) => ({
      ...prev,
      customers: [
        ...prev.customers,
        {
          id: uid('cus'),
          storeId,
          name: data.name.trim(),
          phone: data.phone.trim(),
          limit: data.limit,
          notes: data.notes.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    }))
  }, [])

  const updateCustomer = useCallback<AppContextValue['updateCustomer']>((id, patch) => {
    setDb((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }, [])

  const deleteCustomer = useCallback<AppContextValue['deleteCustomer']>(
    (id) => {
      const balance = balanceFor(db.ledger, id)
      if (balance > 0) return { ok: false, error: 'Settle the outstanding balance before removing this customer.' }
      setDb((prev) => ({
        ...prev,
        customers: prev.customers.filter((c) => c.id !== id),
        ledger: prev.ledger.filter((l) => l.customerId !== id),
      }))
      return { ok: true }
    },
    [db.ledger],
  )

  const addExpense = useCallback<AppContextValue['addExpense']>((storeId, data) => {
    const staff = db.users.find((u) => u.storeId === storeId)
    setDb((prev) => ({
      ...prev,
      expenses: [
        {
          id: uid('exp'),
          storeId,
          category: data.category,
          note: data.note,
          amount: round(data.amount),
          date: data.date || isoDaysAgo(0, 12, 0),
          createdBy: staff?.name ?? 'Admin',
        },
        ...prev.expenses,
      ],
    }))
  }, [db.users])

  const deleteExpense = useCallback<AppContextValue['deleteExpense']>((id) => {
    setDb((prev) => ({ ...prev, expenses: prev.expenses.filter((e) => e.id !== id) }))
  }, [])

  const updateSettings = useCallback<AppContextValue['updateSettings']>((storeId, patch) => {
    setDb((prev) => ({
      ...prev,
      stores: prev.stores.map((s) =>
        s.id === storeId ? { ...s, settings: { ...s.settings, ...patch } } : s,
      ),
    }))
  }, [])

  const updateStore = useCallback<AppContextValue['updateStore']>((storeId, patch) => {
    setDb((prev) => ({
      ...prev,
      stores: prev.stores.map((s) => (s.id === storeId ? { ...s, ...patch } : s)),
    }))
  }, [])

  const setStoreStatus = useCallback<AppContextValue['setStoreStatus']>((storeId, status) => {
    setDb((prev) => ({
      ...prev,
      stores: prev.stores.map((s) => (s.id === storeId ? { ...s, status } : s)),
    }))
  }, [])

  const changePlan = useCallback<AppContextValue['changePlan']>((storeId, plan) => {
    setDb((prev) => ({
      ...prev,
      stores: prev.stores.map((s) => (s.id === storeId ? { ...s, plan } : s)),
    }))
  }, [])

  const resetDemo = useCallback(() => {
    const fresh = buildSeed()
    setDb(fresh)
    setUserId(null)
  }, [])

  const value: AppContextValue = {
    db,
    user,
    store,
    login,
    loginPin,
    logout,
    createOrder,
    voidOrder,
    settleCredit,
    addCategory,
    updateCategory,
    deleteCategory,
    addProduct,
    updateProduct,
    deleteProduct,
    addStaff,
    updateStaff,
    deleteStaff,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addExpense,
    deleteExpense,
    updateSettings,
    updateStore,
    setStoreStatus,
    changePlan,
    resetDemo,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

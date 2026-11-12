import type {
  Category,
  Customer,
  BusinessType,
  Database,
  Expense,
  IconName,
  LedgerEntry,
  Order,
  Plan,
  Product,
  RegisterSession,
  RegisterSnapshot,
  SettlementCycle,
  Store,
  StoreSettings,
  User,
} from '../types'
import { isoDaysAgo, uid } from '../lib/utils'
import { DEFAULT_PRINTER } from '../lib/defaults'
import { businessTemplate } from '../lib/businessTemplates'

export const PLAN_INFO: Record<Plan, { label: string; price: number; blurb: string }> = {
  starter: { label: 'Starter', price: 29, blurb: 'Single counter, up to 3 staff' },
  growth: { label: 'Growth', price: 59, blurb: 'Unlimited staff, credit tabs, reports' },
  pro: { label: 'Pro', price: 99, blurb: 'Multi-device, advanced analytics, priority support' },
}

const defaultSettings = (
  over: Partial<StoreSettings> = {},
  businessType: BusinessType = 'cafe',
): StoreSettings => ({
  posMode: businessTemplate(businessType).posMode,
  currency: 'TND',
  taxRate: 0,
  taxInclusive: true,
  serviceCharge: 0,
  allowCredit: true,
  requireCustomerForCredit: true,
  receiptFooter: businessTemplate(businessType).receiptFooter,
  lowStockThreshold: 10,
  accent: '7anouti',
  colorMode: 'light',
  printer: { ...DEFAULT_PRINTER },
  features: businessTemplate(businessType).features,
  ...over,
})

// categoryIndex, name, icon, price, cost
const cafeCatalog: Array<[number, string, IconName, number, number]> = [
  [0, 'Espresso', 'Coffee', 2.2, 0.7],
  [0, 'Direct', 'Coffee', 2.4, 0.7],
  [0, 'Cappuccino', 'Coffee', 3.5, 1.1],
  [0, 'Café au Lait', 'Coffee', 3.8, 1.2],
  [0, 'Café Crème', 'Coffee', 4.0, 1.3],
  [0, 'Americano', 'Coffee', 3.0, 0.8],
  [1, 'Thé à la Menthe', 'Coffee', 2.5, 0.4],
  [1, 'Thé au Jasmin', 'Coffee', 2.5, 0.4],
  [1, 'Verveine', 'Leaf', 2.8, 0.5],
  [2, 'Citronnade', 'Apple', 4.0, 1.0],
  [2, 'Jus d’Orange', 'Apple', 5.0, 1.6],
  [2, 'Jus de Fraise', 'Apple', 5.5, 2.0],
  [3, 'Croissant', 'Croissant', 2.8, 0.9],
  [3, 'Pain au Chocolat', 'Cookie', 3.2, 1.0],
  [3, 'Cake au Chocolat', 'Cake', 4.0, 1.5],
  [4, 'Mlewi', 'Sandwich', 4.5, 1.2],
  [4, 'Brik à l’Œuf', 'Sandwich', 3.5, 1.3],
  [4, 'Sandwich Thon', 'Sandwich', 7.5, 3.2],
  [4, 'Sandwich Poulet', 'Sandwich', 8.5, 3.8],
  [5, 'Eau Minérale', 'CupSoda', 1.5, 0.5],
  [5, 'Soda', 'CupSoda', 2.5, 0.9],
  [5, 'Ice Tea', 'CupSoda', 4.2, 1.4],
]

const demoCatalog: Record<BusinessType, Array<[number, string, IconName, number, number]>> = {
  cafe: cafeCatalog,
  bakery: [
    [0, 'Baguette', 'Croissant', 1.2, 0.45], [0, 'Whole wheat loaf', 'Croissant', 2.4, 0.9],
    [1, 'Croissant', 'Croissant', 2.8, 0.9], [1, 'Pain au chocolat', 'Cookie', 3.2, 1.0],
    [2, 'Chocolate cake slice', 'Cake', 4.5, 1.7], [2, 'Fruit tart', 'Cake', 5.2, 2.1],
    [3, 'Almond cookie', 'Cookie', 1.5, 0.4], [4, 'Coffee', 'Coffee', 2.5, 0.8],
  ],
  restaurant: [
    [0, 'Tunisian salad', 'Salad', 8, 2.4], [0, 'Brik à l’œuf', 'Utensils', 4.5, 1.5],
    [1, 'Grilled sea bass', 'Fish', 28, 12], [1, 'Chicken couscous', 'Soup', 19, 7],
    [2, 'Fries', 'Utensils', 5, 1.2], [2, 'Grilled vegetables', 'Salad', 6, 2],
    [3, 'Orange cake', 'Cake', 6, 1.8], [4, 'Lemonade', 'CupSoda', 5, 1.3],
  ],
  snack: [
    [0, 'Tuna sandwich', 'Sandwich', 7.5, 3.2], [0, 'Chicken baguette', 'Sandwich', 9, 4],
    [1, 'Fries', 'Utensils', 4, 1.1], [1, 'Mlewi', 'Sandwich', 5, 1.5],
    [2, 'Tunisian salad', 'Salad', 7, 2.4], [3, 'Donut', 'Cake', 2.5, 0.8],
    [4, 'Soda', 'CupSoda', 2.5, 0.9], [4, 'Water', 'CupSoda', 1.5, 0.5],
  ],
  retail: [
    [0, 'Olive oil', 'Apple', 18, 12], [0, 'Dates (loose)', 'Apple', 28, 17],
    [1, 'Bottled water', 'CupSoda', 1, 0.35], [1, 'Orange juice', 'CupSoda', 4, 2],
    [2, 'Dish soap', 'Package', 5.5, 3], [2, 'Paper towels', 'Package', 6, 3.5],
    [3, 'Hand cream', 'Flower2', 12, 6], [3, 'Shampoo', 'Flower2', 15, 8],
  ],
  salon: [
    [0, 'Haircut', 'Scissors', 20, 2], [0, 'Blow-dry', 'Sparkles', 25, 4],
    [1, 'Manicure', 'Star', 18, 3], [1, 'Gel nails', 'Sparkles', 45, 10],
    [2, 'Facial treatment', 'Flower2', 60, 12], [2, 'Eyebrow shaping', 'Scissors', 12, 1],
    [3, 'Hair serum', 'Flower2', 32, 18], [3, 'Conditioner', 'Flower2', 24, 13],
  ],
}

const mulberry32 = (a: number) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const round = (n: number) => Math.round(n * 1000) / 1000
const pick = <T,>(rng: () => number, arr: T[]) => arr[Math.floor(rng() * arr.length)]

const stores: Store[] = [
  {
    id: 'st_yasmine',
    name: 'Café Yasmine',
    slug: 'yasmine',
    ownerName: 'Sami Ben Ali',
    ownerEmail: 'sami@cafeyasmine.tn',
    phone: '+216 71 123 456',
    address: '12 Avenue Habib Bourguiba',
    city: 'Tunis',
    icon: 'Coffee',
    iconColor: 'amber',
    plan: 'growth',
    status: 'active',
    businessType: 'cafe',
    setupComplete: true,
    createdAt: '2024-06-12T09:00:00.000Z',
    settings: defaultSettings({ taxRate: 19, posMode: 'cashier' }, 'cafe'),
  },
  {
    id: 'st_petitcoin',
    name: 'Le Petit Coin',
    slug: 'petitcoin',
    ownerName: 'Ines Trabelsi',
    ownerEmail: 'ines@lepetitcoin.tn',
    phone: '+216 73 987 654',
    address: '4 Rue des Remparts',
    city: 'Sousse',
    icon: 'Cake',
    iconColor: 'rose',
    plan: 'starter',
    status: 'active',
    businessType: 'bakery',
    setupComplete: true,
    createdAt: '2025-02-03T09:00:00.000Z',
    settings: defaultSettings({ posMode: 'quick', taxRate: 0, serviceCharge: 0.5 }, 'bakery'),
  },
  {
    id: 'st_darchai',
    name: 'Dar Chai',
    slug: 'darchai',
    ownerName: 'Mehdi Gharbi',
    ownerEmail: 'mehdi@darchai.tn',
    phone: '+216 74 222 333',
    address: '27 Rue Hédi Chaker',
    city: 'Sfax',
    icon: 'Coffee',
    iconColor: 'green',
    plan: 'pro',
    status: 'trial',
    businessType: 'restaurant',
    setupComplete: true,
    createdAt: '2026-10-20T09:00:00.000Z',
    trialEndsAt: '2026-12-20T09:00:00.000Z',
    settings: defaultSettings({ posMode: 'cashier', allowCredit: true, taxRate: 19 }, 'restaurant'),
  },
  {
    id: 'st_nour',
    name: 'Café Nour',
    slug: 'cafe-nour',
    ownerName: 'Nour Hamdi',
    ownerEmail: 'nour@cafenour.tn',
    phone: '+216 72 555 777',
    address: '8 Corniche',
    city: 'Bizerte',
    icon: 'Leaf',
    iconColor: 'green',
    plan: 'starter',
    status: 'suspended',
    businessType: 'snack',
    setupComplete: true,
    createdAt: '2025-09-11T09:00:00.000Z',
    settings: defaultSettings({ posMode: 'quick' }, 'snack'),
  },
  {
    id: 'st_zaytouna',
    name: 'Épicerie Zaytouna',
    slug: 'zaytouna',
    ownerName: 'Amira Ben Salem',
    ownerEmail: 'amira@zaytouna.tn',
    phone: '+216 71 444 222',
    address: '18 Rue de Marseille',
    city: 'Tunis',
    icon: 'ShoppingBasket',
    iconColor: 'teal',
    plan: 'starter',
    status: 'trial',
    businessType: 'retail',
    setupComplete: true,
    createdAt: '2026-11-01T09:00:00.000Z',
    trialEndsAt: '2026-12-01T09:00:00.000Z',
    settings: defaultSettings({ taxRate: 7 }, 'retail'),
  },
  {
    id: 'st_lilas',
    name: 'Studio Lilas',
    slug: 'studio-lilas',
    ownerName: 'Lilas Karray',
    ownerEmail: 'lilas@studiolilas.tn',
    phone: '+216 73 333 444',
    address: '6 Avenue de la République',
    city: 'Sousse',
    icon: 'Scissors',
    iconColor: 'violet',
    plan: 'growth',
    status: 'active',
    businessType: 'salon',
    setupComplete: true,
    createdAt: '2026-04-15T09:00:00.000Z',
    settings: defaultSettings({ taxRate: 19 }, 'salon'),
  },
]

const users: User[] = [
  {
    id: 'u_super',
    storeId: null,
    name: 'Platform Owner',
    email: 'owner@cafepos.tn',
    password: 'password',
    pin: '0000',
    role: 'super',
    active: true,
    createdAt: '2024-01-01T09:00:00.000Z',
    permissions: {
      discount: true,
      credit: true,
      settle: true,
      reports: true,
      register: true,
      supervisor: true,
    },
  },
  {
    id: 'u_sami',
    storeId: 'st_yasmine',
    name: 'Sami Ben Ali',
    email: 'sami@cafeyasmine.tn',
    password: 'password',
    pin: '1111',
    role: 'admin',
    active: true,
    createdAt: '2024-06-12T09:00:00.000Z',
    permissions: {
      discount: true,
      credit: true,
      settle: true,
      reports: true,
      register: true,
      supervisor: true,
    },
  },
  {
    id: 'u_amine',
    storeId: 'st_yasmine',
    name: 'Amine Jebali',
    email: 'amine@cafeyasmine.tn',
    password: 'password',
    pin: '1234',
    role: 'staff',
    active: true,
    createdAt: '2025-03-18T09:00:00.000Z',
    permissions: {
      discount: false,
      credit: true,
      settle: true,
      reports: false,
      register: true,
      supervisor: false,
    },
  },
  {
    id: 'u_salma',
    storeId: 'st_yasmine',
    name: 'Salma Riahi',
    email: 'salma@cafeyasmine.tn',
    password: 'password',
    pin: '2345',
    role: 'staff',
    active: true,
    createdAt: '2025-08-02T09:00:00.000Z',
    permissions: {
      discount: true,
      credit: true,
      settle: false,
      reports: false,
      register: false,
      supervisor: false,
    },
  },
  {
    id: 'u_ines',
    storeId: 'st_petitcoin',
    name: 'Ines Trabelsi',
    email: 'ines@lepetitcoin.tn',
    password: 'password',
    pin: '2222',
    role: 'admin',
    active: true,
    createdAt: '2025-02-03T09:00:00.000Z',
    permissions: {
      discount: true,
      credit: true,
      settle: true,
      reports: true,
      register: true,
      supervisor: true,
    },
  },
  {
    id: 'u_karim',
    storeId: 'st_petitcoin',
    name: 'Karim Oueslati',
    email: 'karim@lepetitcoin.tn',
    password: 'password',
    pin: '4321',
    role: 'staff',
    active: true,
    createdAt: '2025-06-21T09:00:00.000Z',
    // Karim is the trusted shift supervisor at Le Petit Coin: he can see the
    // whole team's register sessions, unlike a plain staff member.
    permissions: {
      discount: false,
      credit: true,
      settle: true,
      reports: false,
      register: true,
      supervisor: true,
    },
  },
  {
    id: 'u_mehdi',
    storeId: 'st_darchai',
    name: 'Mehdi Gharbi',
    email: 'mehdi@darchai.tn',
    password: 'password',
    pin: '3333',
    role: 'admin',
    active: true,
    createdAt: '2026-10-20T09:00:00.000Z',
    permissions: {
      discount: true,
      credit: true,
      settle: true,
      reports: true,
      register: true,
      supervisor: true,
    },
  },
  {
    id: 'u_hedi',
    storeId: 'st_darchai',
    name: 'Hedi Chaabane',
    email: 'hedi@darchai.tn',
    password: 'password',
    pin: '5678',
    role: 'staff',
    active: true,
    createdAt: '2026-10-22T09:00:00.000Z',
    permissions: {
      discount: false,
      credit: true,
      settle: true,
      reports: false,
      register: false,
      supervisor: false,
    },
  },
  {
    id: 'u_nour',
    storeId: 'st_nour',
    name: 'Nour Hamdi',
    email: 'nour@cafenour.tn',
    password: 'password',
    pin: '4444',
    role: 'admin',
    active: true,
    createdAt: '2025-09-11T09:00:00.000Z',
    permissions: {
      discount: true,
      credit: true,
      settle: true,
      reports: true,
      register: true,
      supervisor: true,
    },
  },
  {
    id: 'u_amira',
    storeId: 'st_zaytouna',
    name: 'Amira Ben Salem',
    email: 'amira@zaytouna.tn',
    password: 'password',
    pin: '6789',
    role: 'admin',
    active: true,
    createdAt: '2026-11-01T09:00:00.000Z',
    permissions: {
      discount: true,
      credit: true,
      settle: true,
      reports: true,
      register: true,
      supervisor: true,
    },
  },
  {
    id: 'u_lilas',
    storeId: 'st_lilas',
    name: 'Lilas Karray',
    email: 'lilas@studiolilas.tn',
    password: 'password',
    pin: '7890',
    role: 'admin',
    active: true,
    createdAt: '2026-04-15T09:00:00.000Z',
    permissions: {
      discount: true,
      credit: true,
      settle: true,
      reports: true,
      register: true,
      supervisor: true,
    },
  },
]

const customerSeed: Record<
  string,
  Array<{ name: string; phone: string; limit: number; notes?: string; cycle?: SettlementCycle }>
> = {
  st_yasmine: [
    {
      name: 'Mohamed Ali',
      phone: '+216 98 111 222',
      limit: 150,
      notes: 'Pays at the end of each month',
      cycle: 'monthly',
    },
    { name: 'Fatma Khelifi', phone: '+216 97 333 444', limit: 100, cycle: 'monthly' },
    {
      name: 'Bureau Express',
      phone: '+216 71 888 999',
      limit: 750,
      notes: 'Corporate account — monthly invoice',
      cycle: 'monthly',
    },
    { name: 'Youssef Mansour', phone: '+216 95 777 888', limit: 120, cycle: 'monthly' },
    { name: 'Leila Bouzid', phone: '+216 92 456 789', limit: 200, cycle: 'monthly' },
  ],
  st_petitcoin: [
    { name: 'Ahmed Sassi', phone: '+216 96 222 333', limit: 250, cycle: 'monthly' },
    {
      name: 'Mariem Dridi',
      phone: '+216 94 555 666',
      limit: 300,
      notes: 'Neighbour, settles at month end',
      cycle: 'monthly',
    },
  ],
  st_darchai: [
    { name: 'Hichem Belhaj', phone: '+216 99 123 456', limit: 200, cycle: 'monthly' },
    { name: 'Sonia Kammoun', phone: '+216 93 654 321', limit: 120, cycle: 'monthly' },
  ],
  st_nour: [{ name: 'Rania Ayari', phone: '+216 98 333 111', limit: 100, cycle: 'monthly' }],
}

const expenseCatalog: Array<[string, number, string]> = [
  ['Rent', 1200, 'Monthly shop rent'],
  ['Supplies', 420, 'Coffee beans, milk, sugar'],
  ['Utilities', 180, 'Electricity & water'],
  ['Internet', 60, 'Fibre subscription'],
  ['Salaries', 1400, 'Staff wages'],
  ['Maintenance', 120, 'Espresso machine service'],
]

export function buildSeed(): Database {
  const categories: Category[] = []
  const products: Product[] = []
  const customers: Customer[] = []
  const orders: Order[] = []
  const ledger: LedgerEntry[] = []
  const expenses: Expense[] = []
  const registerSessions: RegisterSession[] = []

  const rng = mulberry32(20260214)

  for (const store of stores) {
    const template = businessTemplate(store.businessType)
    const cats = template.categories.map((c, i) => {
      const cat: Category = { ...c, id: `cat_${store.id}_${i}`, storeId: store.id, sort: i }
      categories.push(cat)
      return cat
    })

    const priceFactor = store.id === 'st_yasmine' ? 1.1 : store.id === 'st_darchai' ? 1.05 : 0.95

    const storeProducts: Product[] = demoCatalog[store.businessType].map(([catIdx, name, icon, price, cost], i) => {
      const trackStock = catIdx >= 3 || (store.businessType === 'retail' && name === 'Dates (loose)')
      const p: Product = {
        id: `prd_${store.id}_${i}`,
        storeId: store.id,
        categoryId: cats[catIdx].id,
        name,
        icon,
        iconColor: cats[catIdx].iconColor,
        price: round(price * priceFactor),
        cost: round(cost * priceFactor),
        trackStock,
        stock: trackStock ? 6 + Math.floor(rng() * 34) : 0,
        active: true,
        barcode: store.settings.features.barcode ? `${store.id.replace('st_', '')}${String(i + 1).padStart(6, '0')}` : '',
        modifiers: store.businessType === 'cafe' && name === 'Cappuccino'
          ? [{
              id: 'group_size',
              name: 'Size',
              selection: 'single',
              required: true,
              options: [
                { id: 'size_regular', name: 'Regular', priceDelta: 0 },
                { id: 'size_large', name: 'Large', priceDelta: 1.2 },
              ],
            }, {
              id: 'group_extras',
              name: 'Extras',
              selection: 'multiple',
              required: false,
              options: [
                { id: 'extra_shot', name: 'Extra shot', priceDelta: 1 },
                { id: 'oat_milk', name: 'Oat milk', priceDelta: 0.8 },
              ],
            }]
          : [],
        variants: store.businessType === 'retail' && name === 'Olive oil'
          ? [
              { id: 'olive_500ml', name: '500 ml', size: '500 ml', price: 10, cost: 6.8, barcode: 'zaytouna000001', trackStock: true, stock: 14 },
              { id: 'olive_1l', name: '1 L', size: '1 L', price: 18, cost: 12, barcode: 'zaytouna000002', trackStock: true, stock: 10 },
            ]
          : [],
        soldByWeight: store.businessType === 'retail' && name === 'Dates (loose)',
        saleUnit: store.businessType === 'retail' && name === 'Dates (loose)' ? 'kg' : 'piece',
      }
      products.push(p)
      return p
    })

    const storeCustomers = (customerSeed[store.id] ?? []).map((c, i) => {
      const cust: Customer = {
        id: `cus_${store.id}_${i}`,
        storeId: store.id,
        name: c.name,
        phone: c.phone,
        limit: c.limit,
        notes: c.notes ?? '',
        cycle: c.cycle ?? 'monthly',
        createdAt: isoDaysAgo(200 - i * 15, 10, 0),
      }
      customers.push(cust)
      return cust
    })

    const staff = users.filter((u) => u.storeId === store.id)
    const staffPool = staff.length ? staff : users.filter((u) => u.storeId === store.id)
    const historyDays = store.status === 'trial' ? 10 : 30
    const settings = store.settings

    if (store.status !== 'suspended') {
      let orderNo = 1001
      for (let d = historyDays; d >= 0; d--) {
        const day = new Date()
        day.setDate(day.getDate() - d)
        const weekday = day.getDay()
        const weekendBoost = weekday === 0 || weekday === 6 ? 1.35 : 1
        let count = Math.round((12 + rng() * 16) * weekendBoost)
        if (d === 0) {
          const elapsed = Math.max(0.15, Math.min(1, (new Date().getHours() - 7) / 12))
          count = Math.max(2, Math.round(count * elapsed))
        }
        if (store.status === 'trial') count = Math.round(count * 0.55)

        const maxHour = d === 0 ? Math.max(8, new Date().getHours()) : 20
        const times = Array.from({ length: count }, () => {
          const hour = 7 + Math.floor(rng() * Math.max(1, maxHour - 7))
          return { hour, minute: Math.floor(rng() * 60) }
        }).sort((a, b) => a.hour - b.hour || a.minute - b.minute)

        for (let o = 0; o < count; o++) {
          const { hour, minute } = times[o]
          const createdAt = isoDaysAgo(d, hour, minute)

          const itemCount = 1 + Math.floor(rng() * 3)
          const items = []
          const used = new Set<string>()
          for (let i = 0; i < itemCount; i++) {
            const p = pick(rng, storeProducts)
            if (used.has(p.id)) continue
            used.add(p.id)
            const qty = rng() > 0.82 ? 2 : 1
            items.push({ productId: p.id, name: p.name, price: p.price, qty })
          }
          if (!items.length) continue

          const subtotal = round(items.reduce((acc, it) => acc + it.price * it.qty, 0))
          const service = round(subtotal * settings.serviceCharge)
          const base = subtotal + service
          const tax = settings.taxRate
            ? settings.taxInclusive
              ? round(base - base / (1 + settings.taxRate / 100))
              : round(base * (settings.taxRate / 100))
            : 0
          const total = round(settings.taxInclusive ? base : base + tax)

          const isCredit =
            storeCustomers.length > 0 &&
            settings.allowCredit &&
            rng() < (d < 3 ? 0.05 : 0.06)
          const customer = isCredit ? pick(rng, storeCustomers) : undefined
          const paymentMethod = isCredit ? 'credit' : rng() < 0.72 ? 'cash' : 'card'

          const seller = pick(rng, staffPool)
          const order: Order = {
            id: uid('ord'),
            storeId: store.id,
            number: orderNo++,
            items,
            subtotal,
            tax,
            service,
            discount: 0,
            total,
            channel: rng() < 0.72 ? 'takeaway' : rng() < 0.85 ? 'dine-in' : 'delivery',
            status: rng() < 0.015 ? 'void' : 'completed',
            paymentMethod,
            customerId: customer?.id,
            staffId: seller?.id ?? '',
            staffName: seller?.name ?? 'Staff',
            createdAt,
          }
          orders.push(order)

          if (isCredit && customer) {
            ledger.push({
              id: uid('led'),
              storeId: store.id,
              customerId: customer.id,
              type: 'charge',
              amount: total,
              orderId: order.id,
              staffName: seller?.name ?? 'Staff',
              createdAt,
            })
          }
        }
      }

      // Regulars clear their previous months at month end. The current month's
      // charges stay open, which is exactly what makes the tab realistic.
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      for (const customer of storeCustomers) {
        const charges = ledger
          .filter((l) => l.customerId === customer.id && l.type === 'charge')
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        if (!charges.length) continue

        const byMonth = new Map<string, number>()
        for (const charge of charges) {
          const key = charge.createdAt.slice(0, 7)
          byMonth.set(key, round((byMonth.get(key) ?? 0) + charge.amount))
        }

        for (const [month, total] of byMonth) {
          if (month >= currentMonth) continue
          const [year, monthNumber] = month.split('-').map(Number)
          const settleAt = new Date(year, monthNumber, 0, 18, 30, 0, 0)
          settleAt.setDate(settleAt.getDate() + 1)
          if (settleAt > now) continue

          // Corporate accounts clear in full; a few regulars carry a small part.
          const fullyPaid = customer.name === 'Bureau Express' || rng() < 0.9
          const paid = round(total * (fullyPaid ? 1 : 0.7))
          if (paid <= 0) continue

          ledger.push({
            id: uid('led'),
            storeId: store.id,
            customerId: customer.id,
            type: 'payment',
            amount: paid,
            method: rng() < 0.7 ? 'cash' : 'card',
            note: fullyPaid ? 'Month-end settlement' : 'Partial month-end payment',
            staffName: pick(rng, staffPool)?.name ?? 'Staff',
            createdAt: settleAt.toISOString(),
          })
        }
      }

      // Register sessions: two closed Z days plus the register that is open now.
      const admin = staff.find((u) => u.role === 'admin') ?? staff[0]
      if (admin) {
        const openingCash = store.id === 'st_yasmine' ? 120 : store.id === 'st_petitcoin' ? 80 : 60

        const snapFor = (startISO: string, endISO: string, opening: number): RegisterSnapshot => {
          const start = new Date(startISO).getTime()
          const end = new Date(endISO).getTime()
          const inWindow = orders.filter((o) => {
            const t = new Date(o.createdAt).getTime()
            return o.storeId === store.id && t >= start && t <= end
          })
          const done = inWindow.filter((o) => o.status === 'completed')
          const voided = inWindow.filter((o) => o.status === 'void')
          const cashSales = round(done.filter((o) => o.paymentMethod === 'cash').reduce((a, o) => a + o.total, 0))
          const cardSales = round(done.filter((o) => o.paymentMethod === 'card').reduce((a, o) => a + o.total, 0))
          const creditSales = round(done.filter((o) => o.paymentMethod === 'credit').reduce((a, o) => a + o.total, 0))
          const cashRefunds = round(
            voided.filter((o) => o.paymentMethod === 'cash').reduce((a, o) => a + o.total, 0),
          )
          const payments = ledger.filter((l) => {
            const t = new Date(l.createdAt).getTime()
            return l.storeId === store.id && l.type === 'payment' && t >= start && t <= end
          })
          const cashSettlements = round(payments.filter((l) => l.method === 'cash').reduce((a, l) => a + l.amount, 0))
          const cardSettlements = round(payments.filter((l) => l.method === 'card').reduce((a, l) => a + l.amount, 0))
          const exp = round(
            expenses
              .filter((e) => {
                const t = new Date(e.date).getTime()
                return e.storeId === store.id && t >= start && t <= end
              })
              .reduce((a, e) => a + e.amount, 0),
          )
          return {
            salesTotal: round(cashSales + cardSales + creditSales),
            cashSales,
            cardSales,
            creditSales,
            ordersCount: done.length,
            voidedCount: voided.length,
            voidedTotal: round(voided.reduce((a, o) => a + o.total, 0)),
            cashRefunds,
            discounts: round(done.reduce((a, o) => a + o.discount, 0)),
            tax: round(done.reduce((a, o) => a + o.tax, 0)),
            service: round(done.reduce((a, o) => a + o.service, 0)),
            expenses: exp,
            cashSettlements,
            cardSettlements,
            settlementCount: payments.length,
            expectedCash: round(opening + cashSales + cashSettlements - exp - cashRefunds),
          }
        }

        for (const day of [2, 1]) {
          const openAt = isoDaysAgo(day, 7, 5)
          const closeAt = isoDaysAgo(day, 20, 30)
          const snapshot = snapFor(openAt, closeAt, openingCash)
          const variance = rng() < 0.5 ? 0 : round((rng() - 0.5) * 6)
          const counted = round(snapshot.expectedCash + variance)
          registerSessions.push({
            id: uid('reg'),
            storeId: store.id,
            status: 'closed',
            openedAt: openAt,
            openedById: admin.id,
            openedByName: admin.name,
            openingCash,
            closedAt: closeAt,
            closedById: admin.id,
            closedByName: admin.name,
            countedCash: counted,
            difference: round(counted - snapshot.expectedCash),
            snapshot,
          })
        }

        const openToday = new Date(now)
        openToday.setHours(7, 5, 0, 0)
        if (openToday > now) openToday.setDate(openToday.getDate() - 1)
        registerSessions.push({
          id: uid('reg'),
          storeId: store.id,
          status: 'open',
          openedAt: openToday.toISOString(),
          openedById: admin.id,
          openedByName: admin.name,
          openingCash,
        })
      }
    }

    // Expenses for last 4 months
    for (let m = 0; m < 4; m++) {
      for (const [category, baseAmount, note] of expenseCatalog) {
        if (rng() < 0.18) continue
        expenses.push({
          id: uid('exp'),
          storeId: store.id,
          category,
          note,
          amount: round(baseAmount * (0.92 + rng() * 0.18)),
          date: isoDaysAgo(m * 30 + Math.floor(rng() * 8) + 1, 10, 0),
          createdBy: staff[0]?.name ?? store.ownerName,
        })
      }
    }
  }

  return { stores, users, categories, products, customers, orders, ledger, expenses, registerSessions }
}

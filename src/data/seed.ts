import type {
  Category,
  Customer,
  BusinessType,
  Database,
  DiningTable,
  Expense,
  IconName,
  InventoryItem,
  LedgerEntry,
  Order,
  Plan,
  Product,
  Purchase,
  PurchasePayment,
  RegisterSession,
  RegisterSnapshot,
  SettlementCycle,
  Shift,
  StockMovement,
  Store,
  StoreSettings,
  Station,
  Supplier,
  TableSection,
  User,
} from '../types'
import { dateKey, isoDaysAgo, uid } from '../lib/utils'
import { DEFAULT_AUTOMATION_SETTINGS, DEFAULT_AVAILABILITY_SETTINGS, DEFAULT_ORDER_RULES, DEFAULT_PAYROLL_SETTINGS, DEFAULT_PRINTER } from '../lib/defaults'
import { businessTemplate } from '../lib/businessTemplates'
import { computeTotals } from '../lib/pricing'
import { computeRegisterTotals, registerReportDetails } from '../lib/reports'
import { defaultStationsForStore } from '../lib/stations'

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
  tableMode: 'sections_tables',
  guestRequirement: 'required',
  staffPickSectionsOnShift: false,
  requireShiftForOrders: (over.posMode ?? businessTemplate(businessType).posMode) === 'cashier',
  accent: '7anouti',
  colorMode: 'system',
  printer: { ...DEFAULT_PRINTER },
  features: businessTemplate(businessType).features,
  payroll: { ...DEFAULT_PAYROLL_SETTINGS },
  ticketSendPolicy: 'done_or_idle',
  ticketDelaySeconds: 10,
  ticketIdleSeconds: 20,
  stationTimerMinutes: 15,
  receiptPrintPolicy: 'ask',
  stationTicketPrintPolicy: 'automatic',
  reportPrintPolicy: 'manual',
  automation: { ...DEFAULT_AUTOMATION_SETTINGS },
  availability: { ...DEFAULT_AVAILABILITY_SETTINGS, reasons: [...DEFAULT_AVAILABILITY_SETTINGS.reasons] },
  orderRules: { ...DEFAULT_ORDER_RULES, stockOverrideRoles: { ...DEFAULT_ORDER_RULES.stockOverrideRoles } },
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

const users = ([
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
    username: 'amine.yasmine',
    password: '',
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
    id: 'u_manager_yasmine',
    storeId: 'st_yasmine',
    name: 'Nadia Mansour',
    username: 'nadia.yasmine',
    password: '',
    pin: '3456',
    role: 'manager',
    active: true,
    createdAt: '2026-11-12T09:00:00.000Z',
    permissions: {
      discount: true,
      credit: true,
      settle: true,
      reports: true,
      register: true,
      supervisor: true,
      manageInventory: true,
      recordPurchases: true,
      viewCosts: true,
      manageStaffAllowances: true,
      approveOverrides: true,
      viewReports: true,
      manageProducts: true,
      voidOrders: true,
      manageStaff: true,
      manageSettings: false,
      managePayroll: false,
    },
  },
  {
    id: 'u_salma',
    storeId: 'st_yasmine',
    name: 'Salma Riahi',
    username: 'salma.yasmine',
    password: '',
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
    username: 'karim.petitcoin',
    password: '',
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
    username: 'hedi.darchai',
    password: '',
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
] satisfies Omit<User, 'salaryType' | 'salaryAmount'>[]).map((user) => ({
  ...user,
  salaryType: 'none' as const,
  salaryAmount: 0,
  permissions: {
    ...user.permissions,
    openShift: user.role !== 'super',
    closeShift: user.role !== 'super',
    takeOverTables: user.role !== 'super',
    forceCloseShift: user.role === 'admin',
    manageCashDifferences: user.role === 'admin',
    viewStaffAnalytics: user.role !== 'staff' && user.role !== 'super',
  },
}))

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
  const stations: Station[] = []
  const categories: Category[] = []
  const products: Product[] = []
  const customers: Customer[] = []
  const orders: Order[] = []
  const ledger: LedgerEntry[] = []
  const expenses: Expense[] = []
  const inventoryItems: InventoryItem[] = [
    { id: 'inv_coffee_beans', storeId: 'st_yasmine', name: 'Coffee beans', category: 'coffee', baseUnit: 'g', packages: [{ id: 'pkg_coffee_1kg', label: 'Bag 1 kg', baseQtyPerPackage: 1000 }], onHand: 5000, reorderLevel: 2000, avgCostPerBaseUnit: 0.025, lastCostPerBaseUnit: 0.025, active: true },
    { id: 'inv_sugar', storeId: 'st_yasmine', name: 'Sugar', category: 'other', baseUnit: 'g', packages: [{ id: 'pkg_sugar_1kg', label: 'Bag 1 kg', baseQtyPerPackage: 1000 }], onHand: 0, reorderLevel: 1000, avgCostPerBaseUnit: 0, lastCostPerBaseUnit: 0, active: true },
    { id: 'inv_milk', storeId: 'st_yasmine', name: 'Whole milk', category: 'dairy', baseUnit: 'ml', packages: [{ id: 'pkg_milk_1l', label: 'Bottle 1 L', baseQtyPerPackage: 1000 }], onHand: 0, reorderLevel: 3000, avgCostPerBaseUnit: 0, lastCostPerBaseUnit: 0, active: true },
    { id: 'inv_water_05', storeId: 'st_yasmine', name: 'Water 0.5 L', category: 'water', baseUnit: 'piece', packages: [{ id: 'pkg_water_05_6', label: 'Pack of 6', baseQtyPerPackage: 6 }], onHand: 0, reorderLevel: 12, avgCostPerBaseUnit: 0, lastCostPerBaseUnit: 0, active: true },
    { id: 'inv_water_15', storeId: 'st_yasmine', name: 'Water 1.5 L', category: 'water', baseUnit: 'piece', packages: [{ id: 'pkg_water_15_6', label: 'Pack of 6', baseQtyPerPackage: 6 }], onHand: 0, reorderLevel: 12, avgCostPerBaseUnit: 0, lastCostPerBaseUnit: 0, active: true },
    { id: 'inv_soft_drink', storeId: 'st_yasmine', name: 'Soft drinks', category: 'soft_drinks', baseUnit: 'piece', packages: [{ id: 'pkg_soft_drink_24', label: 'Crate of 24', baseQtyPerPackage: 24 }], onHand: 0, reorderLevel: 24, avgCostPerBaseUnit: 0, lastCostPerBaseUnit: 0, active: true },
    { id: 'inv_paper_cups', storeId: 'st_yasmine', name: 'Paper cups', category: 'packaging', baseUnit: 'piece', packages: [{ id: 'pkg_cups_50', label: 'Pack of 50', baseQtyPerPackage: 50 }], onHand: 0, reorderLevel: 100, avgCostPerBaseUnit: 0, lastCostPerBaseUnit: 0, active: true },
    { id: 'inv_lids', storeId: 'st_yasmine', name: 'Cup lids', category: 'packaging', baseUnit: 'piece', packages: [{ id: 'pkg_lids_50', label: 'Pack of 50', baseQtyPerPackage: 50 }], onHand: 0, reorderLevel: 100, avgCostPerBaseUnit: 0, lastCostPerBaseUnit: 0, active: true },
    { id: 'inv_cakes', storeId: 'st_yasmine', name: 'Cakes', category: 'pastry', baseUnit: 'piece', packages: [{ id: 'pkg_cakes_1', label: 'Single cake', baseQtyPerPackage: 1 }], onHand: 0, reorderLevel: 6, avgCostPerBaseUnit: 0, lastCostPerBaseUnit: 0, active: true },
  ]
  const purchaseDate = dateKey(isoDaysAgo(2))
  const purchaseCreatedAt = isoDaysAgo(2)
  const suppliers: Supplier[] = [{
    id: 'sup_central_cafe',
    storeId: 'st_yasmine',
    name: 'Central Café Supplies',
    phone: '+216 71 555 018',
    email: 'orders@central-cafe.example',
    address: 'Tunis',
    notes: 'Coffee and dry goods supplier',
    active: true,
    createdAt: isoDaysAgo(30),
  }]
  const purchases: Purchase[] = [{
    id: 'purchase_yasmine_coffee',
    storeId: 'st_yasmine',
    supplierId: 'sup_central_cafe',
    supplierName: 'Central Café Supplies',
    invoiceNumber: 'CC-1042',
    receivedAt: purchaseDate,
    lines: [{
      id: 'pline_yasmine_coffee',
      inventoryItemId: 'inv_coffee_beans',
      itemName: 'Coffee beans',
      packageId: 'pkg_coffee_1kg',
      packageLabel: 'Bag 1 kg',
      packageCount: 5,
      baseQuantity: 5000,
      unitCost: 25,
      lineTotal: 125,
    }],
    subtotal: 125,
    paidAmount: 75,
    status: 'received',
    note: 'Opening demo purchase',
    createdById: 'u_sami',
    createdByName: 'Sami Ben Ali',
    createdAt: purchaseCreatedAt,
  }]
  const purchasePayments: PurchasePayment[] = [{
    id: 'ppay_yasmine_coffee',
    storeId: 'st_yasmine',
    purchaseId: 'purchase_yasmine_coffee',
    amount: 75,
    method: 'cash',
    note: 'Part payment',
    userId: 'u_sami',
    userName: 'Sami Ben Ali',
    createdAt: purchaseCreatedAt,
  }]
  const stockMovements: StockMovement[] = [{
    id: 'mov_yasmine_coffee_purchase',
    storeId: 'st_yasmine',
    itemId: 'inv_coffee_beans',
    type: 'purchase',
    qtyDelta: 5000,
    unitCostSnapshot: 0.025,
    reason: 'Purchase CC-1042',
    userId: 'u_sami',
    userName: 'Sami Ben Ali',
    refType: 'purchase',
    refId: 'purchase_yasmine_coffee',
    createdAt: purchaseCreatedAt,
  }]
  const registerSessions: RegisterSession[] = []
  const sections: TableSection[] = [
    { id: 'sec_darchai_inside', storeId: 'st_darchai', name: 'Inside', color: 'blue', icon: 'Utensils', active: true, sort: 0 },
    { id: 'sec_darchai_terrace', storeId: 'st_darchai', name: 'Terrace', color: 'green', icon: 'Utensils', active: true, sort: 1 },
  ]
  const tables: DiningTable[] = Array.from({ length: 8 }, (_, index) => ({
    id: `tbl_darchai_${index + 1}`,
    storeId: 'st_darchai',
    name: `Table ${index + 1}`,
    seats: index % 4 < 2 ? 2 : 4,
    sectionId: index < 4 ? sections[0].id : sections[1].id,
    active: true,
    sort: index,
  }))
  const shifts: Shift[] = []
  const shiftDate = (daysFromToday: number) => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromToday)
    return dateKey(date)
  }
  const shiftCreatedAt = new Date().toISOString()
  const sampleShifts: Array<Omit<Shift, 'id' | 'createdAt'>> = [
    { storeId: 'st_yasmine', userId: 'u_amine', date: shiftDate(1), startTime: '08:00', endTime: '14:00', note: 'Opening shift', createdBy: 'u_sami' },
    { storeId: 'st_yasmine', userId: 'u_salma', date: shiftDate(2), startTime: '14:00', endTime: '20:00', note: 'Afternoon shift', createdBy: 'u_sami' },
    { storeId: 'st_petitcoin', userId: 'u_karim', date: shiftDate(1), startTime: '09:00', endTime: '15:00', note: '', createdBy: 'u_ines' },
    { storeId: 'st_darchai', userId: 'u_hedi', date: shiftDate(3), startTime: '10:00', endTime: '16:00', note: '', createdBy: 'u_mehdi' },
  ]
  shifts.push(...sampleShifts.map((shift) => ({
    ...shift,
    id: uid('shift'),
    createdAt: shiftCreatedAt,
  })))

  const rng = mulberry32(20260214)

  for (const store of stores) {
    const template = businessTemplate(store.businessType)
    const storeStations = defaultStationsForStore(store.id)
    stations.push(...storeStations)
    const cats = template.categories.map((c, i) => {
      const cat: Category = {
        name: c.name,
        icon: c.icon,
        iconColor: c.iconColor,
        id: `cat_${store.id}_${i}`,
        storeId: store.id,
        stationId: c.station
          ? storeStations.find((station) => station.name === c.station)?.id
          : undefined,
        sort: i,
      }
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
        stationId: /water/i.test(name) ? null : undefined,
        name,
        icon,
        iconColor: cats[catIdx].iconColor,
        price: round(price * priceFactor),
        cost: round(cost * priceFactor),
        trackStock,
        stock: trackStock ? 6 + Math.floor(rng() * 34) : 0,
        active: true,
        ...(store.id === 'st_yasmine' && name === 'Cappuccino' ? {
          eightySix: {
            active: true,
            at: new Date().toISOString(),
            byId: 'u_sami',
            reason: 'Machine down',
            returnMode: 'manual' as const,
          },
        } : {}),
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
      let seededDineInCount = 0
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
          const channel = rng() < 0.72 ? 'takeaway' : rng() < 0.85 ? 'dine-in' : 'delivery'
          const isVoided = rng() < 0.015
          const table = store.id === 'st_darchai' && channel === 'dine-in' && seededDineInCount < tables.length
            ? tables[seededDineInCount++]
            : undefined
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
            taxRate: settings.taxRate,
            channel,
            tableId: table?.id,
            tableName: table?.name,
            status: isVoided ? 'void' : 'completed',
            voidedAt: isVoided ? createdAt : undefined,
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

  const tableStore = stores.find((store) => store.settings.features.tables)
  const sampleTable = tableStore && tables.find((table) => table.storeId === tableStore.id && table.active)
  const sampleProduct = tableStore && products.find((product) =>
    product.storeId === tableStore.id && product.active,
  )
  const sampleStaff = tableStore && users.find((user) =>
    user.storeId === tableStore.id && user.role === 'staff' && user.active,
  )
  if (tableStore && sampleTable && sampleProduct && sampleStaff) {
    const items: Order['items'] = [{
      lineId: uid('line'),
      productId: sampleProduct.id,
      name: sampleProduct.name,
      price: sampleProduct.price,
      qty: 1,
    }]
    const totals = computeTotals(items, tableStore.settings)
    const number = orders
      .filter((order) => order.storeId === tableStore.id)
      .reduce((max, order) => Math.max(max, order.number), 1000) + 1
    orders.push({
      id: uid('ord'),
      storeId: tableStore.id,
      number,
      items,
      ...totals,
      discount: 0,
      channel: 'dine-in',
      tableId: sampleTable.id,
      tableName: sampleTable.name,
      status: 'recorded',
      paymentMethod: 'unpaid',
      staffId: sampleStaff.id,
      staffName: sampleStaff.name,
      createdAt: new Date().toISOString(),
    })
  }

  const database: Database = {
    stores,
    users,
    stations,
    stationDevices: [],
    printers: [],
    printRoutes: [],
    printJobs: [],
    categories,
    sections,
    tables,
    inventoryItems,
    stockMovements,
    suppliers,
    purchases,
    purchasePayments,
    products,
    customers,
    orders,
    openOrders: [{
      id: 'open_demo_handover',
      storeId: 'st_darchai',
      number: 1999,
      tableId: 'tbl_darchai_1',
      tableName: 'Table 1',
      sectionId: 'sec_darchai_inside',
      sectionName: 'Inside',
      items: [],
      subtotal: 0,
      tax: 0,
      service: 0,
      discount: 0,
      total: 0,
      channel: 'dine-in',
      status: 'open',
      staffId: 'unassigned-handover',
      staffName: 'Unassigned (handover)',
      tableHistory: [{
        id: 'evt_demo_handover',
        type: 'transferred',
        actorId: 'u_mehdi',
        actorName: 'Mehdi Gharbi',
        at: new Date().toISOString(),
        details: 'Demo handover waiting for an open shift',
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
    ledger,
    expenses,
    attendance: [],
    advances: [],
    payrolls: [],
    shifts,
    registerSessions,
    cashDifferences: [],
    auditLogs: [],
  }

  const sessionsByStore = new Map<string, RegisterSession[]>()
  for (const session of database.registerSessions) {
    const sessions = sessionsByStore.get(session.storeId) ?? []
    sessions.push(session)
    sessionsByStore.set(session.storeId, sessions)
  }
  for (const sessions of sessionsByStore.values()) {
    sessions.sort((a, b) => a.openedAt.localeCompare(b.openedAt))
    sessions.forEach((session, index) => {
      session.staffId = session.openedById
      session.shiftNumber = `S-${String(index + 1).padStart(6, '0')}`
    })
  }
  const sessionAt = (storeId: string, value: string) => {
    const timestamp = Date.parse(value)
    return database.registerSessions.find((session) =>
      session.storeId === storeId &&
      timestamp >= Date.parse(session.openedAt) &&
      timestamp <= Date.parse(session.closedAt ?? new Date().toISOString()),
    )
  }
  database.orders = database.orders.map((order) => ({
    ...order,
    paidById: order.paidById ?? order.staffId,
    shiftId: order.shiftId ?? sessionAt(order.storeId, order.createdAt)?.id,
    voidShiftId: order.voidedAt
      ? order.voidShiftId ?? sessionAt(order.storeId, order.voidedAt)?.id
      : undefined,
  }))
  database.ledger = database.ledger.map((entry) => ({
    ...entry,
    shiftId: entry.shiftId ?? sessionAt(entry.storeId, entry.createdAt)?.id,
  }))
  database.expenses = database.expenses.map((expense) => ({
    ...expense,
    shiftId: expense.shiftId ?? sessionAt(expense.storeId, expense.createdAt ?? expense.date)?.id,
  }))
  database.purchasePayments = database.purchasePayments.map((payment) => ({
    ...payment,
    shiftId: payment.shiftId ?? sessionAt(payment.storeId, payment.createdAt)?.id,
  }))

  const closedByStore = new Map<string, RegisterSession[]>()
  for (const session of database.registerSessions) {
    if (session.status !== 'closed' || !session.closedAt) continue
    const sessions = closedByStore.get(session.storeId) ?? []
    sessions.push(session)
    closedByStore.set(session.storeId, sessions)
  }
  for (const sessions of closedByStore.values()) {
    sessions.sort((a, b) => (a.closedAt ?? '').localeCompare(b.closedAt ?? ''))
    sessions.forEach((session, index) => {
      session.zReportNumber = index + 1
      session.snapshot = computeRegisterTotals(
        database,
        session.storeId,
        session.openedAt,
        session.closedAt ?? session.openedAt,
        session.openingCash,
        session.id,
      )
      session.reportDetails = registerReportDetails(database, session, session.closedAt)
      session.countedCash ??= session.snapshot.expectedCash
      session.difference ??= round(session.countedCash - session.snapshot.expectedCash)
    })
  }
  return database
}

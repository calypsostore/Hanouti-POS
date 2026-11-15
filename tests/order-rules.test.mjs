import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_ORDER_RULES } from '../src/lib/defaults.ts'
import {
  computeReservations,
  planStockDeductions,
  stockOverrideAccepted,
  validateOrderLines,
} from '../src/shared/orderRules.ts'
import { isUnavailable } from '../src/shared/availability.ts'

const product = (patch = {}) => ({
  id: 'espresso',
  storeId: 'shop',
  categoryId: 'drinks',
  name: 'Espresso',
  price: 2,
  cost: 0.5,
  trackStock: true,
  stock: 7,
  active: true,
  ...patch,
})

const store = (patch = {}) => ({
  id: 'shop',
  settings: {
    taxRate: 0,
    taxInclusive: false,
    serviceCharge: 0,
    availability: {
      enabled: true,
      autoEightySixAtZero: true,
      autoReturnOnRestock: true,
      requireReason: true,
      reasons: [],
      defaultReturnMode: 'manual',
      resetManualAtDayStart: false,
      resetManualAtFirstShift: false,
      displayStyle: 'big_red_x',
      showListButton: true,
      notifyStaffAboutChanges: true,
      showCountOnStationScreens: true,
    },
    orderRules: { ...DEFAULT_ORDER_RULES, stockOverrideRoles: { ...DEFAULT_ORDER_RULES.stockOverrideRoles } },
    features: { weightItems: true },
    ...patch,
  },
})

const line = (patch = {}) => ({
  lineId: 'line-1',
  productId: 'espresso',
  name: 'Espresso',
  price: 2,
  qty: 1,
  ...patch,
})

const context = (options = {}) => ({
  store: store(options.storeSettings),
  products: options.products ?? [product()],
  inventoryItems: options.inventoryItems ?? [],
  openOrders: options.openOrders ?? [],
  actor: options.actor,
  users: options.users ?? [],
  customer: options.customer,
  payWithCredit: options.payWithCredit,
  discount: options.discount,
  estimatedTotal: options.estimatedTotal,
  lineQty: options.lineQty,
})

test('one engine reports every requested issue code', () => {
  const cases = [
    ['UNAVAILABLE_86', [line()], context({ products: [product({
      eightySix: { active: true, reason: 'Machine down', returnMode: 'manual', at: new Date().toISOString() },
    })] })],
    ['OVER_STOCK', [line({ qty: 8 })], context()],
    ['INGREDIENT_SHORT', [line()], context({
      storeSettings: { orderRules: { ...DEFAULT_ORDER_RULES, deductIngredientsOnSale: true } },
      products: [product({ trackStock: false, recipe: [{ inventoryItemId: 'beans', qtyPerUnit: 0.5 }] })],
      inventoryItems: [{ id: 'beans', storeId: 'shop', name: 'Beans', baseUnit: 'kg', onHand: 1 }],
      lineQty: 3,
    })],
    ['PRODUCT_INACTIVE', [line()], context({ products: [product({ active: false })] })],
    ['PRICE_CHANGED', [line()], context({ products: [product({ price: 3 })] })],
    ['OPTION_INVALID', [line({ variantId: 'missing' })], context()],
    ['CREDIT_LIMIT', [line()], context({
      storeSettings: { allowCredit: true },
      customer: { id: 'customer', limit: 5, balance: 5 },
      payWithCredit: true,
      estimatedTotal: 1,
    })],
    ['DISCOUNT_NOT_ALLOWED', [line()], context({
      actor: { id: 'staff', role: 'staff', permissions: { discount: false } },
      payWithCredit: true,
      discount: 1,
    })],
  ]
  for (const [code, lines, ctx] of cases) {
    const adjustedLines = code === 'INGREDIENT_SHORT' ? [line({ qty: ctx.lineQty })] : lines
    const issues = validateOrderLines(adjustedLines, ctx)
    assert.ok(issues.some((issue) => issue.code === code), `${code} should be reported`)
  }
})

test('reservations from multiple open tables reduce available stock', () => {
  const openOrders = ['table-1', 'table-2'].map((id, index) => ({
    id,
    status: 'open',
    items: [line({ lineId: `reserved-${index}`, qty: 3 })],
  }))
  const reservations = computeReservations(openOrders, [product()])
  assert.equal(reservations.stock.get('espresso:base'), 6)
  const issue = validateOrderLines([line({ qty: 2 })], context({ openOrders }))
    .find((candidate) => candidate.code === 'OVER_STOCK')
  assert.equal(issue.data.available, 1)
})

test('stock overflow mode blocks, warns, or allows silently', () => {
  const overflow = [line({ qty: 8 })]
  const issueAt = (stockOverflowMode) => validateOrderLines(overflow, context({
    storeSettings: {
      orderRules: { ...DEFAULT_ORDER_RULES, stockOverflowMode },
    },
  })).find((issue) => issue.code === 'OVER_STOCK')
  assert.equal(issueAt('block').severity, 'block')
  assert.equal(issueAt('warn').severity, 'warn')
  assert.equal(issueAt('allow'), undefined)
})

test('stock overrides require a valid active authorized confirmer and exact request', () => {
  const confirmer = {
    id: 'manager',
    storeId: 'shop',
    name: 'Manager',
    role: 'manager',
    active: true,
    permissions: { overrideStock: true },
  }
  const ctx = context({ users: [confirmer] })
  const override = {
    confirmedById: confirmer.id,
    confirmedByName: confirmer.name,
    requested: 8,
    available: 7,
    at: new Date().toISOString(),
  }
  assert.equal(stockOverrideAccepted(override, 8, ctx), true)
  assert.equal(stockOverrideAccepted({ ...override, requested: 9 }, 8, ctx), false)
  assert.equal(stockOverrideAccepted({ ...override, confirmedById: 'unknown' }, 8, ctx), false)
})

test('recipe deductions aggregate and void lines are restored by the inverse plan', () => {
  const recipeProduct = product({
    trackStock: false,
    recipe: [{ inventoryItemId: 'beans', qtyPerUnit: 0.02 }],
  })
  const sold = line({ qty: 3 })
  const deduction = planStockDeductions([sold], [recipeProduct], true)
  assert.equal(deduction.ingredients.get('beans').qty, 0.06)
  const restored = planStockDeductions([{ ...sold, status: 'void' }], [recipeProduct], true)
  assert.equal(restored.ingredients.size, 0)
})

test('a recipe becomes unavailable when any required ingredient cannot make one unit', () => {
  const recipeProduct = product({
    trackStock: false,
    recipe: [{ inventoryItemId: 'beans', qtyPerUnit: 2 }],
  })
  const result = isUnavailable(recipeProduct, undefined, store().settings.availability, [
    { id: 'beans', storeId: 'shop', onHand: 1 },
  ], new Date(), true)
  assert.equal(result.unavailable, true)
  assert.equal(result.reason, 'Ingredient out of stock')
})

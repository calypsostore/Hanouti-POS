import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSessionItems, summarizeRegisterItems } from '../src/lib/registerItems.ts'
import { autoCloseRegisterSessionForZ, computeRegisterTotals, registerReportDetails } from '../src/lib/reports.ts'
import {
  ensureShiftForActor,
  hasOpenShiftsRequiringManualClose,
  openShiftForStaff,
} from '../src/lib/registerShifts.ts'
import { completeOpenOrderPayment } from '../src/lib/openOrderPayment.ts'
import { buildReportLines } from '../src/lib/escpos.ts'
import { withEnsuredShift } from '../src/store/registerShiftHelpers.ts'

const start = '2026-11-14T08:00:00.000Z'
const end = '2026-11-14T18:00:00.000Z'

const item = (productId, name, options = {}) => ({
  productId,
  name,
  price: options.price ?? 2,
  qty: options.qty ?? 1,
  variantId: options.variantId,
  variantName: options.variantName,
  modifiers: options.modifiers,
  soldByWeight: options.soldByWeight ?? false,
  saleUnit: options.saleUnit,
})

const order = (id, options = {}) => ({
  id,
  storeId: 'store-1',
  number: 1000,
  items: options.items ?? [],
  subtotal: options.total ?? 0,
  tax: 0,
  service: 0,
  discount: options.discount ?? 0,
  total: options.total ?? 0,
  channel: 'takeaway',
  status: options.status ?? 'completed',
  paymentMethod: options.paymentMethod ?? 'cash',
  staffId: options.staffId ?? 'staff-1',
  staffName: options.staffName ?? 'Staff One',
  staffConsumption: options.staffConsumption,
  paidById: options.paidById,
  shiftId: options.shiftId,
  createdAt: options.createdAt ?? '2026-11-14T10:00:00.000Z',
  voidedAt: options.voidedAt,
  voidShiftId: options.voidShiftId,
  voidedById: options.voidedById,
  voidedByName: options.voidedByName,
})

const db = {
  orders: [
    order('espresso-1', {
      items: [
        item('coffee', 'Espresso', {
          variantId: 'double',
          variantName: 'Double',
          modifiers: [{ groupId: 'sugar', optionId: 'none', optionName: 'No sugar', priceDelta: 0 }],
        }),
        item('coffee', 'Espresso', {
          variantId: 'double',
          variantName: 'Double',
        }),
        item('coffee', 'Espresso', {
          price: 2.5,
          variantId: 'double',
          variantName: 'Double',
          modifiers: [{ groupId: 'extra', optionId: 'shot', optionName: 'Extra shot', priceDelta: 0.5 }],
        }),
        item('coffee', 'Espresso', { variantId: 'single', variantName: 'Single', price: 1.5 }),
        item('beans', 'Coffee beans', { qty: 0.125, soldByWeight: true, saleUnit: 'kg', price: 30 }),
      ],
      staffId: 'staff-1',
      staffName: 'Staff One',
    }),
    order('voided-before-end', {
      status: 'void',
      voidedAt: '2026-11-14T12:00:00.000Z',
      voidedById: 'manager-1',
      voidedByName: 'Manager One',
      items: [item('tea', 'Mint tea')],
      staffId: 'staff-2',
      staffName: 'Staff Two',
    }),
    order('sold-voided-after-end', {
      status: 'void',
      voidedAt: '2026-11-14T19:00:00.000Z',
      voidedById: 'manager-1',
      voidedByName: 'Manager One',
      items: [item('tea', 'Mint tea', { qty: 2 })],
      staffId: 'staff-2',
      staffName: 'Staff Two',
    }),
    order('recorded-active', {
      status: 'recorded',
      paymentMethod: 'unpaid',
      items: [item('cake', 'Cake', { qty: 2 })],
      staffId: 'staff-2',
      staffName: 'Staff Two',
    }),
    order('recorded-voided-after-end', {
      status: 'void',
      paymentMethod: 'unpaid',
      voidedAt: '2026-11-14T19:00:00.000Z',
      voidedById: 'manager-1',
      voidedByName: 'Manager One',
      items: [item('cake', 'Cake')],
      staffId: 'staff-2',
      staffName: 'Staff Two',
    }),
  ],
  products: [
    { id: 'coffee', categoryId: 'drinks' },
    { id: 'beans', categoryId: 'pantry' },
    { id: 'tea', categoryId: 'drinks' },
    { id: 'cake', categoryId: 'bakery' },
  ],
  categories: [
    { id: 'drinks', name: 'Drinks' },
    { id: 'pantry', name: 'Pantry' },
    { id: 'bakery', name: 'Bakery' },
  ],
}

const session = { storeId: 'store-1', openedAt: start }

test('aggregates variants, ignores free modifiers, preserves priced modifiers and weight precision', () => {
  const report = registerSessionItems(db, session, end)
  const espressoRows = report.itemsSold.filter((row) => row.productId === 'coffee')

  assert.equal(espressoRows.length, 3)
  assert.equal(espressoRows.find((row) => row.variantId === 'double' && row.unitPrice === 2)?.qty, 2)
  assert.equal(espressoRows.find((row) => row.name.endsWith('Extra shot'))?.unitPrice, 2.5)

  const beans = report.itemsSold.find((row) => row.productId === 'beans')
  assert.equal(beans?.qty, 0.125)
  assert.equal(beans?.soldByWeight, true)
  assert.equal(beans?.unitPrice, 30)
})

test('separates recorded orders and treats later voids as of the report cutoff', () => {
  const report = registerSessionItems(db, session, end)
  assert.equal(report.recordedItems.find((row) => row.productId === 'cake')?.qty, 3)
  assert.equal(report.itemsSold.find((row) => row.productId === 'tea')?.qty, 2)
  assert.equal(report.itemsSold.some((row) => row.productId === 'cake'), false)
  assert.equal(report.voidedItems.find((row) => row.productId === 'tea')?.voidedByName, 'Manager One')
})

test('limits X item rows to the requested staff member and totals distinct served rows', () => {
  const report = registerSessionItems(db, session, end, 'staff-1')
  assert.equal(report.recordedItems.length, 0)
  assert.equal(report.itemsSold.every((row) => row.productId === 'coffee' || row.productId === 'beans'), true)
  assert.equal(report.voidedItems.length, 0)

  const summary = summarizeRegisterItems([report.itemsSold, report.recordedItems])
  assert.equal(summary.distinctItems, report.itemsSold.length)
  assert.ok(summary.qty > 0)
})

test('recorded orders stay out of sales and expected cash while later voids remain as-of the cutoff', () => {
  const totals = computeRegisterTotals({
    orders: [
      order('paid', { total: 25, paymentMethod: 'cash' }),
      order('recorded', { status: 'recorded', paymentMethod: 'unpaid', total: 100 }),
      order('recorded-voided-later', {
        status: 'void',
        paymentMethod: 'unpaid',
        total: 5,
        voidedAt: '2026-11-14T19:00:00.000Z',
      }),
      order('paid-voided-later', {
        status: 'void',
        paymentMethod: 'cash',
        total: 10,
        voidedAt: '2026-11-14T19:00:00.000Z',
      }),
      order('paid-voided-in-window', {
        status: 'void',
        paymentMethod: 'cash',
        total: 4,
        voidedAt: '2026-11-14T12:00:00.000Z',
      }),
    ],
    ledger: [],
    expenses: [],
    purchasePayments: [],
  }, 'store-1', start, end, 100)

  assert.equal(totals.salesTotal, 35)
  assert.equal(totals.ordersCount, 2)
  assert.equal(totals.cashRefunds, 4)
  assert.equal(totals.expectedCash, 135)
})

test('register totals follow the assigned shift instead of an overlapping store time window', () => {
  const totals = computeRegisterTotals({
    orders: [
      order('shift-one-sale', { total: 10, shiftId: 'shift-1' }),
      order('shift-two-sale', { total: 20, shiftId: 'shift-2' }),
    ],
    ledger: [
      { storeId: 'store-1', type: 'payment', amount: 2, method: 'cash', createdAt: start, shiftId: 'shift-1' },
      { storeId: 'store-1', type: 'payment', amount: 5, method: 'cash', createdAt: start, shiftId: 'shift-2' },
    ],
    expenses: [
      { storeId: 'store-1', amount: 3, date: start, shiftId: 'shift-1' },
      { storeId: 'store-1', amount: 7, date: start, shiftId: 'shift-2' },
    ],
    purchasePayments: [
      { storeId: 'store-1', amount: 4, method: 'cash', createdAt: start, shiftId: 'shift-1' },
      { storeId: 'store-1', amount: 8, method: 'cash', createdAt: start, shiftId: 'shift-2' },
    ],
  }, 'store-1', start, end, 100, 'shift-1')

  assert.equal(totals.salesTotal, 10)
  assert.equal(totals.cashSettlements, 2)
  assert.equal(totals.expenses, 7)
  assert.equal(totals.expectedCash, 105)
})

test('store-day totals include sales assigned to every staff shift', () => {
  const dayOrders = [
    order('day-shift-one', {
      total: 15,
      shiftId: 'shift-one',
      staffId: 'staff-1',
      items: [item('coffee', 'Coffee', { qty: 3 })],
    }),
    order('day-shift-two', {
      total: 25,
      shiftId: 'shift-two',
      staffId: 'staff-2',
      staffName: 'Staff Two',
      items: [item('tea', 'Tea', { qty: 5 })],
    }),
  ]
  const totals = computeRegisterTotals({
    orders: dayOrders,
    ledger: [],
    expenses: [],
    purchasePayments: [],
  }, 'store-1', start, end, 225)
  const items = registerSessionItems({
    ...db,
    orders: dayOrders,
  }, { id: '', storeId: 'store-1', openedAt: start }, end)

  assert.equal(totals.salesTotal, 40)
  assert.equal(totals.ordersCount, 2)
  assert.equal(totals.expectedCash, 265)
  assert.equal(items.itemsSold.find((row) => row.productId === 'coffee')?.qty, 3)
  assert.equal(items.itemsSold.find((row) => row.productId === 'tea')?.qty, 5)
})

test('store-day Z details include every cashier, including admin table sales', () => {
  const dayOrders = [
    order('staff-sale', {
      total: 15,
      shiftId: 'shift-one',
      staffId: 'staff-1',
      staffName: 'Staff One',
      items: [item('coffee', 'Coffee')],
    }),
    order('admin-table-sale', {
      total: 25,
      shiftId: 'admin-shift',
      staffId: 'admin-1',
      staffName: 'Store Owner',
      items: [item('tea', 'Tea')],
    }),
    order('old-void', {
      status: 'void',
      total: 7,
      voidedAt: '2026-11-13T23:00:00.000Z',
      staffId: 'staff-1',
      items: [item('coffee', 'Coffee')],
    }),
  ]
  const details = registerReportDetails({
    stores: [{
      id: 'store-1',
      name: 'Cafe',
      address: '',
      city: '',
      phone: '',
      settings: {
        posMode: 'standard',
        printer: { width: 80 },
      },
    }],
    orders: dayOrders,
    ledger: [{
      storeId: 'store-1',
      type: 'payment',
      amount: 5,
      method: 'cash',
      createdAt: '2026-11-14T12:00:00.000Z',
      shiftId: 'shift-one',
    }],
    expenses: [],
    purchasePayments: [],
    products: [
      { id: 'coffee', storeId: 'store-1', categoryId: 'drinks', name: 'Coffee' },
      { id: 'tea', storeId: 'store-1', categoryId: 'drinks', name: 'Tea' },
    ],
    categories: [{ id: 'drinks', name: 'Drinks' }],
    inventoryItems: [],
    stockMovements: [],
    auditLogs: [],
  }, {
    id: '',
    storeId: 'store-1',
    status: 'open',
    openedAt: start,
    openedById: 'admin-1',
    openedByName: 'Store Owner',
    openingCash: 225,
  }, end)

  assert.deepEqual(details.byEmployee.map((employee) => employee.name).sort(), ['Staff One', 'Store Owner'])
  assert.equal(details.completedOrders, 2)
  assert.equal(details.itemsSold.reduce((total, row) => total + row.qty, 0), 2)
  assert.equal(details.voidedItems.length, 0)
})

test('Z breakdown includes admin, manager, and every staff session with per-person totals', () => {
  const sessions = [
    { id: 'admin-shift', storeId: 'store-1', status: 'open', openedAt: start, openedById: 'admin-1', staffId: 'admin-1', openedByName: 'Owner', openingCash: 0, autoOpened: true },
    { id: 'manager-shift', storeId: 'store-1', status: 'open', openedAt: start, openedById: 'manager-1', staffId: 'manager-1', openedByName: 'Manager', openingCash: 0, autoOpened: true },
    { id: 'staff-shift-1', storeId: 'store-1', status: 'closed', openedAt: start, openedById: 'staff-1', staffId: 'staff-1', openedByName: 'Staff One', openingCash: 0 },
    { id: 'staff-shift-2', storeId: 'store-1', status: 'closed', openedAt: start, openedById: 'staff-2', staffId: 'staff-2', openedByName: 'Staff Two', openingCash: 0 },
  ]
  const dayOrders = [
    order('admin-cash-sale', { total: 10, discount: 1, shiftId: 'admin-shift', staffId: 'admin-1', staffName: 'Owner', items: [item('coffee', 'Coffee')] }),
    order('admin-void', { total: 2, status: 'void', shiftId: 'admin-shift', voidShiftId: 'admin-shift', voidedAt: '2026-11-14T12:00:00.000Z', voidedById: 'admin-1', staffId: 'staff-1', staffName: 'Staff One' }),
    order('manager-staff-items', { total: 20, paymentMethod: 'card', shiftId: 'manager-shift', staffId: 'manager-1', staffName: 'Manager', staffConsumption: true, items: [item('tea', 'Tea')] }),
    order('staff-credit-sale', { total: 30, paymentMethod: 'credit', shiftId: 'staff-shift-1', staffId: 'staff-1', staffName: 'Staff One' }),
    order('staff-cash-sale', { total: 40, shiftId: 'staff-shift-2', staffId: 'staff-2', staffName: 'Staff Two' }),
  ]
  const source = {
    stores: [{
      id: 'store-1', name: 'Cafe', address: '', city: '', phone: '',
      settings: { posMode: 'standard', cashierModeEnabled: true, printer: { width: 80 } },
    }],
    users: [
      { id: 'admin-1', storeId: 'store-1', name: 'Owner', role: 'admin' },
      { id: 'manager-1', storeId: 'store-1', name: 'Manager', role: 'manager' },
      { id: 'staff-1', storeId: 'store-1', name: 'Staff One', role: 'staff' },
      { id: 'staff-2', storeId: 'store-1', name: 'Staff Two', role: 'staff' },
    ],
    registerSessions: sessions,
    orders: dayOrders,
    products: [],
    categories: [],
    inventoryItems: [],
    stockMovements: [],
    auditLogs: [],
    ledger: [],
    expenses: [],
    purchasePayments: [],
  }
  const details = registerReportDetails(source, {
    id: '', storeId: 'store-1', status: 'open', openedAt: start,
    openedById: 'admin-1', openedByName: 'Owner', openingCash: 0,
  }, end)
  const totals = computeRegisterTotals(source, 'store-1', start, end, 0)
  const people = details.sessionBreakdown

  assert.deepEqual(people.map((person) => person.role).sort(), ['admin', 'manager', 'staff', 'staff'])
  assert.equal(people.reduce((total, person) => total + person.cash, 0), 50)
  assert.equal(people.reduce((total, person) => total + person.card, 0), 20)
  assert.equal(people.reduce((total, person) => total + person.credit, 0), 30)
  assert.equal(people.reduce((total, person) => total + person.orders, 0), 4)
  assert.equal(people.find((person) => person.sessionId === 'manager-shift').staffItemOrders, 1)
  assert.equal(people.find((person) => person.sessionId === 'admin-shift').voids, 1)
  assert.equal(totals.salesTotal, 100)
  assert.equal(totals.cashRefunds, 2)
  assert.equal(totals.expectedCash, 50)

  const autoClosed = autoCloseRegisterSessionForZ(
    source,
    sessions[0],
    end,
    { id: 'admin-1', name: 'Owner' },
  )
  assert.equal(autoClosed.status, 'closed')
  assert.equal(autoClosed.closeType, 'shift')
  assert.equal(autoClosed.countedCash, 10)
  assert.equal(autoClosed.difference, 0)
  assert.equal(autoClosed.snapshot.expectedCash, 10)
})

test('coffee shift report compares yield estimate, recipe use, and tracked stock remainder', () => {
  const session = {
    id: 'session-1',
    storeId: 'store-1',
    status: 'open',
    openedAt: start,
    openedById: 'staff-1',
    staffId: 'staff-1',
    openedByName: 'Staff One',
    openingCash: 0,
  }
  const details = registerReportDetails({
    stores: [{
      id: 'store-1',
      name: 'Cafe',
      address: '',
      city: '',
      phone: '',
      settings: {
        posMode: 'quick',
        taxRate: 0,
        taxInclusive: false,
        serviceCharge: 0,
        printer: { width: 80 },
        coffeeTracking: {
          enabled: true,
          inventoryItemId: 'beans',
          servingsPerKgMin: 50,
          servingsPerKgMax: 70,
        },
      },
    }],
    registerSessions: [session],
    orders: [{
      ...order('coffee-sale', {
        items: [item('espresso', 'Espresso', { qty: 10 })],
        total: 20,
        createdAt: '2026-11-14T10:00:00.000Z',
      }),
      shiftId: session.id,
      paidById: 'staff-1',
    }],
    products: [{
      id: 'espresso',
      storeId: 'store-1',
      categoryId: 'drinks',
      name: 'Espresso',
      recipe: [{ inventoryItemId: 'beans', qtyPerUnit: 18 }],
    }],
    categories: [{ id: 'drinks', name: 'Drinks' }],
    inventoryItems: [{
      id: 'beans',
      storeId: 'store-1',
      name: 'Coffee beans',
      baseUnit: 'g',
      onHand: 920,
    }],
    stockMovements: [{
      id: 'sale-use',
      storeId: 'store-1',
      itemId: 'beans',
      type: 'sale_use',
      qtyDelta: -100,
      createdAt: '2026-11-14T10:00:00.000Z',
    }, {
      id: 'stock-count',
      storeId: 'store-1',
      itemId: 'beans',
      type: 'count_correction',
      qtyDelta: 20,
      createdAt: '2026-11-14T17:00:00.000Z',
    }],
    ledger: [],
    expenses: [],
    purchasePayments: [],
    auditLogs: [],
  }, session, end)

  assert.equal(details.coffeeBeanSummary.servingsSold, 10)
  assert.equal(details.coffeeBeanSummary.recipeUse, 180)
  assert.equal(details.coffeeBeanSummary.expectedUseMin, 142.857)
  assert.equal(details.coffeeBeanSummary.expectedUseMax, 200)
  assert.equal(details.coffeeBeanSummary.expectedRemainingMin, 800)
  assert.equal(details.coffeeBeanSummary.expectedRemainingMax, 857.143)
  assert.equal(details.coffeeBeanSummary.ledgerRemaining, 920)
})

test('staff may have separate concurrent shifts while duplicate personal shifts are not selected', () => {
  const sessions = [
    { id: 'one', storeId: 'store-1', status: 'open', openedById: 'staff-1', staffId: 'staff-1' },
    { id: 'two', storeId: 'store-1', status: 'open', openedById: 'staff-2', staffId: 'staff-2' },
    { id: 'closed', storeId: 'store-1', status: 'closed', openedById: 'staff-1', staffId: 'staff-1' },
  ]

  assert.equal(openShiftForStaff({ registerSessions: sessions }, 'store-1', 'staff-1')?.id, 'one')
  assert.equal(openShiftForStaff({ registerSessions: sessions }, 'store-1', 'staff-2')?.id, 'two')
  assert.equal(openShiftForStaff({ registerSessions: sessions }, 'store-1', 'staff-3'), undefined)
})

test('admin and manager auto-shifts are created once while staff shifts remain required', () => {
  const sessions = []
  const admin = { id: 'admin-1', name: 'Owner', role: 'admin' }
  const first = ensureShiftForActor({ registerSessions: sessions }, 'store-1', admin)
  assert.equal(first.autoOpened, true)
  assert.equal(first.shift.openedById, admin.id)
  assert.equal(first.shift.staffId, admin.id)
  assert.equal(first.shift.openingCash, 0)
  assert.equal(first.shift.autoOpened, true)

  const afterFirst = [...sessions, first.shift]
  const second = ensureShiftForActor({ registerSessions: afterFirst }, 'store-1', admin)
  assert.equal(second.shift.id, first.shift.id)
  assert.equal(second.autoOpened, false)

  const manager = ensureShiftForActor({ registerSessions: [] }, 'store-1', {
    id: 'manager-1', name: 'Manager', role: 'manager',
  })
  assert.equal(manager.autoOpened, true)
  assert.equal(manager.shift.openingCash, 0)

  const staff = ensureShiftForActor({ registerSessions: [] }, 'store-1', {
    id: 'staff-1', name: 'Staff', role: 'staff',
  })
  assert.equal(staff.shift, undefined)
  assert.equal(staff.autoOpened, false)
})

test('store-day Z requires staff shifts to close or be force-closed first', () => {
  const source = {
    users: [
      { id: 'admin-1', storeId: 'store-1', role: 'admin' },
      { id: 'manager-1', storeId: 'store-1', role: 'manager' },
      { id: 'staff-1', storeId: 'store-1', role: 'staff' },
    ],
    registerSessions: [
      { id: 'owner-shift', storeId: 'store-1', status: 'open', staffId: 'admin-1', autoOpened: true },
      { id: 'manager-shift', storeId: 'store-1', status: 'open', staffId: 'manager-1', autoOpened: true },
      { id: 'staff-shift', storeId: 'store-1', status: 'open', staffId: 'staff-1' },
    ],
  }

  assert.equal(hasOpenShiftsRequiringManualClose(source, 'store-1'), true)
  source.registerSessions = source.registerSessions.filter((session) => session.id !== 'staff-shift')
  assert.equal(hasOpenShiftsRequiringManualClose(source, 'store-1'), false)
  source.registerSessions.push({
    id: 'manual-owner-shift',
    storeId: 'store-1',
    status: 'open',
    staffId: 'admin-1',
  })
  assert.equal(hasOpenShiftsRequiringManualClose(source, 'store-1'), true)
})

test('persisting an auto-shift adds its session and audit record to the same database update', () => {
  const actor = { id: 'manager-1', name: 'Manager', role: 'manager' }
  const previous = { registerSessions: [], auditLogs: [] }
  const ensured = ensureShiftForActor(previous, 'store-1', actor)
  const next = withEnsuredShift(previous, ensured, actor, 'store-1')

  assert.equal(next.registerSessions.length, 1)
  assert.equal(next.registerSessions[0].id, ensured.shift.id)
  assert.equal(next.auditLogs[0].summary, 'Shift auto-opened for Manager')
})

test('paid table finalization removes the table idempotently without repeating stock deductions', () => {
  const openOrder = {
    id: 'open-1',
    storeId: 'store-1',
    tableName: 'T1',
    items: [],
    subtotal: 5,
    tax: 0,
    service: 0,
    discount: 0,
    total: 5,
    channel: 'dine-in',
    status: 'open',
    staffId: 'admin-1',
    staffName: 'Owner',
    recordedOrderId: 'recorded-1',
    createdAt: start,
  }
  const paidOrder = {
    id: 'paid-1',
    storeId: 'store-1',
    number: 1,
    items: [],
    subtotal: 5,
    tax: 0,
    service: 0,
    discount: 0,
    total: 5,
    channel: 'dine-in',
    status: 'completed',
    paymentMethod: 'cash',
    staffId: 'admin-1',
    staffName: 'Owner',
    clientOrderId: 'pay:open-1',
    createdAt: end,
  }
  const source = {
    ...db,
    openOrders: [openOrder],
    orders: [{ ...paidOrder, id: 'recorded-1', status: 'recorded', paymentMethod: 'unpaid' }],
    products: [{ id: 'coffee', storeId: 'store-1', stock: 3 }],
  }
  const paymentHistory = [
    { id: 'payment', type: 'payment', actorId: 'admin-1', actorName: 'Owner', at: end },
    { id: 'closed', type: 'closed', actorId: 'admin-1', actorName: 'Owner', at: end },
  ]
  const first = completeOpenOrderPayment(source, openOrder, paidOrder, paymentHistory)
  const retry = completeOpenOrderPayment(first.database, openOrder, first.order, paymentHistory)

  assert.equal(first.database.openOrders.length, 0)
  assert.equal(first.database.orders.length, 1)
  assert.equal(first.order.total, 5)
  assert.equal(first.database.products[0].stock, 3)
  assert.equal(retry.database.openOrders.length, 0)
  assert.equal(retry.database.orders.filter((item) => item.clientOrderId === 'pay:open-1').length, 1)
  assert.equal(retry.database.products[0].stock, 3)
  assert.equal(retry.order.tableHistory.at(-1).type, 'closed')
})

test('prints every item without exceeding 58mm or 80mm line widths', () => {
  const names = Array.from({ length: 14 }, (_, index) =>
    index === 13
      ? 'UniqueProduct-14 exceptionally long seasonal pastry name with several words that must wrap across thermal lines'
      : `UniqueProduct-${String(index + 1).padStart(2, '0')} Cafe item`,
  )
  const products = names.map((_, index) => ({ id: `item-${index}`, categoryId: 'extras' }))
  const items = names.map((name, index) => item(`item-${index}`, name))
  const itemReport = registerSessionItems({
    orders: [order('long-list', { items })],
    products,
    categories: [{ id: 'extras', name: 'Extras' }],
  }, session, end)

  const reportData = {
    kind: 'X',
    store: { name: 'Test Cafe', address: '', city: 'Tunis', phone: '' },
    session: { id: 'session-1', openedAt: start, openedByName: 'Cashier', openingCash: 0 },
    snapshot: {
      salesTotal: 0,
      cashSales: 0,
      cardSales: 0,
      creditSales: 0,
      ordersCount: 1,
      voidedCount: 0,
      voidedTotal: 0,
      cashRefunds: 0,
      discounts: 0,
      tax: 0,
      service: 0,
      expenses: 0,
      cashSettlements: 0,
      cardSettlements: 0,
      settlementCount: 0,
      expectedCash: 0,
    },
    details: null,
    itemsReport: itemReport,
    reportNumber: 'X-TEST',
    generatedAt: end,
    generatedBy: 'Cashier',
  }

  for (const [width, columns] of [[58, 32], [80, 48]]) {
    const lines = buildReportLines({ ...reportData, width })
    const startIndex = lines.findIndex((line) => line.text === 'ITEMS SOLD')
    const endIndex = lines.findIndex((line) => line.text === 'RECORDED (NO PAYMENT)')
    const soldLines = lines.slice(startIndex, endIndex)
    const text = soldLines.map((line) => line.text).join(' ')

    assert.equal(itemReport.itemsSold.length, 14)
    assert.ok(soldLines.every((line) => Array.from(line.text).length <= columns))
    for (const name of names) {
      for (const word of name.split(/\s+/)) assert.ok(text.includes(word), `${word} missing at ${width}mm`)
    }
  }
})

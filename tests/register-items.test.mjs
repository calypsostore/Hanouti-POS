import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSessionItems, summarizeRegisterItems } from '../src/lib/registerItems.ts'
import { computeRegisterTotals } from '../src/lib/reports.ts'
import { openShiftForStaff } from '../src/lib/registerShifts.ts'
import { buildReportLines } from '../src/lib/escpos.ts'

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
  discount: 0,
  total: options.total ?? 0,
  channel: 'takeaway',
  status: options.status ?? 'completed',
  paymentMethod: options.paymentMethod ?? 'cash',
  staffId: options.staffId ?? 'staff-1',
  staffName: options.staffName ?? 'Staff One',
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

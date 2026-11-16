import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateLegacyCoffeeTracking, normalizeInventoryYieldTracking } from '../src/lib/defaults.ts'
import { registerReportDetails } from '../src/lib/reports.ts'

test('normalizes unique inventory-yield rules and consuming targets', () => {
  const settings = normalizeInventoryYieldTracking({
    enabled: true,
    trackers: [
      {
        inventoryItemId: ' beans ',
        referenceQuantity: 1000,
        servingsMin: 50,
        servingsMax: 70,
        productIds: ['espresso', 'espresso', ''],
        categoryIds: ['coffee'],
      },
      {
        inventoryItemId: 'beans',
        referenceQuantity: 1,
        servingsMin: 1,
        servingsMax: 1,
        productIds: [],
        categoryIds: [],
      },
      {
        inventoryItemId: 'invalid',
        referenceQuantity: 0,
        servingsMin: 1,
        servingsMax: 1,
        productIds: [],
        categoryIds: [],
      },
    ],
  })

  assert.deepEqual(settings, {
    enabled: true,
    trackers: [{
      inventoryItemId: 'beans',
      referenceQuantity: 1000,
      servingsMin: 50,
      servingsMax: 70,
      productIds: ['espresso'],
      categoryIds: ['coffee'],
    }],
  })
})

test('preserves more than 100 inventory-yield trackers', () => {
  const trackers = Array.from({ length: 101 }, (_, index) => ({
    inventoryItemId: `inventory-${index}`,
    referenceQuantity: 1000,
    servingsMin: 1,
    servingsMax: 1,
    productIds: ['product-1'],
    categoryIds: [],
  }))

  assert.equal(normalizeInventoryYieldTracking({ enabled: true, trackers }).trackers.length, 101)
})

test('migrates legacy coffee yield settings to recipe-linked products', () => {
  const settings = migrateLegacyCoffeeTracking({
    enabled: true,
    inventoryItemId: 'legacy-beans',
    servingsPerKgMin: 50,
    servingsPerKgMax: 70,
  }, [
    { id: 'espresso', storeId: 'store-1', recipe: [{ inventoryItemId: 'legacy-beans', qtyPerUnit: 18 }] },
    { id: 'juice', storeId: 'store-1', recipe: [{ inventoryItemId: 'juice', qtyPerUnit: 200 }] },
    { id: 'other-store', storeId: 'store-2', recipe: [{ inventoryItemId: 'legacy-beans', qtyPerUnit: 18 }] },
  ], 'store-1')

  assert.deepEqual(settings, {
    enabled: true,
    trackers: [{
      inventoryItemId: 'legacy-beans',
      referenceQuantity: 1000,
      servingsMin: 50,
      servingsMax: 70,
      productIds: ['espresso'],
      categoryIds: [],
    }],
  })
})

test('shift yield tracks selected products and categories against purchases, recipes, and stock counts', () => {
  const session = {
    id: 'shift-1',
    storeId: 'store-1',
    status: 'open',
    openedAt: '2026-11-14T08:00:00.000Z',
    openedById: 'staff-1',
    staffId: 'staff-1',
    openedByName: 'Staff One',
    openingCash: 0,
  }
  const order = (id, items) => ({
    id,
    storeId: 'store-1',
    number: 1001,
    items,
    subtotal: 30,
    tax: 0,
    service: 0,
    discount: 0,
    total: 30,
    channel: 'takeaway',
    status: 'completed',
    paymentMethod: 'cash',
    staffId: 'staff-1',
    staffName: 'Staff One',
    paidById: 'staff-1',
    shiftId: session.id,
    createdAt: '2026-11-14T10:00:00.000Z',
  })
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
        inventoryYieldTracking: {
          enabled: true,
          trackers: [
            {
              inventoryItemId: 'beans',
              referenceQuantity: 1000,
              servingsMin: 50,
              servingsMax: 70,
              productIds: [],
              categoryIds: ['coffee'],
            },
            {
              inventoryItemId: 'juice',
              referenceQuantity: 1000,
              servingsMin: 5,
              servingsMax: 5,
              productIds: ['orange-cup'],
              categoryIds: [],
            },
          ],
        },
      },
    }],
    registerSessions: [session],
    orders: [order('sale-1', [
      { productId: 'espresso', name: 'Espresso', price: 2, qty: 10 },
      { productId: 'orange-cup', name: 'Orange cup', price: 3, qty: 3 },
      { productId: 'cake', name: 'Cake', price: 4, qty: 8 },
    ])],
    products: [
      { id: 'espresso', storeId: 'store-1', categoryId: 'coffee', name: 'Espresso', recipe: [{ inventoryItemId: 'beans', qtyPerUnit: 18 }] },
      { id: 'orange-cup', storeId: 'store-1', categoryId: 'drinks', name: 'Orange cup', recipe: [{ inventoryItemId: 'juice', qtyPerUnit: 200 }] },
      { id: 'cake', storeId: 'store-1', categoryId: 'desserts', name: 'Cake' },
    ],
    categories: [
      { id: 'coffee', storeId: 'store-1', name: 'Coffee' },
      { id: 'drinks', storeId: 'store-1', name: 'Drinks' },
      { id: 'desserts', storeId: 'store-1', name: 'Desserts' },
    ],
    inventoryItems: [
      { id: 'beans', storeId: 'store-1', name: 'Coffee beans', baseUnit: 'g', onHand: 1840 },
      { id: 'juice', storeId: 'store-1', name: 'Orange juice', baseUnit: 'ml', onHand: 1400 },
    ],
    stockMovements: [
      { id: 'beans-purchase', storeId: 'store-1', itemId: 'beans', type: 'purchase', qtyDelta: 1000, createdAt: '2026-11-14T11:00:00.000Z' },
      { id: 'beans-sale', storeId: 'store-1', itemId: 'beans', type: 'sale_use', qtyDelta: -180, createdAt: '2026-11-14T12:00:00.000Z' },
      { id: 'beans-count', storeId: 'store-1', itemId: 'beans', type: 'count_correction', qtyDelta: 20, createdAt: '2026-11-14T17:00:00.000Z' },
      { id: 'juice-purchase', storeId: 'store-1', itemId: 'juice', type: 'purchase', qtyDelta: 1000, createdAt: '2026-11-14T11:00:00.000Z' },
      { id: 'juice-sale', storeId: 'store-1', itemId: 'juice', type: 'sale_use', qtyDelta: -600, createdAt: '2026-11-14T12:00:00.000Z' },
    ],
    ledger: [],
    expenses: [],
    purchasePayments: [],
    auditLogs: [],
  }, session, '2026-11-14T18:00:00.000Z')

  assert.deepEqual(details.inventoryYieldSummaries, [
    {
      itemName: 'Coffee beans',
      soldQuantity: 10,
      referenceQuantity: 1000,
      expectedUseMin: 142.857,
      expectedUseMax: 200,
      recipeUse: 180,
      expectedRemainingMin: 1800,
      expectedRemainingMax: 1857.143,
      ledgerRemaining: 1840,
      unit: 'g',
    },
    {
      itemName: 'Orange juice',
      soldQuantity: 3,
      referenceQuantity: 1000,
      expectedUseMin: 600,
      expectedUseMax: 600,
      recipeUse: 600,
      expectedRemainingMin: 1400,
      expectedRemainingMax: 1400,
      ledgerRemaining: 1400,
      unit: 'ml',
    },
  ])
})

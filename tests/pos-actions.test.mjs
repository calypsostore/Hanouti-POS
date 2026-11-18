import test from 'node:test'
import assert from 'node:assert/strict'
import { createPOSActions } from '../src/pages/pos/posActions.ts'

test('payment failure is returned for inline display without resetting the sale or closing payment', () => {
  const calls = []
  const action = createPOSActions({
    store: { settings: { features: { tables: false }, orderRules: {} } },
    channel: 'takeaway',
    quick: false,
    cart: [{ lineId: 'line-1', productId: 'tea', name: 'Tea', price: 2, qty: 1 }],
    discount: 0,
    note: '',
    activeDiscount: 0,
    activeNote: '',
    canSaveOpenOrder: false,
    count: 1,
    canUseCredit: false,
    createOrder: () => ({ ok: false, error: 'Payment could not be recorded.' }),
    push: (...args) => calls.push(['toast', ...args]),
    setCart: (...args) => calls.push(['cart', ...args]),
    setPaymentOpen: (...args) => calls.push(['payment', ...args]),
    setMobileCartOpen: (...args) => calls.push(['mobile', ...args]),
  })

  assert.equal(action.completeSale('cash'), 'Payment could not be recorded.')
  assert.deepEqual(calls, [['toast', 'Payment could not be recorded.', 'error']])
})

test('Quick checkout uses the single tracking channel and does not show a receipt', () => {
  const submitted = []
  const receipts = []
  const noop = () => {}
  const action = createPOSActions({
    store: { settings: { features: { tables: true }, orderRules: { orderNumberFormat: 'sequential' } } },
    channel: 'delivery',
    tableId: 'table-1',
    tableName: 'Table 1',
    guests: 3,
    quick: true,
    cart: [{ lineId: 'line-1', productId: 'tea', name: 'Tea', price: 2, qty: 1 }],
    discount: 0,
    note: '',
    activeDiscount: 0,
    activeNote: '',
    canSaveOpenOrder: false,
    count: 1,
    canUseCredit: false,
    createOrder: (input) => {
      submitted.push(input)
      return { ok: true, order: { id: 'order-1', number: 1, total: 2 } }
    },
    addItemsToOpenOrder: () => ({ ok: false, error: 'Unused in this test.' }),
    sendToStations: () => ({ ok: false, error: 'Unused in this test.' }),
    dispatchStationTickets: noop,
    payOpenOrder: () => ({ ok: false, error: 'Unused in this test.' }),
    recordOpenOrder: () => ({ ok: false, error: 'Unused in this test.' }),
    push: noop,
    focusTablePicker: noop,
    setCart: noop,
    setDiscount: noop,
    setOpenDiscount: noop,
    setOpenNote: noop,
    setChannel: noop,
    setTableId: noop,
    setTableName: noop,
    setGuests: noop,
    setCustomerId: noop,
    setCustomerOpen: noop,
    setPaymentOpen: noop,
    setMobileCartOpen: noop,
    setReceipt: (receipt) => receipts.push(receipt),
    navigateToFloor: noop,
  })

  action.checkout()

  assert.equal(submitted[0].channel, 'takeaway')
  assert.equal(submitted[0].paymentMethod, 'unpaid')
  assert.equal(submitted[0].tableId, undefined)
  assert.equal(submitted[0].tableName, undefined)
  assert.equal(submitted[0].guests, undefined)
  assert.deepEqual(receipts, [])
})

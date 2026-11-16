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

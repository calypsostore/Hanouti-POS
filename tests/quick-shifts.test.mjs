import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateQuickDayClose, calculateQuickShiftClose } from '../src/lib/quickShifts.ts'
import { openCashDifferenceBalance } from '../src/lib/shiftCash.ts'

test('Quick shift declarations derive sales from the counted total less the float', () => {
  const sarra = calculateQuickShiftClose(50, 1300, 1250)
  const sami = calculateQuickShiftClose(50, 1350, 1300)

  assert.deepEqual(sarra, { declaredSales: 1250, difference: 0 })
  assert.deepEqual(sami, { declaredSales: 1300, difference: 0 })
})

test('Quick shift expected-sales differences add across staff and corrections reduce open balance', () => {
  const sarra = calculateQuickShiftClose(50, 1308, 1260)
  const sami = calculateQuickShiftClose(50, 1320, 1290)

  assert.equal(sarra.difference + sami.difference, -22)
  assert.equal(openCashDifferenceBalance([{
    id: 'difference',
    storeId: 'store',
    staffId: 'sami',
    shiftId: 'shift',
    amount: -20,
    type: 'shortage',
    status: 'open',
    createdAt: new Date().toISOString(),
    correctionEntries: [{
      id: 'correction',
      amount: 5,
      staffId: 'sami',
      staffName: 'Sami',
      at: new Date().toISOString(),
    }],
  }], 'sami'), -15)
})

test('Quick manager Z adds the retained float once and reports each staff difference', () => {
  const shifts = [
    {
      shiftId: 'sarra-shift',
      staffId: 'sarra',
      staffName: 'Sarra',
      openedAt: '2025-01-01T08:00:00.000Z',
      openingFloat: 50,
      countedCash: 1300,
      declaredSales: 1250,
      expectedSales: 1250,
      difference: 0,
    },
    {
      shiftId: 'sami-shift',
      staffId: 'sami',
      staffName: 'Sami',
      openedAt: '2025-01-01T12:00:00.000Z',
      openingFloat: 50,
      countedCash: 1350,
      declaredSales: 1300,
      expectedSales: 1300,
      difference: 0,
    },
  ]
  const balanced = calculateQuickDayClose(shifts, 50, 2600)
  assert.equal(balanced.expectedCash, 2600)
  assert.equal(balanced.difference, 0)

  const shortByStaff = calculateQuickDayClose([
    { ...shifts[0], declaredSales: 1258, expectedSales: 1260, difference: -2 },
    { ...shifts[1], declaredSales: 1270, expectedSales: 1290, difference: -20 },
  ], 50, 2556)
  assert.equal(shortByStaff.expectedCash, 2578)
  assert.equal(shortByStaff.difference, -22)
  assert.deepEqual(shortByStaff.staffDifferences.map((staff) => [staff.staffName, staff.amount]), [
    ['Sarra', -2],
    ['Sami', -20],
  ])
})

test('Quick shift with no expected-sales tally records declared sales without a difference', () => {
  assert.deepEqual(calculateQuickShiftClose(50, 1300), {
    declaredSales: 1250,
    difference: 0,
  })
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStationTickets, buildStationTicketLines } from '../src/lib/tickets.ts'

const stations = [
  { id: 'kitchen', storeId: 'store', name: 'Kitchen', icon: 'Utensils', color: 'rose', screen: true, active: true, sort: 0 },
  { id: 'bar', storeId: 'store', name: 'Bar', icon: 'CupSoda', color: 'blue', screen: true, active: true, sort: 1 },
]
const order = {
  number: 42,
  tableName: 'Table 3',
  sectionName: 'Terrace',
  guests: 4,
  staffName: 'Nadia',
  createdAt: '2026-11-15T10:30:00.000Z',
}

test('splits new items by assigned station and omits unassigned items', () => {
  const tickets = buildStationTickets(order, [
    { lineId: '1', productId: 'coffee', name: 'Espresso', price: 2, qty: 2, stationId: 'bar', status: 'sent' },
    { lineId: '2', productId: 'food', name: 'Sandwich', price: 5, qty: 1, stationId: 'kitchen', status: 'sent' },
    { lineId: '3', productId: 'water', name: 'Water', price: 1, qty: 1, status: 'sent' },
  ], stations)

  assert.deepEqual(tickets.map((ticket) => [ticket.stationId, ticket.items.length]), [['bar', 1], ['kitchen', 1]])
  assert.equal(tickets[0].tableName, 'Table 3')
  assert.equal(tickets[1].sectionName, 'Terrace')
  assert.equal(tickets[1].guests, 4)
})

test('formats ADDITION and CANCELLED tickets with modifiers, notes, rush, and void reason', () => {
  const addition = buildStationTickets(order, [{
    lineId: '1',
    productId: 'coffee',
    name: 'Cappuccino',
    price: 3,
    qty: 1,
    stationId: 'bar',
    status: 'sent',
    note: 'oat milk',
    modifiers: [{ groupId: 'size', groupName: 'Size', optionId: 'large', optionName: 'Large', priceDelta: 1 }],
  }], stations, 'ADDITION', true)[0]
  const additionLines = buildStationTicketLines(addition).map((line) => line.text)
  assert.ok(additionLines.includes('ADDITION'))
  assert.ok(additionLines.includes('*** RUSH ***'))
  assert.ok(additionLines.includes('  + Large'))
  assert.ok(additionLines.includes('  NOTE: oat milk'))

  const cancelled = buildStationTickets(order, [{
    lineId: '2',
    productId: 'food',
    name: 'Sandwich',
    price: 5,
    qty: 1,
    stationId: 'kitchen',
    status: 'void',
    voidReason: 'Customer changed order',
  }], stations, 'CANCELLED')[0]
  const cancelledLines = buildStationTicketLines(cancelled).map((line) => line.text)
  assert.ok(cancelledLines.includes('CANCELLED'))
  assert.ok(cancelledLines.includes('  REASON: Customer changed order'))
})

test('uses the item send time and supports a marked reprint', () => {
  const ticket = buildStationTickets(order, [{
    lineId: '4',
    productId: 'coffee',
    name: 'Tea',
    price: 2,
    qty: 1,
    stationId: 'bar',
    status: 'ready',
    sentAt: '2026-11-15T10:42:00.000Z',
  }], stations, 'REPRINT')[0]

  assert.equal(ticket.time, '2026-11-15T10:42:00.000Z')
  assert.equal(buildStationTicketLines(ticket)[0].text, 'REPRINT')
})

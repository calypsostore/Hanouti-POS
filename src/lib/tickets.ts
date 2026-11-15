import type { OpenOrder, OrderItem, Station } from '../types'
import type { ReceiptLine } from './escpos'

export type TicketKind = 'NEW' | 'ADDITION' | 'CANCELLED' | 'REPRINT'

export interface StationTicket {
  stationId: string
  stationName: string
  kind: TicketKind
  rush: boolean
  orderNumber: number
  tableName: string
  sectionName?: string
  guests?: number
  staffName: string
  time: string
  items: OrderItem[]
}

type TicketOrder = Pick<
  OpenOrder,
  'number' | 'tableName' | 'sectionName' | 'guests' | 'staffName' | 'createdAt'
>

export function buildStationTickets(
  order: TicketOrder,
  items: OrderItem[],
  stations: Station[],
  kind: TicketKind = 'NEW',
  rush = false,
): StationTicket[] {
  const grouped = new Map<string, OrderItem[]>()
  for (const item of items) {
    if (!item.stationId || (kind === 'CANCELLED' ? item.status !== 'void' : item.status === 'void')) continue
    const station = stations.find((candidate) => candidate.id === item.stationId)
    if (!station) continue
    const stationItems = grouped.get(station.id) ?? []
    stationItems.push(item)
    grouped.set(station.id, stationItems)
  }
  return [...grouped.entries()].flatMap(([stationId, stationItems]) => {
    const station = stations.find((candidate) => candidate.id === stationId)
    return station ? [{
      stationId,
      stationName: station.name,
      kind,
      rush,
      orderNumber: order.number,
      tableName: order.tableName,
      sectionName: order.sectionName,
      guests: order.guests,
      staffName: order.staffName,
      time: stationItems
        .map((item) => item.sentAt ?? item.addedAt ?? order.createdAt)
        .sort()
        .at(-1) ?? order.createdAt,
      items: stationItems,
    }] : []
  })
}

export function buildStationTicketLines(ticket: StationTicket): ReceiptLine[] {
  const lines: ReceiptLine[] = [
    { text: ticket.kind, align: 'center', bold: true, size: 'double' },
    { text: ticket.stationName, align: 'center', bold: true },
    { text: ticket.tableName, align: 'center', bold: true, size: 'double' },
  ]
  if (ticket.sectionName) lines.push({ text: `SECTION: ${ticket.sectionName}`, align: 'center' })
  if (ticket.guests !== undefined) lines.push({ text: `GUESTS: ${ticket.guests}`, align: 'center' })
  lines.push({ text: `ORDER #${ticket.orderNumber} · ${new Date(ticket.time).toISOString().slice(11, 16)}`, bold: true })
  lines.push({ text: `STAFF: ${ticket.staffName}` })
  if (ticket.rush) lines.push({ text: '*** RUSH ***', align: 'center', bold: true })
  for (const item of ticket.items) {
    const quantity = item.soldByWeight ? item.qty.toFixed(3) : String(item.qty)
    lines.push({ text: `${quantity} x ${item.name}`, bold: true, size: 'double' })
    for (const modifier of item.modifiers ?? []) lines.push({ text: `  + ${modifier.optionName}` })
    if (item.note) lines.push({ text: `  NOTE: ${item.note}`, bold: true })
    if (item.voidReason) lines.push({ text: `  REASON: ${item.voidReason}`, bold: true })
  }
  lines.push({ text: `- ${ticket.staffName}`, align: 'right' })
  return lines
}

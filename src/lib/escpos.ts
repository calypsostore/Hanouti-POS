import type { OpenOrder, Order, OrderItem, PrinterWidth, RegisterSession, RegisterSnapshot, Store } from '../types'
import { fmtDate, fmtDateTime, fmtTime } from './utils'
import { round } from './pricing-utils'
import { BRAND_NAME } from './brand'

/**
 * ESC/POS receipt builder.
 *
 * Produces both:
 *  - a plain-text line model (used for the on-screen preview and the
 *    browser-print fallback), and
 *  - a raw ESC/POS byte payload (used for real thermal printers through
 *    WebSerial).
 *
 * Text is encoded as Windows-1252 (sent with `ESC t 16`, Epson's WPC1252
 * mapping — widely supported by Epson and clone firmware). Arabic is not
 * encodable in this codepage: characters outside the table are replaced with
 * '?'. Arabic printing needs a printer with a built-in Arabic codepage or a
 * raster-image pipeline and is documented as a hardware-dependent limitation.
 */

export interface ReceiptLine {
  text: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  size?: 'normal' | 'double'
}

export const columnsFor = (width: PrinterWidth) => (width === 58 ? 32 : 48)

const repeat = (ch: string, n: number) => (n > 0 ? ch.repeat(n) : '')
const truncate = (text: string, length: number) => Array.from(text).slice(0, length).join('')

const stripEmoji = (text: string) =>
  Array.from(text)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0
      return !(
        (code >= 0x1f000 && code <= 0x1faff) ||
        (code >= 0x2600 && code <= 0x27ff) ||
        (code >= 0x1f1e6 && code <= 0x1f1ff) ||
        code === 0x200d ||
        code === 0xfe0f ||
        code === 0x20e3 ||
        (code >= 0xe0020 && code <= 0xe007f) ||
        (code >= 0x1f3fb && code <= 0x1f3ff)
      )
    })
    .join('')

/** Two-column line, e.g. `1x Espresso   2.420`. */
const twoCol = (left: string, right: string, cols: number) => {
  const rightText = truncate(right, cols)
  const leftText = truncate(left, Math.max(0, cols - Array.from(rightText).length - 1))
  return leftText + repeat(' ', Math.max(1, cols - Array.from(leftText).length - Array.from(rightText).length)) + rightText
}

const center = (text: string, cols: number) => {
  const t = truncate(text, cols)
  const pad = Math.max(0, Math.floor((cols - Array.from(t).length) / 2))
  return repeat(' ', pad) + t
}

const divider = (cols: number) => repeat('-', cols)

const amount = (n: number) => n.toFixed(3)

export const linesToText = (lines: ReceiptLine[], cols: number): string[] =>
  lines.map((l) => {
    const text = l.text
    if (l.align === 'center') return center(text, cols)
    if (l.align === 'right') return truncate(text, cols).padStart(cols)
    return truncate(text, cols)
  })

/* ------------------------------ byte encoding ------------------------------ */

const CP1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
}

const encodeCp1252 = (text: string): Uint8Array => {
  const bytes: number[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 0x80) bytes.push(code)
    else if (code < 0x100) bytes.push(code)
    else if (CP1252_HIGH[code] !== undefined) bytes.push(CP1252_HIGH[code])
    else bytes.push(0x3f) // '?' — unsupported glyph (e.g. Arabic)
  }
  return new Uint8Array(bytes)
}

export const linesToEscpos = (lines: ReceiptLine[], width: PrinterWidth): Uint8Array => {
  const out: number[] = []
  const push = (...b: number[]) => out.push(...b)
  const cols = columnsFor(width)

  push(0x1b, 0x40) // ESC @ — initialize
  push(0x1b, 0x74, 0x10) // ESC t 16 — Windows-1252 codepage
  push(0x1b, 0x61, 0x00) // ESC a 0 — left align

  for (const line of lines) {
    push(0x1b, 0x61, line.align === 'center' ? 0x01 : line.align === 'right' ? 0x02 : 0x00)
    push(0x1b, 0x45, line.bold ? 0x01 : 0x00)
    if (line.size === 'double') push(0x1d, 0x21, 0x11) // GS ! 17 — 2× wide/tall
    else push(0x1d, 0x21, 0x00)
    for (const byte of encodeCp1252(truncate(line.text, cols) + '\n')) push(byte)
  }

  push(0x1d, 0x21, 0x00)
  push(0x1b, 0x45, 0x00)
  push(0x1b, 0x64, 0x04) // ESC d 4 — feed 4 lines
  push(0x1d, 0x56, 0x42, 0x03) // GS V 66 3 — partial cut after feed
  return new Uint8Array(out)
}

/* -------------------------------- receipts -------------------------------- */

export const buildReceiptLines = (
  order: Order,
  store: Store,
  opts: { reprint?: boolean; customerName?: string } = {},
): ReceiptLine[] => {
  const cols = columnsFor(store.settings.printer.width)
  const lines: ReceiptLine[] = []

  lines.push({ text: BRAND_NAME, align: 'center', bold: true })
  lines.push({ text: store.name, align: 'center', bold: true, size: 'double' })
  lines.push({ text: store.address, align: 'center' })
  lines.push({ text: `${store.city} · ${store.phone}`, align: 'center' })
  lines.push({ text: '' })
  if (opts.reprint) lines.push({ text: '*** REPRINT ***', align: 'center', bold: true })
  lines.push({ text: divider(cols) })
  lines.push({ text: twoCol(`Order #${order.number}`, fmtDateTime(order.createdAt), cols) })
  lines.push({ text: twoCol(order.channel.replace('-', ' '), order.staffName, cols) })
  if (order.tableName) {
    lines.push({ text: `${order.tableName.toUpperCase()}${order.guests ? ` · ${order.guests} GUESTS` : ''}`, align: 'center', bold: true })
  }
  if (order.customerId) {
    lines.push({ text: `Tab: ${opts.customerName ?? 'Customer'}` })
  }
  lines.push({ text: divider(cols) })
  for (const item of order.items) {
    const quantity = item.soldByWeight
      ? `${item.qty.toFixed(3)} ${item.saleUnit ?? 'piece'}`
      : `${item.qty} x`
    const variant = item.variantName ? ` · ${stripEmoji(item.variantName)}` : ''
    lines.push({ text: twoCol(`${quantity} ${stripEmoji(item.name)}${variant}`, amount(round(item.price * item.qty)), cols) })
    for (const modifier of item.modifiers ?? []) {
      lines.push({ text: `  + ${stripEmoji(modifier.optionName)}` })
    }
    if (item.note) lines.push({ text: `  Note: ${stripEmoji(item.note)}` })
  }
  lines.push({ text: divider(cols) })
  lines.push({ text: twoCol('Subtotal', amount(order.subtotal), cols) })
  if (order.service > 0) lines.push({ text: twoCol('Service', amount(order.service), cols) })
  if (order.tax > 0)
    lines.push({ text: twoCol(`Tax (${store.settings.taxRate}%)`, amount(order.tax), cols) })
  if (order.discount > 0) lines.push({ text: twoCol('Discount', `-${amount(order.discount)}`, cols) })
  lines.push({ text: divider(cols) })
  lines.push({ text: twoCol('TOTAL', `${amount(order.total)} DT`, cols), bold: true, size: 'double' })
  lines.push({
    text: order.paymentMethod === 'credit' ? 'ON ACCOUNT' : order.paymentMethod.toUpperCase(),
    align: 'right',
  })
  if (order.note) lines.push({ text: `Note: ${order.note}` })
  lines.push({ text: divider(cols) })
  lines.push({ text: store.settings.receiptFooter || `Thank you for your visit! · ${BRAND_NAME}`, align: 'center' })
  lines.push({ text: `Powered by ${BRAND_NAME}`, align: 'center' })
  return lines
}

/* ----------------------------- kitchen tickets ---------------------------- */

type KitchenOrder = Pick<Order, 'createdAt' | 'channel' | 'items' | 'note' | 'tableName' | 'staffName'>

const kitchenLines = (
  order: KitchenOrder,
  store: Store,
  reference: string,
  items = order.items,
): ReceiptLine[] => {
  const cols = columnsFor(store.settings.printer.width)
  const lines: ReceiptLine[] = []
  lines.push({ text: 'KITCHEN', align: 'center', bold: true, size: 'double' })
  if (order.tableName) lines.push({ text: order.tableName.toUpperCase(), align: 'center', bold: true, size: 'double' })
  lines.push({
    text: twoCol(reference, fmtTime(order.createdAt), cols),
    bold: true,
  })
  lines.push({ text: order.channel.replace('-', ' ').toUpperCase(), align: 'center', bold: true })
  lines.push({ text: divider(cols) })
  for (const item of items) {
    const quantity = item.soldByWeight
      ? `${item.qty.toFixed(3)} ${item.saleUnit ?? 'piece'}`
      : `${item.qty} x`
    lines.push({ text: `${quantity} ${stripEmoji(item.name)}${item.variantName ? ` · ${stripEmoji(item.variantName)}` : ''}`, bold: true, size: 'double' })
    for (const modifier of item.modifiers ?? []) {
      lines.push({ text: `  + ${stripEmoji(modifier.optionName)}` })
    }
    if (item.note) lines.push({ text: `  NOTE: ${stripEmoji(item.note)}`, bold: true })
  }
  lines.push({ text: divider(cols) })
  if (order.note) lines.push({ text: `NOTE: ${order.note}`, bold: true })
  lines.push({ text: `-${order.staffName}`, align: 'right' })
  return lines
}

export const buildKitchenLines = (order: Order, store: Store): ReceiptLine[] =>
  kitchenLines(order, store, `#${order.number}`)

export const buildOpenKitchenLines = (
  order: OpenOrder,
  items: OrderItem[],
  store: Store,
): ReceiptLine[] => kitchenLines(order, store, `OPEN ${order.id.slice(-6)}`, items)

/* ------------------------------ X / Z reports ----------------------------- */

export interface ReportData {
  kind: 'X' | 'Z'
  store: Store
  session: RegisterSession
  snapshot: RegisterSnapshot
  generatedAt: string
  generatedBy: string
  breakdown?: {
    byEmployee: Array<{ name: string; count: number; total: number }>
    byCategory: Array<{ name: string; qty: number; total: number }>
  }
}

const reportRows = (rows: Array<[string, string]>, cols: number): ReceiptLine[] =>
  rows.map(([label, value]) => ({ text: twoCol(label, value, cols) }))

export const buildReportLines = (data: ReportData): ReceiptLine[] => {
  const cols = columnsFor(data.store.settings.printer.width)
  const s = data.snapshot
  const lines: ReceiptLine[] = []

  lines.push({ text: `${data.kind} REPORT`, align: 'center', bold: true, size: 'double' })
  lines.push({ text: data.store.name, align: 'center' })
  lines.push({ text: `${data.store.city} · ${data.store.phone}`, align: 'center' })
  lines.push({ text: divider(cols) })
  lines.push({ text: twoCol('Session', data.session.id, cols) })
  lines.push({ text: twoCol('Opened', `${fmtDate(data.session.openedAt)} ${fmtTime(data.session.openedAt)}`, cols) })
  if (data.kind === 'Z' && data.session.closedAt) {
    lines.push({ text: twoCol('Closed', `${fmtDate(data.session.closedAt)} ${fmtTime(data.session.closedAt)}`, cols) })
    lines.push({ text: twoCol('Closed by', data.session.closedByName ?? '', cols) })
  }
  lines.push({ text: divider(cols) })
  lines.push({ text: 'SALES', bold: true })
  lines.push(
    ...reportRows(
      [
        ['Transactions', String(s.ordersCount)],
        ['Total sales', amount(s.salesTotal)],
        ['Cash sales', amount(s.cashSales)],
        ['Card sales', amount(s.cardSales)],
        ['Tab sales', amount(s.creditSales)],
        ['Discounts', amount(s.discounts)],
        ['Tax', amount(s.tax)],
        ['Service', amount(s.service)],
      ],
      cols,
    ),
  )
  lines.push({ text: divider(cols) })
  lines.push({ text: 'TABS & REFUNDS', bold: true })
  lines.push(
    ...reportRows(
      [
        ['Tab payments', `${s.settlementCount} / ${amount(s.cashSettlements + s.cardSettlements)}`],
        [`  cash`, amount(s.cashSettlements)],
        [`  card`, amount(s.cardSettlements)],
        ['Voided orders', `${s.voidedCount} / ${amount(s.voidedTotal)}`],
        ['Cash refunds', amount(s.cashRefunds)],
      ],
      cols,
    ),
  )
  lines.push({ text: divider(cols) })
  lines.push({ text: 'EXPENSES', bold: true })
  lines.push({ text: twoCol('Paid from drawer', amount(s.expenses), cols) })
  lines.push({ text: divider(cols) })
  lines.push({ text: 'CASH DRAWER', bold: true })
  lines.push(
    ...reportRows(
      [
        ['Opening cash', amount(data.session.openingCash)],
        ['Cash sales', `+${amount(s.cashSales)}`],
        ['Tab payments', `+${amount(s.cashSettlements)}`],
        ['Expenses', `-${amount(s.expenses)}`],
        ['Refunds', `-${amount(s.cashRefunds)}`],
      ],
      cols,
    ),
  )
  lines.push({ text: divider(cols) })
  if (data.kind === 'Z') {
    lines.push({ text: twoCol('Counted cash', amount(data.session.countedCash ?? 0), cols), bold: true })
    const diff = data.session.difference ?? 0
    lines.push({
      text: twoCol('Difference', `${diff >= 0 ? '+' : ''}${amount(diff)}`, cols),
      bold: true,
    })
  } else {
    lines.push({ text: twoCol('Expected cash', amount(s.expectedCash), cols), bold: true })
  }
  if (data.breakdown?.byEmployee.length) {
    lines.push({ text: divider(cols) })
    lines.push({ text: 'BY EMPLOYEE', bold: true })
    for (const e of data.breakdown.byEmployee.slice(0, 8)) {
      lines.push({ text: twoCol(`${e.name} (${e.count})`, amount(e.total), cols) })
    }
  }
  if (data.breakdown?.byCategory.length) {
    lines.push({ text: divider(cols) })
    lines.push({ text: 'BY CATEGORY', bold: true })
    for (const c of data.breakdown.byCategory.slice(0, 8)) {
      lines.push({ text: twoCol(`${c.name} (${c.qty})`, amount(c.total), cols) })
    }
  }
  lines.push({ text: divider(cols) })
  lines.push({ text: twoCol(`${data.kind} report`, fmtDateTime(data.generatedAt), cols) })
  lines.push({ text: data.generatedBy, align: 'right' })
  lines.push({ text: '' })
  lines.push({ text: `Powered by ${BRAND_NAME}`, align: 'center' })
  return lines
}

/* -------------------------------- test page ------------------------------- */

export const buildTestLines = (store: Store): ReceiptLine[] => {
  const cols = columnsFor(store.settings.printer.width)
  return [
    { text: 'PRINTER TEST', align: 'center', bold: true, size: 'double' },
    { text: store.name, align: 'center' },
    { text: divider(cols) },
    { text: twoCol('Width', `${store.settings.printer.width}mm / ${cols} cols`, cols) },
    { text: twoCol('Time', fmtDateTime(new Date().toISOString()), cols) },
    { text: divider(cols) },
    { text: 'If you can read this line and the', align: 'left' },
    { text: 'cut below happened, the printer', align: 'left' },
    { text: 'is configured correctly.', align: 'left' },
    { text: '' },
    { text: BRAND_NAME, align: 'center' },
  ]
}

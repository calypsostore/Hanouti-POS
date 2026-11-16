import type {
  OpenOrder,
  Order,
  OrderItem,
  PrinterWidth,
  RegisterReportDetails,
  RegisterItemsReport,
  RegisterSession,
  RegisterSnapshot,
  Store,
} from '../types'
import { fmtDate, fmtDateTime, fmtTime } from './utils.ts'
import { round } from './pricing-utils.ts'
import { BRAND_NAME } from './brand.ts'
import { orderNumberLabel } from './orderNumber.ts'
import { formatInventoryQuantity } from './inventory.ts'
import {
  formatRegisterItemQuantity,
  groupRegisterItemRows,
  summarizeRegisterItems,
} from './registerItems.ts'
import { encodeEscposText } from '../shared/escpos.ts'
export { linesToEscpos } from '../shared/escpos.ts'

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

export const encodeCp1252 = (text: string): Uint8Array => encodeEscposText(text, 'cp1252')

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
  lines.push({ text: twoCol(`Order #${orderNumberLabel(order, store.settings)}`, fmtDateTime(order.createdAt), cols) })
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
    text: order.paymentMethod === 'unpaid'
      ? 'RECORDED · NOT PAID'
      : order.paymentMethod === 'credit' ? 'ON ACCOUNT' : order.paymentMethod.toUpperCase(),
    align: 'right',
  })
  if (order.note) lines.push({ text: `Note: ${order.note}` })
  lines.push({ text: divider(cols) })
  lines.push({ text: store.settings.receiptFooter || `Thank you for your visit! · ${BRAND_NAME}`, align: 'center' })
  lines.push({ text: `Powered by ${BRAND_NAME}`, align: 'center' })
  return lines
}

/* ----------------------------- kitchen tickets ---------------------------- */

type KitchenOrder = Pick<Order, 'createdAt' | 'channel' | 'items' | 'note' | 'tableName' | 'sectionName' | 'guests' | 'staffName'>

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
  if (order.sectionName) lines.push({ text: `SECTION: ${order.sectionName}`, align: 'center', bold: true })
  if (order.guests !== undefined) lines.push({ text: `GUESTS: ${order.guests}`, align: 'center' })
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
  storeDay?: boolean
  store: Store
  session: RegisterSession
  snapshot: RegisterSnapshot
  details: RegisterReportDetails | null
  itemsReport: RegisterItemsReport
  itemsRebuiltFromOrders?: boolean
  reportNumber: string
  width: PrinterWidth
  generatedAt: string
  generatedBy: string
}

const reportRows = (rows: Array<[string, string]>, cols: number): ReceiptLine[] =>
  rows.map(([label, value]) => ({ text: twoCol(label, value, cols) }))

const wrapReceiptText = (text: string, width: number): string[] => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const wordLength = Array.from(word).length
    const lineLength = Array.from(line).length
    if (line && lineLength + 1 + wordLength > width) {
      lines.push(line)
      line = ''
    }
    let remaining = Array.from(word)
    while (remaining.length > width) {
      lines.push(`${remaining.splice(0, width - 1).join('')}-`)
    }
    const remainder = remaining.join('')
    line += `${line ? ' ' : ''}${remainder}`
  }
  if (line || lines.length === 0) lines.push(line)
  return lines
}

const wrapReceiptRow = (label: string, total: string, cols: number): ReceiptLine[] => {
  const firstWidth = Math.max(1, cols - Array.from(total).length - 1)
  const words = label.split(/\s+/).filter(Boolean)
  let first = ''
  while (words.length) {
    const next = words[0]
    const candidate = `${first ? `${first} ` : ''}${next}`
    if (Array.from(candidate).length > firstWidth) break
    first = candidate
    words.shift()
  }
  const lines: ReceiptLine[] = [{ text: twoCol(first, total, cols) }]
  if (words.length) {
    lines.push(...wrapReceiptText(words.join(' '), cols - 2).map((text) => ({ text: `  ${text}` })))
  }
  return lines
}

const qtyForRows = (qty: number, weighted: boolean) =>
  weighted ? qty.toFixed(3) : String(Math.round(qty))

const itemReceiptLines = (
  items: RegisterItemsReport['itemsSold'],
  title: string,
  cols: number,
  voided = false,
): ReceiptLine[] => {
  const lines: ReceiptLine[] = [
    { text: divider(cols) },
    { text: title, bold: true },
  ]
  const groups = groupRegisterItemRows(items)
  if (!groups.length) {
    lines.push({ text: 'No items' })
    lines.push({ text: '0 qty · 0 distinct', bold: true })
    if (!voided) lines.push({ text: twoCol('Section total', amount(0), cols), bold: true })
    return lines
  }
  for (const group of groups) {
    lines.push(...wrapReceiptText(group.category, cols).map((text) => ({ text, bold: true })))
    for (const item of group.items) {
      const qty = formatRegisterItemQuantity(item)
      const unit = item.soldByWeight && item.saleUnit ? ` ${item.saleUnit}` : ''
      const unitPrice = voided || item.unitPrice === null
        ? ''
        : ` @ ${amount(item.unitPrice)}${item.soldByWeight && item.saleUnit ? `/${item.saleUnit}` : ' ea'}`
      const voider = voided && 'voidedByName' in item ? ` · voided by ${item.voidedByName}` : ''
      const label = `${qty}${unit} x ${item.name}${unitPrice}${voider}`
      if (voided) {
        lines.push(...wrapReceiptText(label, cols).map((text) => ({ text })))
        continue
      }
      lines.push(...wrapReceiptRow(label, amount(item.total), cols))
    }
    if (!voided) lines.push({ text: twoCol('Category subtotal', amount(group.total), cols), bold: true })
  }
  const summary = summarizeRegisterItems([items])
  const weighted = items.some((item) => item.soldByWeight)
  lines.push({ text: `${qtyForRows(summary.qty, weighted)} qty · ${summary.distinctItems} distinct`, bold: true })
  if (!voided) lines.push({ text: twoCol('Section total', amount(summary.total), cols), bold: true })
  return lines
}

export const buildReportLines = (data: ReportData): ReceiptLine[] => {
  const cols = columnsFor(data.width)
  const s = data.snapshot
  const details = data.details
  const reportAmount = (value: number) => `${amount(value)} DT`
  const cashIn = (details?.cashReceived ?? s.cashSales) + s.cashSettlements
  const cashOut = s.expenses + s.cashRefunds
  const refunds = s.cashRefunds + (details?.storeCreditRefunds ?? 0)
  const countedCash = data.session.countedCash === undefined
    ? 'Not recorded'
    : reportAmount(data.session.countedCash)
  const cashDifference = data.session.difference === undefined
    ? 'Not recorded'
    : data.session.difference > 0
      ? `+${reportAmount(data.session.difference)}`
      : data.session.difference < 0
        ? `-${reportAmount(Math.abs(data.session.difference))}`
        : reportAmount(0)
  const lines: ReceiptLine[] = []
  const servedSummary = summarizeRegisterItems([data.itemsReport.itemsSold, data.itemsReport.recordedItems])

  lines.push({ text: details?.storeName ?? data.store.name, align: 'center', bold: true })
  const address = details?.storeAddress ?? data.store.address
  const city = details?.storeCity ?? data.store.city
  const phone = details?.storePhone ?? data.store.phone
  if (address) lines.push({ text: address, align: 'center' })
  lines.push({ text: `${city} · ${phone}`, align: 'center' })
  lines.push({ text: divider(cols) })
  lines.push({ text: `${data.kind} REPORT`, align: 'center', bold: true, size: 'double' })
  lines.push({
    text: data.kind === 'X'
      ? 'INTERIM - SESSION REMAINS OPEN'
      : data.storeDay ? 'OFFICIAL STORE-DAY CLOSE' : 'OFFICIAL SESSION CLOSE',
    align: 'center',
    bold: true,
  })
  lines.push({ text: twoCol('Report no.', data.reportNumber, cols) })
  lines.push({ text: twoCol('Printed', fmtDateTime(data.generatedAt), cols) })
  lines.push({ text: twoCol('Session ID', data.session.id, cols) })
  lines.push({ text: twoCol(data.storeDay ? 'Day-end cashier' : 'Cashier', data.session.openedByName, cols) })
  lines.push({ text: twoCol('Opened', `${fmtDate(data.session.openedAt)} ${fmtTime(data.session.openedAt)}`, cols) })
  if (data.kind === 'Z') {
    lines.push({ text: twoCol('Closed by', data.session.closedByName ?? data.generatedBy, cols) })
    if (data.session.closedAt) {
      lines.push({ text: twoCol('Closed', `${fmtDate(data.session.closedAt)} ${fmtTime(data.session.closedAt)}`, cols) })
    }
  }
  lines.push({ text: divider(cols) })
  lines.push({ text: 'SALES', bold: true })
  lines.push(
    ...reportRows(
      [
        ['Transactions', String(details?.totalTransactions ?? s.ordersCount + s.settlementCount)],
        ['Completed orders', String(details?.completedOrders ?? s.ordersCount)],
        ['Gross sales', reportAmount(details?.grossSales ?? s.salesTotal + s.discounts)],
        ['Discounts', `-${reportAmount(s.discounts)}`],
        ['Tracked refunds', `-${reportAmount(refunds)}`],
        ['Net sales', reportAmount(details?.netSales ?? s.salesTotal)],
        ['Cash', reportAmount(s.cashSales)],
        ['Card', reportAmount(s.cardSales)],
        ['Tab', reportAmount(s.creditSales)],
      ],
      cols,
    ),
  )
  lines.push({ text: divider(cols) })
  lines.push(...itemReceiptLines(data.itemsReport.itemsSold, 'ITEMS SOLD', cols))
  lines.push(...itemReceiptLines(data.itemsReport.recordedItems, 'RECORDED (NO PAYMENT)', cols))
  lines.push({ text: 'ITEMS SERVED TOTAL', bold: true })
  lines.push({
    text: `${qtyForRows(servedSummary.qty, [...data.itemsReport.itemsSold, ...data.itemsReport.recordedItems].some((item) => item.soldByWeight))} qty · ${servedSummary.distinctItems} distinct`,
    bold: true,
  })
  lines.push(...itemReceiptLines(data.itemsReport.voidedItems, 'VOIDED ITEMS', cols, true))
  if (data.itemsRebuiltFromOrders) lines.push({ text: 'Item detail rebuilt from orders' })
  lines.push({ text: divider(cols) })
  lines.push({ text: 'TAX & SERVICE', bold: true })
  if (details?.taxBreakdown.length) {
    lines.push(...reportRows(
      details.taxBreakdown.map((tax) => [
        tax.rate === null ? 'Tax · rate not recorded' : `Tax @ ${tax.rate}%`,
        reportAmount(tax.amount),
      ]),
      cols,
    ))
  } else if (!details) {
    lines.push({ text: 'Legacy tax detail not saved' })
  } else {
    lines.push({ text: twoCol('Tax', reportAmount(s.tax), cols) })
  }
  lines.push({ text: twoCol('Service charges', reportAmount(s.service), cols) })
  lines.push({ text: divider(cols) })
  lines.push({ text: 'TAB PAYMENTS', bold: true })
  lines.push({ text: twoCol(`Transactions (${s.settlementCount})`, reportAmount(s.cashSettlements + s.cardSettlements), cols) })
  lines.push({ text: twoCol('Cash collected', reportAmount(s.cashSettlements), cols) })
  lines.push({ text: twoCol('Card collected', reportAmount(s.cardSettlements), cols) })
  lines.push({ text: divider(cols) })
  lines.push({ text: 'CASH MOVEMENTS', bold: true })
  lines.push(
    ...reportRows(
      [
        [data.storeDay ? 'Staff working float' : 'Opening cash', amount(data.session.openingCash)],
        ['Cash sales received', `+${reportAmount(details?.cashReceived ?? s.cashSales)}`],
        ['Cash tab payments', `+${reportAmount(s.cashSettlements)}`],
        ['Cash in', `+${reportAmount(cashIn)}`],
        ['Expenses paid', `-${reportAmount(details?.cashExpenses ?? s.expenses)}`],
        ['Supplier cash payments', `-${reportAmount(details?.supplierCashPayments ?? 0)}`],
        ['Cash refunds', `-${reportAmount(s.cashRefunds)}`],
        ['Cash out', `-${reportAmount(cashOut)}`],
      ],
      cols,
    ),
  )
  lines.push({ text: divider(cols) })
  if (data.kind === 'Z') {
    lines.push({ text: twoCol('Expected cash', reportAmount(s.expectedCash), cols), bold: true })
    lines.push({ text: twoCol('Actual counted cash', countedCash, cols), bold: true })
    lines.push({ text: twoCol('Cash difference', cashDifference, cols), bold: true })
  } else {
    lines.push({ text: twoCol('Expected cash', reportAmount(s.expectedCash), cols), bold: true })
  }
  lines.push({ text: divider(cols) })
  lines.push({ text: 'VOIDED ORDERS', bold: true })
  lines.push({ text: twoCol('Voided count / total', `${s.voidedCount} / ${reportAmount(s.voidedTotal)}`, cols) })
  lines.push({ text: twoCol('Cash refunds', reportAmount(s.cashRefunds), cols) })
  if (!details) lines.push({ text: 'Legacy void details not saved' })
  else if (details.voidedOrders.length) {
    for (const order of details.voidedOrders) {
      lines.push({ text: twoCol(`#${order.number} ${order.paymentMethod}`, reportAmount(order.total), cols) })
      if (order.reason) lines.push({ text: `  Reason: ${order.reason}` })
      if (order.paymentMethod === 'card') lines.push({ text: '  Card refund status not recorded' })
    }
  } else {
    lines.push({ text: 'No voided orders in this session' })
  }
  lines.push({ text: divider(cols) })
  lines.push({ text: 'CANCELLED TABLE ITEMS', bold: true })
  if (!details) lines.push({ text: 'Legacy cancellation details not saved' })
  else if (details.cancelledItems.length) {
    for (const cancellation of details.cancelledItems) {
      lines.push({ text: twoCol(cancellation.tableName, reportAmount(cancellation.total), cols) })
      for (const item of cancellation.items) lines.push({ text: `  ${item}` })
      if (!cancellation.items.length) lines.push({ text: '  Item detail unavailable' })
    }
  } else {
    lines.push({ text: 'No cancelled table orders in this session' })
  }
  if (details?.byEmployee.length) {
    lines.push({ text: divider(cols) })
    lines.push({ text: 'BY EMPLOYEE', bold: true })
    for (const employee of details.byEmployee) {
      lines.push({ text: twoCol(`${employee.name} (${employee.count})`, reportAmount(employee.total), cols) })
    }
  }
  if (details?.byCategory.length) {
    lines.push({ text: divider(cols) })
    lines.push({ text: 'BY CATEGORY', bold: true })
    for (const category of details.byCategory) {
      lines.push({ text: twoCol(`${category.name} (${category.qty})`, reportAmount(category.total), cols) })
    }
  }
  if (details?.staffConsumptions?.length) {
    lines.push({ text: divider(cols) })
    lines.push({ text: 'STAFF ITEMS', bold: true })
    for (const use of details.staffConsumptions) {
      lines.push({ text: twoCol(`${use.staffName}: ${use.quantity} x ${use.itemName}`, reportAmount(use.chargedValue), cols) })
      lines.push({ text: `  Retail ${reportAmount(use.retailValue)}` })
    }
  }
  if (details?.inventoryYieldSummaries?.length) {
    lines.push({ text: divider(cols) })
    lines.push({ text: 'INVENTORY YIELD ESTIMATE', bold: true })
    for (const summary of details.inventoryYieldSummaries) {
      lines.push({ text: twoCol(`${summary.itemName} · ${summary.soldQuantity} sold`,
        `${formatInventoryQuantity(summary.expectedUseMin, summary.unit)}-${formatInventoryQuantity(summary.expectedUseMax, summary.unit)}`, cols) })
      lines.push({ text: `  Recipe use ${formatInventoryQuantity(summary.recipeUse, summary.unit)}` })
      lines.push({ text: `  Expected remainder ${formatInventoryQuantity(summary.expectedRemainingMin, summary.unit)} - ${formatInventoryQuantity(summary.expectedRemainingMax, summary.unit)}` })
      lines.push({ text: `  Tracked stock ${formatInventoryQuantity(summary.ledgerRemaining, summary.unit)}` })
    }
  }
  if (!details?.inventoryYieldSummaries?.length && details?.coffeeBeanSummary) {
    const beans = details.coffeeBeanSummary
    lines.push({ text: divider(cols) })
    lines.push({ text: 'COFFEE BEAN ESTIMATE', bold: true })
    lines.push({ text: twoCol(`${beans.itemName} · servings sold`, String(beans.servingsSold), cols) })
    lines.push({ text: twoCol('Expected bean use', `${beans.expectedUseMin}-${beans.expectedUseMax} ${beans.unit}`, cols) })
    lines.push({ text: twoCol('Recipe-based bean use', `${beans.recipeUse} ${beans.unit}`, cols) })
    if (beans.expectedRemainingMin !== undefined && beans.expectedRemainingMax !== undefined) {
      lines.push({ text: twoCol('Expected remainder', `${beans.expectedRemainingMin}-${beans.expectedRemainingMax} ${beans.unit}`, cols) })
    }
    if (beans.ledgerRemaining !== undefined) {
      lines.push({ text: twoCol('Tracked stock remainder', `${beans.ledgerRemaining} ${beans.unit}`, cols) })
    }
  }
  if (data.kind === 'Z') {
    lines.push({ text: divider(cols) })
    lines.push({ text: 'FINAL CLOSING SUMMARY', bold: true })
    lines.push({ text: twoCol('Sales net of discounts', reportAmount(details?.netSales ?? s.salesTotal), cols) })
    lines.push({ text: twoCol('Expected cash', reportAmount(s.expectedCash), cols) })
    lines.push({ text: twoCol('Counted cash', countedCash, cols) })
    lines.push({ text: twoCol('Cash difference', cashDifference, cols) })
    if (data.session.note) lines.push({ text: `Note: ${data.session.note}` })
  }
  lines.push({ text: divider(cols) })
  lines.push({ text: twoCol('Report generated', fmtDateTime(data.generatedAt), cols) })
  lines.push({ text: twoCol('Generated by', data.generatedBy, cols) })
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

import type { InventoryItem, Purchase, PurchaseLine, StockMovement, Supplier } from '../types'
import { calculatePurchaseLine, calculatePurchaseSubtotal } from '../lib/purchases'
import { roundCost, roundQuantity, weightedAverageCost } from '../lib/inventory'
import { round } from '../lib/pricing-utils'
import { dateKey, uid } from '../lib/utils'
import type { PurchaseInput, PurchaseLineInput } from './types'

export type PreparedLine = PurchaseLine & { unitCostPerBaseUnit: number }
export type PreparedPurchase = {
  supplier: Supplier
  lines: PreparedLine[]
  subtotal: number
  invoiceNumber: string
}

const isDate = (value: string) => {
  const date = new Date(`${value}T12:00:00`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && dateKey(date) === value
}

const isReceiptImage = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 700_000 &&
  /^data:image\/(?:jpeg|png|webp);base64,/.test(value)

export function preparePurchase(
  storeId: string,
  data: PurchaseInput,
  suppliers: Supplier[],
  inventoryItems: InventoryItem[],
  purchases: Purchase[],
  excludingId?: string,
): PreparedPurchase | { error: string } {
  if (!data || typeof data !== 'object') return { error: 'Enter valid purchase details.' }
  const supplier = suppliers.find((item) =>
    item.id === data.supplierId && item.storeId === storeId && item.active,
  )
  if (!supplier) return { error: 'Choose an active supplier from this store.' }
  if (typeof data.receivedAt !== 'string' || !isDate(data.receivedAt)) {
    return { error: 'Choose a valid purchase date.' }
  }
  const invoiceNumber = typeof data.invoiceNumber === 'string' ? data.invoiceNumber.trim().slice(0, 100) : ''
  if (data.invoiceNumber !== undefined && typeof data.invoiceNumber !== 'string') {
    return { error: 'Enter a valid invoice number.' }
  }
  if (invoiceNumber && purchases.some((purchase) =>
    purchase.id !== excludingId && purchase.storeId === storeId &&
    purchase.supplierId === supplier.id && purchase.invoiceNumber.toLowerCase() === invoiceNumber.toLowerCase() &&
    purchase.status === 'received',
  )) return { error: 'That invoice number is already recorded for this supplier.' }
  if (!Array.isArray(data.lines) || data.lines.length < 1 || data.lines.length > 50) {
    return { error: 'Add between 1 and 50 purchase lines.' }
  }
  if (typeof data.note !== 'string') return { error: 'Enter a valid note.' }
  if (data.receiptImage !== undefined && !isReceiptImage(data.receiptImage)) {
    return { error: 'Choose a JPEG, PNG, or WebP receipt image under 500 KB.' }
  }
  const lines: PreparedLine[] = []
  for (const draft of data.lines as PurchaseLineInput[]) {
    if (!draft || typeof draft.inventoryItemId !== 'string' || typeof draft.packageId !== 'string' ||
      !Number.isFinite(draft.packageCount) || draft.packageCount <= 0 ||
      draft.packageCount > 100_000 || !Number.isFinite(draft.unitCost) ||
      draft.unitCost < 0 || draft.unitCost > 1_000_000) {
      return { error: 'Enter valid package quantities and unit costs.' }
    }
    const item = inventoryItems.find((candidate) =>
      candidate.id === draft.inventoryItemId && candidate.storeId === storeId && candidate.active,
    )
    const pkg = item?.packages.find((candidate) => candidate.id === draft.packageId)
    if (!item || !pkg || pkg.baseQtyPerPackage <= 0) {
      return { error: 'A purchase line refers to an inactive or unavailable inventory package.' }
    }
    const amount = calculatePurchaseLine(draft.packageCount, pkg.baseQtyPerPackage, draft.unitCost)
    lines.push({
      id: uid('pline'),
      inventoryItemId: item.id,
      itemName: item.name,
      packageId: pkg.id,
      packageLabel: pkg.label,
      packageCount: roundQuantity(draft.packageCount),
      baseQuantity: amount.baseQuantity,
      unitCost: round(draft.unitCost),
      lineTotal: amount.lineTotal,
      unitCostPerBaseUnit: amount.unitCostPerBaseUnit,
    })
  }
  return {
    supplier,
    lines,
    subtotal: calculatePurchaseSubtotal(lines.map((line) => line.lineTotal)),
    invoiceNumber,
  }
}

export function applyPurchaseLines(items: InventoryItem[], lines: PreparedLine[]) {
  const updated = new Map(items.map((item) => [item.id, item]))
  for (const line of lines) {
    const item = updated.get(line.inventoryItemId)
    if (!item) return { ok: false as const, error: 'An inventory item no longer exists.' }
    updated.set(item.id, {
      ...item,
      onHand: roundQuantity(item.onHand + line.baseQuantity),
      avgCostPerBaseUnit: weightedAverageCost(
        item.onHand,
        item.avgCostPerBaseUnit,
        line.baseQuantity,
        line.unitCostPerBaseUnit,
      ),
      lastCostPerBaseUnit: roundCost(line.unitCostPerBaseUnit),
    })
  }
  return { ok: true as const, items: Array.from(updated.values()) }
}

export function reversePurchaseLines(
  items: InventoryItem[],
  purchase: Purchase,
  movements: StockMovement[],
  actor: { id: string; name: string },
  reason: string,
) {
  if (movements.some((movement) =>
    movement.storeId === purchase.storeId &&
    purchase.lines.some((line) => line.inventoryItemId === movement.itemId) &&
    movement.createdAt >= purchase.createdAt && movement.refId !== purchase.id,
  )) return { ok: false as const, error: 'This purchase has later stock activity and can no longer be edited or voided safely.' }
  const totals = new Map<string, { quantity: number; value: number }>()
  for (const line of purchase.lines) {
    const total = totals.get(line.inventoryItemId) ?? { quantity: 0, value: 0 }
    total.quantity = roundQuantity(total.quantity + line.baseQuantity)
    total.value = roundCost(total.value + line.lineTotal)
    totals.set(line.inventoryItemId, total)
  }
  const updated = new Map(items.map((item) => [item.id, item]))
  const reversalMovements: StockMovement[] = []
  for (const [itemId, total] of totals) {
    const item = updated.get(itemId)
    if (!item || item.onHand + 0.000001 < total.quantity) {
      return { ok: false as const, error: `Not enough ${item?.name ?? 'inventory'} remains to reverse this purchase.` }
    }
    const onHand = roundQuantity(item.onHand - total.quantity)
    const valueWithoutPurchase = item.onHand * item.avgCostPerBaseUnit - total.value
    const average = onHand > 0 ? roundCost(Math.max(0, valueWithoutPurchase) / onHand) : 0
    updated.set(itemId, { ...item, onHand, avgCostPerBaseUnit: average })
    reversalMovements.push({
      id: uid('mov'),
      storeId: item.storeId,
      itemId,
      type: 'adjustment',
      qtyDelta: -total.quantity,
      unitCostSnapshot: roundCost(total.value / total.quantity),
      reason,
      userId: actor.id,
      userName: actor.name,
      refType: 'purchase',
      refId: purchase.id,
      createdAt: new Date().toISOString(),
    })
  }
  return { ok: true as const, items: Array.from(updated.values()), movements: reversalMovements }
}

export const purchaseSnapshot = (purchase: Purchase) => ({
  supplier: purchase.supplierName,
  invoiceNumber: purchase.invoiceNumber,
  receivedAt: purchase.receivedAt,
  subtotal: purchase.subtotal,
  paidAmount: purchase.paidAmount,
  status: purchase.status,
  lines: purchase.lines.length,
})

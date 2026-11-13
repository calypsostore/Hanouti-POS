import { round } from './pricing-utils'
import { roundCost, roundQuantity } from './inventory'

export interface PurchaseLineAmounts {
  baseQuantity: number
  unitCostPerBaseUnit: number
  lineTotal: number
}

export function calculatePurchaseLine(
  packageCount: number,
  baseQtyPerPackage: number,
  packageCost: number,
): PurchaseLineAmounts {
  return {
    baseQuantity: roundQuantity(packageCount * baseQtyPerPackage),
    unitCostPerBaseUnit: baseQtyPerPackage > 0
      ? roundCost(packageCost / baseQtyPerPackage)
      : 0,
    lineTotal: round(packageCount * packageCost),
  }
}

export const calculatePurchaseSubtotal = (lineTotals: number[]) =>
  round(lineTotals.reduce((total, amount) => total + amount, 0))

export const purchaseBalance = (subtotal: number, paidAmount: number) =>
  round(Math.max(0, subtotal - paidAmount))

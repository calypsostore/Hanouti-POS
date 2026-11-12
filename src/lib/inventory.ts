import type { InventoryUnit } from '../types'

export const roundCost = (value: number): number => Math.round(value * 1_000_000) / 1_000_000

export const roundQuantity = (value: number): number => Math.round(value * 1_000_000) / 1_000_000

export function weightedAverageCost(
  onHand: number,
  averageCost: number,
  addedQty: number,
  addedUnitCost: number,
): number {
  const totalQty = onHand + addedQty
  if (totalQty <= 0) return roundCost(addedUnitCost)
  return roundCost((onHand * averageCost + addedQty * addedUnitCost) / totalQty)
}
const quantityText = (value: number) => Number(value.toFixed(3)).toString()

export function formatInventoryQuantity(quantity: number, unit: InventoryUnit): string {
  if (unit === 'piece') return `${quantityText(quantity)} ${quantity === 1 ? 'piece' : 'pieces'}`
  if (unit === 'g' && Math.abs(quantity) >= 1000) return `${quantityText(quantity / 1000)} kg`
  if (unit === 'ml' && Math.abs(quantity) >= 1000) return `${quantityText(quantity / 1000)} L`
  return `${quantityText(quantity)} ${unit}`
}

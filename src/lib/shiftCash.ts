import { round } from './pricing-utils.ts'
import type { CashDifference, OpenOrder } from '../types'

export const expectedShiftCash = (
  openingFloat: number,
  cashSales: number,
  cashTabPayments: number,
  cashRefunds: number,
  cashExpenses: number,
) => round(openingFloat + cashSales + cashTabPayments - cashRefunds - cashExpenses)

export const shiftCashDifference = (countedCash: number, expectedCash: number) =>
  round(countedCash - expectedCash)

export const isCashDifferenceWithinTolerance = (difference: number, tolerance: number) =>
  Math.abs(round(difference)) <= Math.max(0, round(tolerance))

export const orderPaidBy = (order: { paidById?: string; staffId: string }) =>
  order.paidById ?? order.staffId

export const handoverOpenOrder = (
  order: OpenOrder,
  target: { id: string; name: string } | undefined,
  actor: { id: string; name: string },
  at: string,
): OpenOrder => ({
  ...order,
  staffId: target?.id ?? 'unassigned-handover',
  staffName: target?.name ?? 'Unassigned (handover)',
  updatedAt: at,
  tableHistory: [
    ...(order.tableHistory ?? []),
    {
      id: `${order.id}-handover-${Date.parse(at)}`,
      type: 'transferred',
      actorId: actor.id,
      actorName: actor.name,
      at,
      details: `Handover to ${target?.name ?? 'Unassigned (handover)'}`,
    },
  ],
})

export const openCashDifferenceBalance = (differences: CashDifference[], staffId: string) =>
  round(differences
    .filter((difference) => difference.staffId === staffId && difference.status === 'open')
    .reduce((total, difference) => total + difference.amount, 0))

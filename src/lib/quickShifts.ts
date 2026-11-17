import { round } from './pricing-utils.ts'
import type { CashDifferenceCorrection, QuickShiftDayEntry } from '../types'

export interface QuickShiftClose {
  declaredSales: number
  difference: number
}

export interface QuickDayShiftInput {
  shiftId: string
  staffId: string
  staffName: string
  openedAt: string
  closedAt?: string
  openingFloat: number
  countedCash?: number
  declaredSales?: number
  expectedSales?: number
  difference?: number
  correctionEntries?: CashDifferenceCorrection[]
  note?: string
  forceClosed?: boolean
}

export interface QuickDayClose {
  shifts: QuickShiftDayEntry[]
  declaredSales: number
  retainedFloat: number
  expectedCash: number
  countedCash: number
  difference: number
  staffDifferences: Array<{ staffId: string; staffName: string; amount: number }>
}

export function calculateQuickShiftClose(
  openingFloat: number,
  countedCash: number,
  expectedSales?: number,
): QuickShiftClose {
  const declaredSales = round(countedCash - openingFloat)
  return {
    declaredSales,
    difference: expectedSales === undefined
      ? 0
      : round(declaredSales - expectedSales),
  }
}

export function calculateQuickDayClose(
  shifts: QuickDayShiftInput[],
  retainedFloat: number,
  countedCash: number,
): QuickDayClose {
  const entries = shifts.map((shift): QuickShiftDayEntry => ({
    shiftId: shift.shiftId,
    staffId: shift.staffId,
    staffName: shift.staffName,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    openingFloat: round(shift.openingFloat),
    countedCash: shift.countedCash === undefined ? undefined : round(shift.countedCash),
    declaredSales: round(
      shift.declaredSales ??
      (shift.countedCash === undefined ? 0 : shift.countedCash - shift.openingFloat),
    ),
    expectedSales: shift.expectedSales === undefined ? undefined : round(shift.expectedSales),
    difference: round(shift.difference ?? 0),
    correctionEntries: shift.correctionEntries ?? [],
    note: shift.note,
    forceClosed: shift.forceClosed === true,
  }))
  const declaredSales = round(entries.reduce((total, shift) => total + shift.declaredSales, 0))
  const expectedCash = round(declaredSales + retainedFloat)
  const staffTotals = new Map<string, { staffId: string; staffName: string; amount: number }>()
  for (const shift of entries) {
    const current = staffTotals.get(shift.staffId) ?? {
      staffId: shift.staffId,
      staffName: shift.staffName,
      amount: 0,
    }
    current.amount = round(current.amount + shift.difference)
    staffTotals.set(shift.staffId, current)
  }
  return {
    shifts: entries,
    declaredSales,
    retainedFloat: round(retainedFloat),
    expectedCash,
    countedCash: round(countedCash),
    difference: round(countedCash - expectedCash),
    staffDifferences: [...staffTotals.values()],
  }
}

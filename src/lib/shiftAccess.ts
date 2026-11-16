import type { Shift, StoreSettings } from '../types.js'

export type ShiftAccessSettings = StoreSettings['shiftAccess']

export const DEFAULT_SHIFT_ACCESS_SETTINGS: ShiftAccessSettings = {
  requireOpenShiftForStoreAccess: true,
  enforceScheduleForShiftOpen: false,
  allowUnscheduledShiftOpen: true,
  restrictLoginToSchedule: false,
  earlyOpenMinutes: 15,
  lateOpenMinutes: 15,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const boundedMinutes = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 180
    ? value
    : fallback

export function normalizeShiftAccessSettings(value: unknown): ShiftAccessSettings {
  const settings = isRecord(value) ? value : {}
  return {
    requireOpenShiftForStoreAccess: typeof settings.requireOpenShiftForStoreAccess === 'boolean'
      ? settings.requireOpenShiftForStoreAccess
      : DEFAULT_SHIFT_ACCESS_SETTINGS.requireOpenShiftForStoreAccess,
    enforceScheduleForShiftOpen: typeof settings.enforceScheduleForShiftOpen === 'boolean'
      ? settings.enforceScheduleForShiftOpen
      : DEFAULT_SHIFT_ACCESS_SETTINGS.enforceScheduleForShiftOpen,
    allowUnscheduledShiftOpen: typeof settings.allowUnscheduledShiftOpen === 'boolean'
      ? settings.allowUnscheduledShiftOpen
      : DEFAULT_SHIFT_ACCESS_SETTINGS.allowUnscheduledShiftOpen,
    restrictLoginToSchedule: typeof settings.restrictLoginToSchedule === 'boolean'
      ? settings.restrictLoginToSchedule
      : DEFAULT_SHIFT_ACCESS_SETTINGS.restrictLoginToSchedule,
    earlyOpenMinutes: boundedMinutes(settings.earlyOpenMinutes, DEFAULT_SHIFT_ACCESS_SETTINGS.earlyOpenMinutes),
    lateOpenMinutes: boundedMinutes(settings.lateOpenMinutes, DEFAULT_SHIFT_ACCESS_SETTINGS.lateOpenMinutes),
  }
}

export function validShiftAccessSettings(value: unknown): value is ShiftAccessSettings {
  if (!isRecord(value)) return false
  const isMinuteValue = (candidate: unknown) =>
    typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 && candidate <= 180
  return typeof value.requireOpenShiftForStoreAccess === 'boolean' &&
    typeof value.enforceScheduleForShiftOpen === 'boolean' &&
    typeof value.allowUnscheduledShiftOpen === 'boolean' &&
    typeof value.restrictLoginToSchedule === 'boolean' &&
    isMinuteValue(value.earlyOpenMinutes) &&
    isMinuteValue(value.lateOpenMinutes)
}

const minuteOfDay = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const todayShifts = (shifts: Shift[], storeId: string, userId: string, now: Date) =>
  shifts.filter((shift) =>
    shift.storeId === storeId && shift.userId === userId && shift.date === dateKey(now),
  )

export function shiftOpenScheduleError(
  settings: ShiftAccessSettings,
  shifts: Shift[],
  storeId: string,
  userId: string,
  now: Date,
): string | undefined {
  if (!settings.enforceScheduleForShiftOpen) return undefined

  const todaysShifts = todayShifts(shifts, storeId, userId, now)
  if (!todaysShifts.length) {
    return settings.allowUnscheduledShiftOpen
      ? undefined
      : 'You do not have a shift scheduled for today. Ask the owner or manager to schedule one.'
  }

  const currentMinute = now.getHours() * 60 + now.getMinutes()
  const withinWindow = todaysShifts.some((shift) => {
    const startMinute = minuteOfDay(shift.startTime)
    return currentMinute >= startMinute - settings.earlyOpenMinutes &&
      currentMinute <= startMinute + settings.lateOpenMinutes
  })
  return withinWindow
    ? undefined
    : 'You can only open your shift near its scheduled start time. Ask the owner or manager if your schedule needs to change.'
}

export function loginScheduleError(
  settings: ShiftAccessSettings,
  shifts: Shift[],
  storeId: string,
  userId: string,
  now: Date,
  hasOpenShift: boolean,
): string | undefined {
  if (!settings.restrictLoginToSchedule || hasOpenShift) return undefined

  const currentMinute = now.getHours() * 60 + now.getMinutes()
  const isScheduledNow = todayShifts(shifts, storeId, userId, now).some((shift) =>
    currentMinute >= minuteOfDay(shift.startTime) - settings.earlyOpenMinutes &&
    currentMinute < minuteOfDay(shift.endTime),
  )
  return isScheduledNow ? undefined : 'You can only sign in during your scheduled work hours.'
}

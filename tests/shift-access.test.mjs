import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SHIFT_ACCESS_SETTINGS,
  loginScheduleError,
  shiftOpenScheduleError,
} from '../src/lib/shiftAccess.ts'

const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const shiftFor = (now, overrides = {}) => ({
  id: 'scheduled-shift',
  storeId: 'store-one',
  userId: 'staff-one',
  date: dateKey(now),
  startTime: '09:00',
  endTime: '17:00',
  ...overrides,
})

const scheduledSettings = {
  ...DEFAULT_SHIFT_ACCESS_SETTINGS,
  enforceScheduleForShiftOpen: true,
  allowUnscheduledShiftOpen: false,
}

test('shift opening follows unscheduled policy and only matches the staff member schedule', () => {
  const now = new Date(2026, 10, 16, 9, 0)
  assert.match(
    shiftOpenScheduleError(scheduledSettings, [], 'store-one', 'staff-one', now),
    /shift scheduled for today/i,
  )
  assert.equal(shiftOpenScheduleError(
    { ...scheduledSettings, allowUnscheduledShiftOpen: true },
    [],
    'store-one',
    'staff-one',
    now,
  ), undefined)
  assert.match(
    shiftOpenScheduleError(
      scheduledSettings,
      [shiftFor(now, { userId: 'another-staff' })],
      'store-one',
      'staff-one',
      now,
    ),
    /shift scheduled for today/i,
  )
})

test('shift opening accepts configured early/late boundaries and rejects times outside them', () => {
  const shifts = [shiftFor(new Date(2026, 10, 16, 9, 0))]
  const settings = { ...scheduledSettings, earlyOpenMinutes: 15, lateOpenMinutes: 15 }
  for (const [hour, minute] of [[8, 45], [9, 0], [9, 15]]) {
    assert.equal(
      shiftOpenScheduleError(settings, shifts, 'store-one', 'staff-one', new Date(2026, 10, 16, hour, minute)),
      undefined,
    )
  }
  for (const [hour, minute] of [[8, 44], [9, 16]]) {
    assert.match(
      shiftOpenScheduleError(settings, shifts, 'store-one', 'staff-one', new Date(2026, 10, 16, hour, minute)),
      /near its scheduled start time/i,
    )
  }
})

test('login restrictions use scheduled work hours but never block an already-open shift', () => {
  const start = new Date(2026, 10, 16, 8, 45)
  const shift = shiftFor(start)
  const settings = {
    ...scheduledSettings,
    restrictLoginToSchedule: true,
    earlyOpenMinutes: 15,
  }
  assert.equal(loginScheduleError(settings, [shift], 'store-one', 'staff-one', start, false), undefined)
  assert.match(
    loginScheduleError(settings, [shift], 'store-one', 'staff-one', new Date(2026, 10, 16, 17, 0), false),
    /scheduled work hours/i,
  )
  assert.equal(loginScheduleError(settings, [], 'store-one', 'staff-one', new Date(2026, 10, 16, 22, 0), true), undefined)
  assert.equal(loginScheduleError(
    { ...settings, restrictLoginToSchedule: false },
    [],
    'store-one',
    'staff-one',
    new Date(2026, 10, 16, 22, 0),
    false,
  ), undefined)
})

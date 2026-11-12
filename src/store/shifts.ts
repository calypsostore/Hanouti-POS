import { useCallback } from 'react'
import type { AuditJsonValue, Shift } from '../types'
import { dateKey, uid } from '../lib/utils'
import { addLog } from './audit'
import type { AppContextValue, ShiftInput } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) && dateKey(date) === value
}

const isValidTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)

const shiftSnapshot = (shift: Shift): Record<string, AuditJsonValue> => ({
  userId: shift.userId,
  date: shift.date,
  startTime: shift.startTime,
  endTime: shift.endTime,
  note: shift.note ?? '',
})

const authorizeManager = (storeId: string, requireActor: StoreSliceDependencies['requireActor']) => {
  const result = requireActor(storeId)
  if (!result.ok) return result
  if (result.actor.role !== 'admin' &&
      !(result.actor.role === 'staff' && result.actor.permissions.supervisor)) {
    return { ok: false as const, error: 'Only a store admin or shift manager can manage schedules.' }
  }
  return result
}

const validateShift = (input: ShiftInput) => {
  if (!isValidDate(input.date)) return 'Choose a valid shift date.'
  if (!isValidTime(input.startTime) || !isValidTime(input.endTime) || input.endTime <= input.startTime) {
    return 'Enter a valid start and end time; the end must be after the start.'
  }
  if (input.note !== undefined && typeof input.note !== 'string') return 'Enter a valid shift note.'
  return null
}

const overlaps = (a: Pick<Shift, 'date' | 'startTime' | 'endTime'>, b: Pick<Shift, 'date' | 'startTime' | 'endTime'>) =>
  a.date === b.date && a.startTime < b.endTime && a.endTime > b.startTime

export function useShiftsSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireActor } = dependencies
  const addShift = useCallback<AppContextValue['addShift']>((storeId, userId, data) => {
    const actorResult = authorizeManager(storeId, requireActor)
    if (!actorResult.ok) return actorResult
    const staff = dbRef.current.users.find((candidate) =>
      candidate.id === userId && candidate.storeId === storeId && candidate.role === 'staff',
    )
    if (!staff) return { ok: false, error: 'Choose a staff member from this store.' }
    const validationError = validateShift(data)
    if (validationError) return { ok: false, error: validationError }
    const candidate: Shift = {
      ...data,
      note: data.note?.trim().slice(0, 500) || undefined,
      id: uid('shift'),
      storeId,
      userId: staff.id,
      createdBy: actorResult.actor.id,
      createdAt: new Date().toISOString(),
    }
    if (dbRef.current.shifts.some((shift) => shift.storeId === storeId && shift.userId === staff.id && overlaps(shift, candidate))) {
      return { ok: false, error: 'This shift overlaps another planned shift for this staff member.' }
    }
    commitDb((prev) => addLog({
      ...prev,
      shifts: [candidate, ...prev.shifts],
    }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'shift',
      entityId: candidate.id,
      summary: `Scheduled ${staff.name} on ${candidate.date} from ${candidate.startTime} to ${candidate.endTime}`,
      after: shiftSnapshot(candidate),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const updateShift = useCallback<AppContextValue['updateShift']>((id, patch) => {
    const current = dbRef.current
    const shift = current.shifts.find((candidate) => candidate.id === id)
    if (!shift) return { ok: false, error: 'Shift not found.' }
    const actorResult = authorizeManager(shift.storeId, requireActor)
    if (!actorResult.ok) return actorResult
    const staff = current.users.find((candidate) =>
      candidate.id === shift.userId && candidate.storeId === shift.storeId && candidate.role === 'staff',
    )
    if (!staff) return { ok: false, error: 'The shift’s staff member is no longer in this store.' }
    const updated: Shift = {
      ...shift,
      ...patch,
      note: patch.note === undefined ? shift.note : patch.note.trim().slice(0, 500) || undefined,
    }
    const validationError = validateShift(updated)
    if (validationError) return { ok: false, error: validationError }
    if (current.shifts.some((other) =>
      other.id !== shift.id && other.storeId === shift.storeId && other.userId === shift.userId && overlaps(other, updated),
    )) return { ok: false, error: 'This shift overlaps another planned shift for this staff member.' }
    commitDb((prev) => addLog({
      ...prev,
      shifts: prev.shifts.map((candidate) => candidate.id === shift.id ? updated : candidate),
    }, actorResult.actor, {
      storeId: shift.storeId,
      action: 'edited',
      entity: 'shift',
      entityId: shift.id,
      summary: `Updated ${staff.name}’s shift on ${updated.date}`,
      before: shiftSnapshot(shift),
      after: shiftSnapshot(updated),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const deleteShift = useCallback<AppContextValue['deleteShift']>((id) => {
    const shift = dbRef.current.shifts.find((candidate) => candidate.id === id)
    if (!shift) return { ok: false, error: 'Shift not found.' }
    const actorResult = authorizeManager(shift.storeId, requireActor)
    if (!actorResult.ok) return actorResult
    const staff = dbRef.current.users.find((candidate) => candidate.id === shift.userId)
    if (!staff || staff.storeId !== shift.storeId || staff.role !== 'staff') {
      return { ok: false, error: 'The shift’s staff member is no longer in this store.' }
    }
    commitDb((prev) => addLog({
      ...prev,
      shifts: prev.shifts.filter((candidate) => candidate.id !== shift.id),
    }, actorResult.actor, {
      storeId: shift.storeId,
      action: 'deleted',
      entity: 'shift',
      entityId: shift.id,
      summary: `Removed ${staff.name}’s shift on ${shift.date}`,
      before: shiftSnapshot(shift),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  return { addShift, updateShift, deleteShift }
}

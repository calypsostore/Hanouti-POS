import type { Database, RegisterSession, User } from '../types'
import { uid } from './utils.ts'

export const openShiftForStaff = (
  db: Pick<Database, 'registerSessions'>,
  storeId: string,
  staffId: string,
): RegisterSession | undefined =>
  db.registerSessions.find((session) =>
    session.storeId === storeId &&
    session.status === 'open' &&
    (session.staffId ?? session.openedById) === staffId,
  )

export const ensureShiftForActor = (
  db: Pick<Database, 'registerSessions'>,
  storeId: string,
  actor: Pick<User, 'id' | 'name' | 'role'>,
): { shift: RegisterSession | undefined; autoOpened: boolean } => {
  const existing = openShiftForStaff(db, storeId, actor.id)
  if (existing || (actor.role !== 'admin' && actor.role !== 'manager')) {
    return { shift: existing, autoOpened: false }
  }
  const openedAt = new Date().toISOString()
  return {
    shift: {
      id: uid('reg'),
      storeId,
      status: 'open',
      openedAt,
      openedById: actor.id,
      openedByName: actor.name,
      staffId: actor.id,
      shiftNumber: nextShiftNumber(db.registerSessions, storeId),
      openingCash: 0,
      autoOpened: true,
    },
    autoOpened: true,
  }
}

export const nextShiftNumber = (
  sessions: RegisterSession[],
  storeId: string,
): string => {
  const next = sessions
    .filter((session) => session.storeId === storeId)
    .reduce((max, session) => {
      const number = Number(session.shiftNumber?.slice(2))
      return Number.isSafeInteger(number) ? Math.max(max, number) : max
    }, 0) + 1
  return `S-${String(next).padStart(6, '0')}`
}

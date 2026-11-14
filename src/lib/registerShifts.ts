import type { Database, RegisterSession } from '../types'

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

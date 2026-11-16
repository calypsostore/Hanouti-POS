import { ensureShiftForActor } from '../lib/registerShifts.ts'
import type { Database, User } from '../types'
import { addLog } from './audit.ts'

export const withEnsuredShift = (
  db: Database,
  ensured: ReturnType<typeof ensureShiftForActor>,
  actor: Pick<User, 'id' | 'name' | 'role'>,
  storeId: string,
): Database => {
  if (!ensured.autoOpened || !ensured.shift ||
    db.registerSessions.some((session) => session.id === ensured.shift?.id)) return db
  const withSession = { ...db, registerSessions: [...db.registerSessions, ensured.shift] }
  return addLog(withSession, actor, {
    storeId,
    action: 'register_opened',
    entity: 'register',
    entityId: ensured.shift.id,
    summary: `Shift auto-opened for ${actor.name}`,
    after: { shiftNumber: ensured.shift.shiftNumber ?? '', autoOpened: true },
  })
}

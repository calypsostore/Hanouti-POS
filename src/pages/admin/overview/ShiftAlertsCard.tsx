import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui'
import type { Database, Store } from '../../../types'

export default function ShiftAlertsCard({ db, store, now }: {
  db: Database
  store: Store
  now: Date
}) {
  const maximumHours = store.settings.automation.maxShiftHours
  const oldShifts = db.registerSessions.filter((session) =>
    session.storeId === store.id && session.status === 'open' &&
    now.getTime() - Date.parse(session.openedAt) > maximumHours * 3_600_000,
  )
  const openDifferences = db.cashDifferences.filter((difference) =>
    difference.storeId === store.id && difference.status === 'open',
  )
  const deniedAccess = db.auditLogs
    .filter((entry) => entry.storeId === store.id && entry.action === 'shift_access_denied')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
  if (oldShifts.length === 0 && openDifferences.length === 0 && deniedAccess.length === 0) return null
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold text-ink">Shift alerts</h3>
      <div className="mt-2 space-y-2 text-xs">
        {oldShifts.length > 0 && <p>{oldShifts.length} shift{oldShifts.length === 1 ? '' : 's'} open longer than {maximumHours} hours.</p>}
        {openDifferences.length > 0 && <p>{openDifferences.length} open cash difference{openDifferences.length === 1 ? '' : 's'} need resolution.</p>}
        {deniedAccess.length > 0 && (
          <div role="alert" className="space-y-1 rounded-lg bg-amber-50 p-2 text-amber-950">
            <p className="font-semibold">{deniedAccess.length} recent staff sign-in or shift-opening attempt{deniedAccess.length === 1 ? '' : 's'} blocked.</p>
            {deniedAccess.map((entry) => (
              <p key={entry.id}>
                {entry.userName} · {entry.summary} · {new Date(entry.createdAt).toLocaleString()}
              </p>
            ))}
          </div>
        )}
      </div>
      <Link to="/admin/register" className="mt-3 inline-block text-xs font-bold text-brand-700">Review register shifts</Link>
    </Card>
  )
}

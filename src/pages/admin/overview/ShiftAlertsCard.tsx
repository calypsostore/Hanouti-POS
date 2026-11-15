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
  if (oldShifts.length === 0 && openDifferences.length === 0) return null
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold text-ink">Shift alerts</h3>
      <div className="mt-2 space-y-2 text-xs">
        {oldShifts.length > 0 && <p>{oldShifts.length} shift{oldShifts.length === 1 ? '' : 's'} open longer than {maximumHours} hours.</p>}
        {openDifferences.length > 0 && <p>{openDifferences.length} open cash difference{openDifferences.length === 1 ? '' : 's'} need resolution.</p>}
      </div>
      <Link to="/admin/register" className="mt-3 inline-block text-xs font-bold text-brand-700">Review register shifts</Link>
    </Card>
  )
}

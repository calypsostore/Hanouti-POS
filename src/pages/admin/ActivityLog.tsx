import { useMemo } from 'react'
import { createAuditIdLabels } from '../../lib/auditFormat'
import { useApp } from '../../store/AppStore'
import ActivityLogTable from './activity/ActivityLogTable'

export default function ActivityLog() {
  const { db, store } = useApp()
  const logs = useMemo(
    () => db.auditLogs.filter((log) => log.storeId === store?.id),
    [db.auditLogs, store?.id],
  )
  const staffIds = useMemo(
    () => db.users.filter((user) => user.storeId === store?.id && user.role === 'staff').map((user) => user.id),
    [db.users, store?.id],
  )
  const idLabels = useMemo(() => createAuditIdLabels(db), [db])
  if (!store) return null
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[20px] font-extrabold tracking-tight">Activity log</h2>
        <p className="mt-1 text-[13px] text-muted">
          Append-only record of changes and sign-in activity for {store.name}.
        </p>
      </div>
      <ActivityLogTable logs={logs} storeSlug={store.slug} staffIds={staffIds} idLabels={idLabels} />
    </div>
  )
}

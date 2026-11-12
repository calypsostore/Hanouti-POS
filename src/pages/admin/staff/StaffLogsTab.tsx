import { useMemo } from 'react'
import { createAuditIdLabels, type AuditIdLabels } from '../../../lib/auditFormat'
import type { AuditLog, Database } from '../../../types'
import ActivityLogTable from '../activity/ActivityLogTable'

export default function StaffLogsTab({
  logs,
  storeSlug,
  staffIds,
  db,
}: {
  logs: AuditLog[]
  storeSlug: string
  staffIds: string[]
  db: Database
}) {
  const idLabels = useMemo<AuditIdLabels>(() => createAuditIdLabels(db), [db])
  return <ActivityLogTable logs={logs} storeSlug={storeSlug} staffIds={staffIds} idLabels={idLabels} />
}

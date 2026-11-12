import { Clock3 } from 'lucide-react'
import { Avatar, Badge } from '../ui'
import { SectionCard } from './SectionCard'
import type { Database } from '../../types'

export function OnDutyCard({ db, storeId }: { db: Database; storeId: string }) {
  const open = db.attendance
    .filter((record) => record.storeId === storeId && !record.clockOut)
    .sort((a, b) => a.clockIn.localeCompare(b.clockIn))
  const staff = open.flatMap((record) => {
    const user = db.users.find((candidate) =>
      candidate.id === record.userId && candidate.storeId === storeId && candidate.role === 'staff',
    )
    return user ? [{ record, user }] : []
  })

  return (
    <SectionCard icon={Clock3} tone="green" title="On duty now" subtitle={`${staff.length} staff clocked in`} bodyClassName="px-4 pb-4 sm:px-5">
      {staff.length ? (
        <div className="divide-y divide-line/60">
          {staff.map(({ record, user }) => (
            <div key={record.id} className="flex items-center gap-2.5 py-2.5">
              <Avatar name={user.name} photo={user.photo} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold">{user.name}</div>
                <div className="text-[10px] text-muted">Since {new Date(record.clockIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <Badge tone="success">On duty</Badge>
            </div>
          ))}
        </div>
      ) : <p className="py-2 text-center text-[11px] text-muted">No staff are clocked in.</p>}
    </SectionCard>
  )
}

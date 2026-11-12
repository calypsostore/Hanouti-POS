import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, Drawer } from '../../../components/ui'
import { useApp } from '../../../store/AppStore'
import { getStaffActivityLogs } from '../../../lib/staffDetails'
import AttendanceTab from './AttendanceTab'
import OverviewTab from './OverviewTab'
import PaymentsTab from './PaymentsTab'
import ScheduleTab from './ScheduleTab'
import StaffLogsTab from './StaffLogsTab'

type DetailTab = 'overview' | 'payments' | 'attendance' | 'schedule' | 'activity'

const TABS: Array<{ value: DetailTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'payments', label: 'Payments' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'activity', label: 'Activity log' },
]

export default function StaffDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db, store, user } = useApp()
  const [tab, setTab] = useState<DetailTab>('overview')
  const canOpen = user?.role === 'admin' ||
    (user?.role === 'staff' && user.permissions.supervisor)
  const logs = useMemo(
    () => canOpen && id ? getStaffActivityLogs(db, id).filter((log) => log.storeId === store?.id) : [],
    [canOpen, db, id, store?.id],
  )
  const staffIds = useMemo(
    () => canOpen
      ? db.users.filter((candidate) => candidate.storeId === store?.id && candidate.role === 'staff').map((candidate) => candidate.id)
      : [],
    [canOpen, db.users, store?.id],
  )

  if (!canOpen) return <Navigate to={user?.role === 'staff' ? '/staff' : '/admin'} replace />
  if (!store || !id) return <Navigate to="/admin/staff" replace />
  const member = db.users.find((candidate) =>
    candidate.id === id && candidate.storeId === store.id && candidate.role === 'staff',
  )
  if (!member) return <Navigate to="/admin/staff" replace />

  const close = () => navigate('/admin/staff')

  return (
    <Drawer
      open
      onClose={close}
      width="max-w-6xl"
      title={member.name}
      subtitle={`@${member.username ?? 'staff'} · ${member.active ? 'Active' : 'Inactive'}`}
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={close}>Close</Button></div>}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div role="tablist" aria-label="Staff details" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-cream-100/70 p-1">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              onClick={() => setTab(item.value)}
              className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                tab === item.value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'overview' && <OverviewTab member={member} db={db} store={store} />}
          {tab === 'payments' && <PaymentsTab member={member} db={db} storeId={store.id} />}
          {tab === 'attendance' && <AttendanceTab member={member} db={db} store={store} />}
          {tab === 'schedule' && <ScheduleTab member={member} db={db} store={store} />}
          {tab === 'activity' && <StaffLogsTab logs={logs} storeSlug={store.slug} staffIds={staffIds} db={db} />}
        </div>
      </div>
    </Drawer>
  )
}

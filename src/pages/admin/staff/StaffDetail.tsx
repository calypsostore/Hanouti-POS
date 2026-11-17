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
import { can } from '../../../lib/permissions'
import CashDifferencesTab from './CashDifferencesTab'
import StaffConsumptionTab from './StaffConsumptionTab'
import { modeFeatures } from '../../../lib/posMode'

type DetailTab = 'overview' | 'payments' | 'attendance' | 'schedule' | 'activity' | 'cash' | 'items'

const TABS: Array<{ value: DetailTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'payments', label: 'Payments' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'activity', label: 'Activity log' },
  { value: 'cash', label: 'Cash differences' },
  { value: 'items', label: 'Staff items' },
]

export default function StaffDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    db, store, user, resolveCashDifference, voidCashDifference,
    archiveCashDifference, restoreCashDifference, recordCashDifferenceCorrection,
    acceptCashDifference,
  } = useApp()
  const [tab, setTab] = useState<DetailTab>('overview')
  const isSelf = user?.role === 'staff' && user.id === id
  const canOpen = (user ? can(user, 'manageStaff') : false) ||
    (user?.role === 'staff' && (user.permissions.supervisor || isSelf))
  const features = store ? modeFeatures(store) : null
  const showPayroll = user ? can(user, 'managePayroll') && features?.payroll === true : false
  const showCash = !!user && (can(user, 'manageCashDifferences') || isSelf)
  const showAnalytics = !!user && can(user, 'viewStaffAnalytics')
  const tabs = TABS.filter((item) =>
    (showPayroll || !['payments', 'attendance'].includes(item.value)) &&
    (showCash || item.value !== 'cash') &&
    (features?.staffAllowances || item.value !== 'items'),
  )
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

  const close = () => navigate(isSelf ? '/staff' : '/admin/staff')

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
          {tabs.map((item) => (
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
          {tab === 'overview' && <OverviewTab member={member} db={db} store={store} showPayroll={showPayroll} showAnalytics={showAnalytics} />}
          {tab === 'payments' && <PaymentsTab member={member} db={db} storeId={store.id} />}
          {tab === 'attendance' && <AttendanceTab member={member} db={db} store={store} />}
          {tab === 'schedule' && <ScheduleTab member={member} db={db} store={store} />}
          {tab === 'activity' && <StaffLogsTab logs={logs} storeSlug={store.slug} staffIds={staffIds} db={db} />}
          {tab === 'cash' && showCash && user && <CashDifferencesTab
            member={member}
            db={db}
            canManage={can(user, 'manageCashDifferences')}
            isAdmin={user.role === 'admin'}
            resolve={resolveCashDifference}
            voidDifference={voidCashDifference}
            archive={archiveCashDifference}
            restore={restoreCashDifference}
            canResolveOwn={user.id === member.id && can(user, 'closeShift')}
            correct={recordCashDifferenceCorrection}
            accept={acceptCashDifference}
          />}
          {tab === 'items' && <StaffConsumptionTab
            orders={db.orders.filter((order) => order.storeId === store.id && order.staffId === member.id)}
          />}
        </div>
      </div>
    </Drawer>
  )
}

import { useEffect, useState } from 'react'
import { CalendarDays, ClipboardList, Percent, ShoppingBag, Wallet } from 'lucide-react'
import type { Database, Store, User } from '../../../types'
import { Avatar, Badge, Card, StatCard } from '../../../components/ui'
import { getStaffOverviewStats } from '../../../lib/staffDetails'
import { dateKey, fmtDate, money } from '../../../lib/utils'
import { summarizeAttendanceDay } from '../../../lib/payroll'
import StaffPerformanceCard from './StaffPerformanceCard'

export default function OverviewTab({
  member, db, store, showPayroll = true, showAnalytics = true,
}: { member: User; db: Database; store: Store; showPayroll?: boolean; showAnalytics?: boolean }) {
  const stats = getStaffOverviewStats(db, store.id, member.id)
  const [today, setToday] = useState(() => dateKey(new Date()))
  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentDate = dateKey(new Date())
      setToday((previousDate) => previousDate === currentDate ? previousDate : currentDate)
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [])
  const todayAttendance = summarizeAttendanceDay(
    db.attendance.filter((entry) => entry.storeId === store.id && entry.userId === member.id),
    store.settings.payroll,
    today,
  )
  const permissionLabels = [
    ['discount', 'Discounts'],
    ['credit', 'Customer tabs'],
    ['settle', 'Settlements'],
    ['register', 'Register'],
    ['reports', 'Reports'],
    ['supervisor', 'Shift manager'],
  ] as const

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <Avatar name={member.name} photo={member.photo} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-bold text-ink">{member.name}</h3>
            <Badge tone={member.active ? 'success' : 'danger'}>{member.active ? 'Active' : 'Inactive'}</Badge>
            <Badge tone="neutral">{member.role === 'manager' ? 'Manager (gérant)' : member.permissions.supervisor ? 'Shift manager' : 'Staff'}</Badge>
          </div>
          <p className="mt-1 text-[12px] text-muted">@{member.username ?? '—'}</p>
        </div>
        {showPayroll && (
          <div className="min-w-[150px] rounded-xl bg-cream-100/70 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Salary</div>
            <div className="mt-1 text-[13px] font-semibold text-ink">
              {member.salaryType === 'none' ? 'Not set' : `${member.salaryType} · ${money(member.salaryAmount)}`}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders handled" value={stats.ordersHandled} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Sales total" value={money(stats.salesTotal)} icon={<Wallet className="h-4 w-4" />} tone="success" />
        <StatCard label="Voids" value={stats.voids} icon={<ClipboardList className="h-4 w-4" />} tone="danger" />
        <StatCard label="Discounts this month" value={money(stats.discountsThisMonth)} icon={<Percent className="h-4 w-4" />} tone="accent" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-[13px] font-bold text-ink">Profile</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <dt className="text-muted">Joined</dt>
              <dd className="mt-0.5 font-semibold text-ink">{fmtDate(member.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Today’s attendance</dt>
              <dd className="mt-0.5 font-semibold capitalize text-ink">{todayAttendance?.status ?? 'No record'}</dd>
            </div>
            <div>
              <dt className="text-muted">Attendance hours today</dt>
              <dd className="mt-0.5 font-semibold text-ink">{todayAttendance ? `${todayAttendance.hours} h` : '—'}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-muted"><CalendarDays className="h-3 w-3" /> Store</dt>
              <dd className="mt-0.5 font-semibold text-ink">{store.name}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-4">
          <h3 className="text-[13px] font-bold text-ink">Permissions</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {permissionLabels.map(([key, label]) => (
              <Badge key={key} tone={member.permissions[key] ? 'accent' : 'neutral'}>
                {label}: {member.permissions[key] ? 'Yes' : 'No'}
              </Badge>
            ))}
          </div>
        </Card>
      </div>
      {showAnalytics && <StaffPerformanceCard member={member} db={db} store={store} />}
    </div>
  )
}

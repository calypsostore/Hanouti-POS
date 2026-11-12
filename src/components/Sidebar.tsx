import {
  BarChart3,
  Calculator,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import type { DashboardTone } from '../lib/palette'
import { cn, compactMoney } from '../lib/utils'
import { useApp } from '../store/AppStore'
import { getOutstandingBalance } from '../lib/dashboard'
import { BrandLogo } from './BrandLogo'
import { Avatar, Badge } from './ui'
import { AppIcon } from './AppIcon'

type NavItem = { to: string; label: string; icon: LucideIcon; tone: DashboardTone; end?: boolean }
type NavGroup = { label: string; items: NavItem[] }

export function Sidebar({
  collapsed,
  mobile,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean
  mobile?: boolean
  onToggle: () => void
  onNavigate?: () => void
}) {
  const { db, user, store, logout } = useApp()
  const navigate = useNavigate()
  if (!user) return null

  const isSuper = user.role === 'super'
  const isStaff = user.role === 'staff'
  const groups: NavGroup[] = isSuper
    ? [{ label: 'MAIN', items: [
        { to: '/super', label: 'Overview', icon: LayoutDashboard, tone: 'blue', end: true },
        { to: '/super/stores', label: 'Stores', icon: StoreIcon, tone: 'amber' },
      ] }]
    : isStaff
      ? [{ label: 'MAIN', items: [
          { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, tone: 'blue', end: true },
          { to: '/pos', label: 'New order', icon: ShoppingBag, tone: 'amber' },
        ] },
        { label: 'SALES', items: [
          { to: '/admin/orders', label: 'Orders', icon: ReceiptText, tone: 'purple' },
          { to: '/admin/customers', label: 'Regulars & tabs', icon: Users, tone: 'teal' },
          ...(user.permissions.register ? [{ to: '/admin/register', label: 'Register', icon: Calculator, tone: 'green' as const }] : []),
          ...(user.permissions.supervisor ? [{ to: '/admin/staff', label: 'Team', icon: Users, tone: 'purple' as const }] : []),
          { to: '/admin/expenses', label: 'My attendance', icon: Wallet, tone: 'rose' },
        ] }]
      : [
          { label: 'MAIN', items: [{ to: '/admin', label: 'Overview', icon: LayoutDashboard, tone: 'blue', end: true }] },
          { label: 'SALES', items: [
            { to: '/pos', label: 'Point of sale', icon: ShoppingBag, tone: 'amber' },
            { to: '/admin/orders', label: 'Orders', icon: ReceiptText, tone: 'purple' },
            { to: '/admin/customers', label: 'Regulars & tabs', icon: Users, tone: 'teal' },
          ] },
          { label: 'CATALOG', items: [{ to: '/admin/products', label: 'Products', icon: Package, tone: 'blue' }] },
          { label: 'TEAM', items: [{ to: '/admin/staff', label: 'Staff', icon: Users, tone: 'purple' }] },
          { label: 'FINANCE', items: [
            { to: '/admin/reports', label: 'Reports', icon: BarChart3, tone: 'green' },
            { to: '/admin/expenses', label: 'Expenses', icon: Wallet, tone: 'rose' },
            { to: '/admin/register', label: 'Register', icon: Calculator, tone: 'teal' },
          ] },
          { label: 'SYSTEM', items: [
            { to: '/admin/logs', label: 'Activity log', icon: ClipboardList, tone: 'purple' },
            { to: '/admin/settings', label: 'Settings', icon: Settings, tone: 'blue' },
          ] },
        ]

  const outstanding = store ? getOutstandingBalance(db, store.id) : 0
  const sidebarWidth = collapsed && !mobile ? 'w-[78px]' : 'w-[258px]'
  return (
    <div className={cn('grain relative flex h-full flex-col overflow-hidden bg-brand-navy text-white', sidebarWidth)}>
      <div className={cn('relative flex h-[76px] shrink-0 items-center border-b border-white/10', collapsed && !mobile ? 'justify-center px-2' : 'justify-between px-4')}>
        {collapsed && !mobile
          ? <BrandLogo size="sm" variant="dark" markOnly />
          : <BrandLogo size="sm" variant="dark" className="scale-[0.82] origin-left" />}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn('rounded-lg p-2 text-white/65 transition hover:bg-white/10 hover:text-white', collapsed && !mobile && 'absolute -right-1 bottom-1')}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className={cn('relative mx-3 mt-3 rounded-xl border border-white/10 bg-white/[0.06] p-3', collapsed && !mobile && 'mx-2 px-2')}>
        <div className={cn('flex items-center gap-2.5', collapsed && !mobile && 'justify-center')}>
          {isSuper
            ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10"><ShieldCheck className="h-4.5 w-4.5 text-brand-amber" /></span>
            : store?.logo
              ? <img src={store.logo} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
              : store && <AppIcon name={store.icon} color={store.iconColor} size={17} className="h-9 w-9 rounded-xl" />}
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold">{isSuper ? 'Platform console' : store?.name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/55">
                {isSuper ? 'All stores' : <>
                  <span className="capitalize">{store?.plan}</span>
                  {store?.settings.posMode === 'quick' ? <><Zap className="h-3 w-3" /> Quick sale</> : <><ReceiptText className="h-3 w-3" /> Full cashier</>}
                </>}
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="relative min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 py-4 thin-scrollbar">
        {groups.map((group) => (
          <section key={group.label}>
            {(!collapsed || mobile) && <h2 className="mb-1.5 px-2.5 text-[9px] font-bold tracking-[0.16em] text-white/40">{group.label}</h2>}
            <div className="space-y-1">
              {group.items.map(({ to, label, icon: Icon, tone, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={collapsed && !mobile ? label : undefined}
                  onClick={onNavigate}
                  className={({ isActive }) => cn(
                    'group flex min-h-10 items-center gap-2.5 rounded-xl px-2 py-1.5 text-[12px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand-amber',
                    collapsed && !mobile && 'justify-center px-1',
                    isActive ? 'bg-brand-amber text-brand-navy shadow-sm' : 'text-white/75 hover:bg-white/[0.08] hover:text-white',
                  )}
                  aria-label={collapsed && !mobile ? label : undefined}
                >
                  {({ isActive }) => <>
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', isActive ? 'bg-brand-navy/10' : 'bg-white/10')}>
                      <Icon className={cn('h-4 w-4', isActive ? 'text-brand-navy' : tone === 'amber' ? 'text-brand-amber' : 'text-white/80')} />
                    </span>
                    {(!collapsed || mobile) && <span className="min-w-0 flex-1 truncate">{label}</span>}
                    {label === 'Regulars & tabs' && outstanding > 0 && (!collapsed || mobile) && (
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', isActive ? 'bg-brand-navy/10' : 'bg-white/10')}>
                        {compactMoney(outstanding)}
                      </span>
                    )}
                  </>}
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <footer className="relative border-t border-white/10 p-3">
        {(!collapsed || mobile) && !isSuper && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-white/[0.06] px-2.5 py-2 text-[10px]">
            <span className="text-white/60">Plan</span>
            <Badge tone={store?.status === 'trial' ? 'warning' : 'neutral'} className="capitalize">{store?.plan}</Badge>
          </div>
        )}
        <div className={cn('flex items-center gap-2', collapsed && !mobile && 'justify-center')}>
          <Avatar name={user.name} photo={user.photo} size="sm" className="bg-white/15 text-white" />
          {(!collapsed || mobile) && <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-bold">{user.name}</div>
            <div className="text-[9.5px] capitalize text-white/55">{user.role}</div>
          </div>}
          <button
            type="button"
            onClick={() => { logout(); navigate('/login') }}
            title="Log out"
            aria-label="Log out"
            className="rounded-lg p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
          ><LogOut className="h-4 w-4" /></button>
        </div>
      </footer>
    </div>
  )
}

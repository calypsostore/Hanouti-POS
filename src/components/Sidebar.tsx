import {
  BarChart3,
  Calculator,
  ClipboardList,
  ChefHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  Truck,
  Utensils,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import type { DashboardTone } from '../lib/palette'
import { cn, compactMoney } from '../lib/utils'
import { useApp } from '../store/AppStore'
import { getOutstandingBalance } from '../lib/dashboard'
import { BrandLogo } from './BrandLogo'
import { Avatar, Badge } from './ui'
import { AppIcon } from './AppIcon'
import { can } from '../lib/permissions'
import { isQuick, modeFeatures } from '../lib/posMode'
import { canViewCustomerTabs } from '../lib/customerTabs'
import { cashierSidebarPaths, quickSidebarPaths } from '../lib/posNavigation'

type NavItem = { to: string; label: string; icon: LucideIcon; tone: DashboardTone; end?: boolean }
type NavGroup = { label: string; items: NavItem[] }

const PRIMARY_NAV_PATHS = new Set([
  '/admin',
  '/staff',
  '/super',
  '/pos',
  '/kitchen',
  '/admin/orders',
  '/admin/staff',
])

const COLLAPSED_NAV_ITEM_HEIGHT = 36
const COLLAPSED_MENU_BUTTON_HEIGHT = 40
const COLLAPSED_NAV_GAP = 2

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
  const collapsedNavRef = useRef<HTMLElement | null>(null)
  const [collapsedMenuOpen, setCollapsedMenuOpen] = useState(false)
  const [collapsedNavItemCount, setCollapsedNavItemCount] = useState(5)
  const hasUser = Boolean(user)

  useEffect(() => {
    if (!hasUser) return
    const nav = collapsedNavRef.current
    if (!nav) return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const availableHeight = entry.contentRect.height
      const itemCount = Math.max(0, Math.floor(
        (availableHeight - COLLAPSED_MENU_BUTTON_HEIGHT - COLLAPSED_NAV_GAP)
        / (COLLAPSED_NAV_ITEM_HEIGHT + COLLAPSED_NAV_GAP),
      ))
      setCollapsedNavItemCount(itemCount)
    })
    observer.observe(nav)
    return () => observer.disconnect()
  }, [hasUser])

  if (!user) return null

  const isSuper = user.role === 'super'
  const isStaff = user.role === 'staff'
  const isManager = user.role === 'manager'
  const quick = store ? isQuick(store) : false
  const features = store ? modeFeatures(store) : null
  const groups: NavGroup[] = isSuper
    ? [{ label: 'MAIN', items: [
        { to: '/super', label: 'Overview', icon: LayoutDashboard, tone: 'blue', end: true },
        { to: '/super/stores', label: 'Stores', icon: StoreIcon, tone: 'amber' },
      ] }]
    : quick
      ? isStaff
        ? [{ label: 'QUICK', items: [
            { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, tone: 'blue' as const },
            { to: '/pos', label: 'POS', icon: ShoppingBag, tone: 'amber' },
            { to: '/admin/orders', label: 'Orders', icon: ReceiptText, tone: 'purple' },
            ...(features?.kitchenStations && can(user, 'viewStation')
              ? [{ to: '/kitchen', label: 'Stations', icon: ChefHat, tone: 'green' as const }]
              : []),
            ...(store && canViewCustomerTabs(store, user)
              ? [{ to: '/admin/customers', label: 'Regulars & tabs', icon: Users, tone: 'teal' as const }]
              : []),
            ...(user.permissions.supervisor || can(user, 'manageStaff')
              ? [{ to: '/admin/staff', label: 'Staff', icon: Users, tone: 'purple' as const }]
              : []),
            ...(can(user, 'viewReports')
              ? [{ to: '/admin/reports', label: 'Reports', icon: BarChart3, tone: 'green' as const }]
              : []),
            ...(can(user, 'viewExpenses')
              ? [{ to: '/admin/expenses', label: 'Expenses', icon: Wallet, tone: 'rose' as const }]
              : []),
            ...(can(user, 'openShift') || can(user, 'closeShift')
              ? [{ to: '/admin/register', label: 'Register', icon: Calculator, tone: 'teal' as const }]
              : []),
            ...(can(user, 'viewReports')
              ? [{ to: '/admin/logs', label: 'Activity log', icon: ClipboardList, tone: 'purple' as const }]
              : []),
            ...(can(user, 'manageSettings')
              ? [{ to: '/admin/settings', label: 'Settings', icon: Settings, tone: 'blue' as const }]
              : []),
          ] }]
        : [
            { label: 'QUICK', items: [
              { to: '/admin', label: 'Overview', icon: LayoutDashboard, tone: 'blue', end: true },
              { to: '/pos', label: 'POS', icon: ShoppingBag, tone: 'amber' },
              { to: '/admin/orders', label: 'Orders', icon: ReceiptText, tone: 'purple' },
              ...(features?.kitchenStations && can(user, 'viewStation')
                ? [{ to: '/kitchen', label: 'Stations', icon: ChefHat, tone: 'green' as const }]
                : []),
              ...(store && canViewCustomerTabs(store, user)
                ? [{ to: '/admin/customers', label: 'Regulars & tabs', icon: Users, tone: 'teal' as const }]
                : []),
              { to: '/admin/products', label: 'Products', icon: Package, tone: 'blue' },
            ] },
            { label: 'TEAM', items: [
              { to: '/admin/staff', label: 'Staff', icon: Users, tone: 'purple' },
            ] },
            { label: 'OPERATIONS', items: [
              { to: '/admin/reports', label: 'Reports', icon: BarChart3, tone: 'green' },
              { to: '/admin/expenses', label: 'Expenses', icon: Wallet, tone: 'rose' },
              { to: '/admin/register', label: 'Register', icon: Calculator, tone: 'teal' },
              { to: '/admin/logs', label: 'Activity log', icon: ClipboardList, tone: 'purple' },
              { to: '/admin/settings', label: 'Settings', icon: Settings, tone: 'blue' },
            ] },
          ]
      : isStaff
      ? [{ label: 'MAIN', items: [
          { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, tone: 'blue', end: true },
          { to: '/pos', label: 'New order', icon: ShoppingBag, tone: 'amber' },
          ...(features?.tablesFloor
            ? [{ to: '/pos/floor', label: 'Floor', icon: Utensils, tone: 'teal' as const }]
            : []),
          ...(can(user, 'viewStation')
            ? [{ to: '/kitchen', label: 'Stations', icon: ChefHat, tone: 'green' as const }]
            : []),
        ] },
        { label: 'SALES', items: [
          { to: '/admin/orders', label: 'Orders', icon: ReceiptText, tone: 'purple' },
          { to: '/admin/customers', label: 'Regulars & tabs', icon: Users, tone: 'teal' },
          ...(can(user, 'recordPurchases')
            ? [{ to: '/admin/purchases', label: 'Purchases', icon: Truck, tone: 'amber' as const }]
            : []),
          ...(can(user, 'openShift') || can(user, 'closeShift')
            ? [{ to: '/admin/register', label: 'My shift', icon: Calculator, tone: 'green' as const }]
            : []),
          ...(user.permissions.supervisor ? [{ to: '/admin/staff', label: 'Team', icon: Users, tone: 'purple' as const }] : []),
          { to: '/admin/expenses', label: 'My attendance', icon: Wallet, tone: 'rose' },
        ] }]
      : [
          { label: 'MAIN', items: [{ to: '/admin', label: 'Overview', icon: LayoutDashboard, tone: 'blue', end: true }] },
          { label: 'SALES', items: [
            { to: '/pos', label: 'Point of sale', icon: ShoppingBag, tone: 'amber' },
            ...(store?.settings.features.tables
              ? [{ to: '/pos/floor', label: 'Floor', icon: Utensils, tone: 'teal' as const }]
              : []),
            ...(can(user, 'viewStation')
              ? [{ to: '/kitchen', label: 'Stations', icon: ChefHat, tone: 'green' as const }]
              : []),
            { to: '/admin/orders', label: 'Orders', icon: ReceiptText, tone: 'purple' },
            { to: '/admin/customers', label: 'Regulars & tabs', icon: Users, tone: 'teal' },
            { to: '/admin/purchases', label: 'Purchases', icon: Truck, tone: 'amber' },
          ] },
          { label: 'CATALOG', items: [
            { to: '/admin/products', label: 'Products', icon: Package, tone: 'blue' },
            { to: '/admin/inventory', label: 'Inventory', icon: Package, tone: 'green' },
          ] },
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

  const quickPaths = quick && store ? new Set(quickSidebarPaths(store, user)) : undefined
  const cashierPaths = !quick && store ? new Set(cashierSidebarPaths(store, user)) : undefined
  const modeFilteredGroups = quickPaths
    ? groups.map((group) => ({
        ...group,
        items: group.items.filter((item) => quickPaths.has(item.to)),
      })).filter((group) => group.items.length > 0)
    : cashierPaths
      ? groups.map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            !['/pos/floor', '/kitchen', '/admin/purchases', '/admin/inventory', '/admin/customers'].includes(item.to) ||
            cashierPaths.has(item.to),
          ),
        })).filter((group) => group.items.length > 0)
      : groups
  const visibleGroups = isManager
    ? modeFilteredGroups.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.to === '/admin') return can(user, 'viewReports')
          if (item.to === '/admin/products') return can(user, 'manageProducts')
          if (item.to === '/admin/inventory') return can(user, 'manageInventory')
          if (item.to === '/admin/purchases') return can(user, 'recordPurchases')
          if (item.to === '/admin/staff') return can(user, 'manageStaff')
          if (item.to === '/admin/reports' || item.to === '/admin/logs') return can(user, 'viewReports')
          if (item.to === '/admin/register') return can(user, 'openShift') || can(user, 'closeShift')
          if (item.to === '/admin/customers') {
            return quick ? quickPaths?.has(item.to) === true : user.permissions.credit
          }
          if (item.to === '/admin/settings') return can(user, 'manageSettings')
          if (item.to === '/admin/expenses') {
            return quick ? can(user, 'viewExpenses') : can(user, 'managePayroll')
          }
          return true
        }),
      })).filter((group) => group.items.length > 0)
    : modeFilteredGroups

  const outstanding = store ? getOutstandingBalance(db, store.id) : 0
  const allItems = visibleGroups.flatMap((group) => group.items)
  const prioritizedItems = [
    ...allItems.filter((item) => PRIMARY_NAV_PATHS.has(item.to)),
    ...allItems.filter((item) => !PRIMARY_NAV_PATHS.has(item.to)),
  ]
  const primaryItems = prioritizedItems.slice(0, collapsedNavItemCount)
  const primaryPaths = new Set(primaryItems.map((item) => item.to))
  const menuGroups = visibleGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !primaryPaths.has(item.to)),
  })).filter((group) => group.items.length > 0)
  const sidebarWidth = collapsed && !mobile ? 'w-[78px]' : 'w-[258px]'
  const renderGroups = (groups: NavGroup[], inPopover = false) => groups.map((group) => (
    <section key={group.label} className={inPopover ? 'min-w-0' : undefined}>
      {(!collapsed || mobile || inPopover) && (
        <h2 className={cn(
          'mb-1 px-2 font-bold tracking-[0.14em]',
          inPopover ? 'text-[9px] text-muted' : 'text-[8px] text-white/40',
        )}>{group.label}</h2>
      )}
      <div className={cn('space-y-0.5', inPopover && 'min-w-0')}>
        {group.items.map(({ to, label, icon: Icon, tone, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed && !mobile && !inPopover ? label : undefined}
            onClick={() => {
              if (inPopover) setCollapsedMenuOpen(false)
              onNavigate?.()
            }}
            className={({ isActive }) => cn(
              'sidebar-link group flex items-center rounded-lg font-semibold focus-visible:ring-2 focus-visible:ring-brand-amber',
              inPopover ? 'min-h-7 gap-1.5 px-1.5 text-[10px]' : 'min-h-10 gap-2 px-2 py-1.5 text-[11px]',
              collapsed && !mobile && !inPopover && 'justify-center px-1',
              isActive ? 'bg-brand-amber text-brand-navy shadow-sm' : inPopover
                ? 'text-ink hover:bg-cream-100 dark:text-white/80 dark:hover:bg-espresso-700'
                : 'text-white/75 hover:bg-white/[0.08] hover:text-white',
            )}
            aria-label={collapsed && !mobile && !inPopover ? label : undefined}
          >
            {({ isActive }) => <>
              <span className={cn(
                'flex shrink-0 items-center justify-center rounded-md',
                inPopover ? 'h-5 w-5' : 'h-7 w-7',
                inPopover
                  ? isActive ? 'bg-brand-navy/10' : 'bg-cream-100 dark:bg-espresso-700'
                  : isActive ? 'bg-brand-navy/10' : 'bg-white/10',
              )}>
                <Icon className={cn(
                  'h-3.5 w-3.5',
                  isActive ? 'text-brand-navy' : tone === 'amber' ? 'text-brand-amber' : inPopover ? 'text-muted dark:text-white/80' : 'text-white/80',
                )} />
              </span>
              {(inPopover || !collapsed || mobile) && <span className="min-w-0 flex-1 truncate">{label}</span>}
              {label === 'Regulars & tabs' && outstanding > 0 && (inPopover || !collapsed || mobile) && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', isActive ? 'bg-brand-navy/10' : 'bg-cream-100 dark:bg-espresso-700')}>
                  {compactMoney(outstanding)}
                </span>
              )}
            </>}
          </NavLink>
        ))}
      </div>
    </section>
  ))
  return (
    <div className={cn('glass-sidebar grain relative flex h-full flex-col overflow-hidden text-white transition-[width,box-shadow] duration-300 ease-out', sidebarWidth)}>
      <div className={cn('relative flex h-16 shrink-0 items-center border-b border-white/10 bg-white/[0.025]', collapsed && !mobile ? 'justify-center px-2' : 'justify-between px-3')}>
        {collapsed && !mobile
          ? <BrandLogo size="sm" variant="dark" markOnly />
          : <BrandLogo size="sm" variant="dark" className="scale-75 origin-left" />}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn('rounded-lg p-2 text-white/65 transition duration-200 hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95', collapsed && !mobile && 'absolute -right-1 bottom-1')}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className={cn('sidebar-glass-panel relative mx-2.5 mt-2.5 rounded-2xl p-2 transition duration-200 hover:border-white/20', collapsed && !mobile && 'mx-2 px-2')}>
        <div className={cn('flex items-center gap-2', collapsed && !mobile && 'justify-center')}>
          {isSuper
            ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10"><ShieldCheck className="h-4 w-4 text-brand-amber" /></span>
            : store?.logo
              ? <img src={store.logo} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
              : store && <AppIcon name={store.icon} color={store.iconColor} size={16} className="sidebar-store-icon h-8 w-8 rounded-lg" />}
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-bold">{isSuper ? 'Platform console' : store?.name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[9px] text-white/55">
                {isSuper ? 'All stores' : <>
                  <span className="capitalize">{store?.plan}</span>
                  {store && isQuick(store) ? <><Zap className="h-2.5 w-2.5" /> Quick sale</> : <><ReceiptText className="h-2.5 w-2.5" /> Full cashier</>}
                </>}
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className={cn(
        'relative min-h-0 flex-1 px-2.5 py-3',
        collapsed && !mobile ? 'overflow-visible' : 'space-y-2.5 overflow-y-auto thin-scrollbar',
      )} ref={collapsedNavRef}>
        {collapsed && !mobile
          ? <div className="space-y-0.5">
              {primaryItems.map(({ to, label, icon: Icon, tone, end }, index) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={label}
                  aria-label={label}
                  onClick={() => setCollapsedMenuOpen(false)}
                  className={({ isActive }) => cn(
                    'sidebar-link group flex min-h-9 w-full items-center justify-center rounded-lg px-1 focus-visible:ring-2 focus-visible:ring-brand-amber',
                    isActive ? 'bg-brand-amber text-brand-navy shadow-sm' : 'text-white/75 hover:bg-white/[0.08] hover:text-white',
                  )}
                  style={{ animationDelay: `${index * 24}ms` }}
                >
                  {({ isActive }) => <>
                    <span className={cn('sidebar-icon-tile flex h-7 w-7 shrink-0 items-center justify-center rounded-md', isActive ? 'bg-brand-navy/10' : 'bg-white/10')}>
                      <Icon className={cn('h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110', isActive ? 'text-brand-navy' : tone === 'amber' ? 'text-brand-amber' : 'text-white/80')} />
                    </span>
                  </>}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => setCollapsedMenuOpen((open) => !open)}
                aria-label={collapsedMenuOpen ? 'Hide more navigation options' : 'Show more navigation options'}
                aria-expanded={collapsedMenuOpen}
                aria-controls="collapsed-sidebar-menu"
                title="Show more navigation options"
                className="sidebar-glass-panel group mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-white/80 shadow-sm transition duration-200 hover:scale-105 hover:bg-white/[0.15] hover:text-white active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-amber"
              >
                <Menu className="h-4 w-4 transition-transform duration-200 group-hover:rotate-6" />
              </button>
            </div>
          : renderGroups(visibleGroups)}
        {collapsed && !mobile && collapsedMenuOpen && <>
          <button
            type="button"
            onClick={() => setCollapsedMenuOpen(false)}
            aria-label="Close navigation options"
            className="fixed inset-y-0 left-[78px] right-0 z-40 animate-[fadeIn_.18s_ease-out] cursor-default bg-brand-navy/15 backdrop-blur-[2px]"
          />
          <div
            id="collapsed-sidebar-menu"
            className="sidebar-glass-menu fixed left-[86px] top-16 z-50 grid w-fit max-w-[calc(100vw-6rem)] grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] content-start gap-x-3 gap-y-2 overflow-y-auto rounded-2xl p-2 text-ink animate-[slideLeft_.2s_cubic-bezier(0.16,1,0.3,1)] thin-scrollbar"
          >
            {renderGroups(menuGroups, true)}
            <button
              type="button"
              onClick={() => { setCollapsedMenuOpen(false); logout(); navigate('/login') }}
              aria-label="Log out"
              className="col-span-full flex min-h-8 items-center gap-2 rounded-lg border-t border-line px-2 text-[11px] font-semibold text-muted transition-colors hover:bg-cream-100 hover:text-ink dark:border-white/10 dark:text-white/70 dark:hover:bg-espresso-700 dark:hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </>}
      </nav>

      <footer className="relative border-t border-white/10 bg-white/[0.025] p-2.5">
        {(!collapsed || mobile) && !isSuper && (
          <div className="mb-1.5 flex items-center justify-between rounded-lg bg-white/[0.06] px-2 py-1.5 text-[9px]">
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
          {(!collapsed || mobile) && <button
            type="button"
            onClick={() => { logout(); navigate('/login') }}
            title="Log out"
            aria-label="Log out"
            className="rounded-lg p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
          ><LogOut className="h-4 w-4" /></button>}
        </div>
      </footer>
    </div>
  )
}

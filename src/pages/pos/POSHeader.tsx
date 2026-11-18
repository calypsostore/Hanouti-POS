import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, BarChart3, ChefHat, Clock3, Coffee, ClipboardList, Flag, LogOut,
  MoreHorizontal, Package, ReceiptText, Settings, Truck, Utensils, Users, Wallet, Zap,
} from 'lucide-react'
import type { Store, User } from '../../types'
import { Avatar, Badge } from '../../components/ui'
import { AppIcon } from '../../components/AppIcon'
import { ReprintLastReceipt } from '../../components/ReprintLastReceipt'
import { can } from '../../lib/permissions'
import { isQuick, modeFeatures } from '../../lib/posMode'
import { canViewCustomerTabs } from '../../lib/customerTabs'
import { cashierSidebarPaths, quickSidebarPaths } from '../../lib/posNavigation'

type POSHeaderProps = {
  store: Store
  user: User
  now: Date
  registerOpen: boolean
  canOpenRegister: boolean
  shiftReminderDue: boolean
  onLogout: () => void
  eightySixCount: number
  onShowEightySixList: () => void
  onStaffItems: () => void
}

const MORE_ACTIONS = [
  { to: '/admin/register', label: 'Shift', icon: Clock3 },
  { to: '/kitchen', label: 'Stations', icon: ChefHat },
  { to: '/admin/staff', label: 'Team', icon: Users },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/logs', label: 'Activity', icon: ClipboardList },
  { to: '/admin/expenses', label: 'Expenses', icon: Wallet },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/inventory', label: 'Inventory', icon: Package },
  { to: '/admin/purchases', label: 'Purchases', icon: Truck },
]

const mobileActionClass =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 text-[11px] font-semibold text-ink transition hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber dark:bg-espresso-800'

export function POSHeader({
  store, user, now, registerOpen, canOpenRegister, shiftReminderDue, onLogout, eightySixCount, onShowEightySixList, onStaffItems,
}: POSHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const quick = isQuick(store)
  const features = modeFeatures(store)
  const canViewTabs = !quick || canViewCustomerTabs(store, user)
  const canOpenRegulars = canViewTabs && (
    user.role === 'staff' || user.role === 'manager' || canViewCustomerTabs(store, user)
  )
  const canOpenDashboard = user.role === 'staff' || user.role === 'admin' || can(user, 'viewReports')
  const canOpenOrders = can(user, 'viewOrders')
  const hasUnavailableItems = eightySixCount > 0
  const availablePaths = new Set(quick
    ? quickSidebarPaths(store, user)
    : cashierSidebarPaths(store, user))

  if (canOpenRegister || can(user, 'openShift') || can(user, 'closeShift')) {
    availablePaths.add('/admin/register')
  }
  if (canOpenOrders) availablePaths.add('/admin/orders')
  if (canOpenRegulars) availablePaths.add('/admin/customers')
  if (can(user, 'manageStaff') || user.permissions.supervisor) availablePaths.add('/admin/staff')
  if (can(user, 'viewReports')) {
    availablePaths.add('/admin/reports')
    availablePaths.add('/admin/logs')
  }
  if (can(user, 'viewExpenses')) availablePaths.add('/admin/expenses')
  if (can(user, 'manageSettings')) availablePaths.add('/admin/settings')
  if (can(user, 'manageProducts')) availablePaths.add('/admin/products')
  if (can(user, 'manageInventory')) availablePaths.add('/admin/inventory')
  if (can(user, 'recordPurchases')) availablePaths.add('/admin/purchases')

  const directPaths = new Set(['/admin/orders', '/admin/customers', '/pos/floor'])
  const moreActions = MORE_ACTIONS.filter(({ to }) => availablePaths.has(to) && !directPaths.has(to))

  return (
    <>
      <header className="sticky top-0 z-40 mx-0 mt-0 flex shrink-0 flex-col gap-1 border-b border-line bg-white px-3 py-1 shadow-sm dark:bg-espresso-900 sm:h-[64px] sm:min-h-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-0">
        <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {store.logo
              ? <img src={store.logo} alt="" className="h-8 w-8 shrink-0 rounded-xl object-cover sm:h-10 sm:w-10" />
              : <AppIcon name={store.icon} color={store.iconColor} size={19} className="h-8 w-8 shrink-0 rounded-xl sm:h-10 sm:w-10" />}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-bold tracking-tight text-ink">{store.name}</span>
                <Badge tone={quick ? 'info' : 'accent'}>
                  {quick ? <Zap className="h-3 w-3" /> : <ReceiptText className="h-3 w-3" />}
                  {quick ? 'Quick' : 'Cashier'}
                </Badge>
              </div>
              <div className="truncate text-[10px] text-muted sm:text-[11px]">
                {store.city} · {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:hidden">
            <Avatar name={user.name} photo={user.photo} size="xs" />
            <button
              onClick={onLogout}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-line p-0 text-muted transition hover:bg-cream-100 hover:text-ink"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="flex w-full min-w-0 items-center gap-1 overflow-x-auto border-t border-line/60 pt-1 no-scrollbar sm:ml-auto sm:w-auto sm:shrink-0 sm:justify-end sm:gap-2 sm:overflow-visible sm:border-t-0 sm:pt-0" aria-label="POS shortcuts">
          {canOpenOrders && (
            <Link to="/admin/orders" className={`${mobileActionClass} sm:hidden`}>
              <ReceiptText className="h-3.5 w-3.5" /> Orders
            </Link>
          )}
          {canOpenRegulars && (
            <Link to="/admin/customers" className={`${mobileActionClass} sm:hidden`}>
              <Users className="h-3.5 w-3.5" /> Regulars
            </Link>
          )}
          {canOpenDashboard && (
            <Link
              to={user.role === 'admin' || user.role === 'manager' ? '/admin' : '/staff'}
              className={`${mobileActionClass} sm:hidden`}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
          )}
          {features.tablesFloor && (
            <Link to="/pos/floor" className={`${mobileActionClass} sm:hidden`}>
              <Utensils className="h-3.5 w-3.5" /> Floor
            </Link>
          )}
          {features.staffAllowances && store.settings.staffConsumption.enabled && store.settings.staffConsumption.allowances.length > 0 &&
            can(user, 'useStaffAllowances') && (
              <button type="button" onClick={onStaffItems} className={`${mobileActionClass} sm:hidden`}>
                <Coffee className="h-3.5 w-3.5" /> Staff items
              </button>
            )}
          {store.settings.availability.enabled && store.settings.availability.showListButton && (
            <button
              type="button"
              onClick={onShowEightySixList}
              className={`${mobileActionClass} sm:hidden`}
              aria-label={hasUnavailableItems
                ? `86 list, ${eightySixCount} unavailable items`
                : '86 list, no unavailable items'}
            >
              <Flag className={`h-3.5 w-3.5 ${
                hasUnavailableItems
                  ? 'text-red-600 motion-safe:animate-[flag-wave_1s_ease-in-out_infinite]'
                  : 'text-muted/70'
              }`} />
              86 list
            </button>
          )}
          {features.receiptPrinting && <span className="sm:hidden"><ReprintLastReceipt compact /></span>}
          {moreActions.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              className={`${mobileActionClass} sm:hidden`}
              aria-expanded={moreOpen}
              aria-label="More navigation options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" /> More
            </button>
          )}

          {features.staffAllowances && store.settings.staffConsumption.enabled && store.settings.staffConsumption.allowances.length > 0 &&
            can(user, 'useStaffAllowances') && (
              <button
                type="button"
                onClick={onStaffItems}
                className="hidden h-8 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-2 text-[12px] font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800 sm:inline-flex sm:h-9 sm:px-2.5"
              >
                <Coffee className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Staff items</span>
              </button>
            )}
          {store.settings.availability.enabled && store.settings.availability.showListButton && (
            <button
              type="button"
              onClick={onShowEightySixList}
              className="relative hidden h-8 shrink-0 items-center gap-1 rounded-xl border border-line bg-white px-2 text-[12px] font-semibold text-ink transition hover:bg-brand-tint dark:bg-espresso-800 sm:inline-flex sm:h-9 sm:gap-1.5 sm:px-2.5"
              aria-label={hasUnavailableItems
                ? `86 list, ${eightySixCount} unavailable items`
                : '86 list, no unavailable items'}
            >
              <Flag className={`h-3.5 w-3.5 origin-[17%_92%] ${
                hasUnavailableItems
                  ? 'text-red-600 motion-safe:animate-[flag-wave_1s_ease-in-out_infinite]'
                  : 'text-muted/70'
              }`} />
              <span className="hidden sm:inline">86 list</span>
            </button>
          )}
          {canOpenDashboard && (
            <Link
              to={user.role === 'admin' || user.role === 'manager' ? '/admin' : '/staff'}
              aria-label="Dashboard"
              title="Dashboard"
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800 sm:inline-flex sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Dashboard</span>
            </Link>
          )}
          {features.tablesFloor && (
            <Link
              to="/pos/floor"
              aria-label="Floor"
              title="Floor"
              className="hidden h-8 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-2 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800 sm:inline-flex sm:h-9 sm:px-3"
            >
              <Utensils className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Floor</span>
            </Link>
          )}
          {features.receiptPrinting && <span className="hidden sm:inline-flex"><ReprintLastReceipt compact /></span>}
          {canOpenRegulars && (
            <Link
              to="/admin/customers"
              className="hidden h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800 sm:inline-flex"
              title="Regulars & tabs"
            >
              <Users className="h-3.5 w-3.5" />
              Regulars
            </Link>
          )}
          {(user.role === 'staff' || user.role === 'manager') && (
            <>
              {canOpenOrders && <Link
                to="/admin/orders"
                className="hidden h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800 sm:inline-flex"
              >
                <ReceiptText className="h-3.5 w-3.5" /> Orders
              </Link>}
            </>
          )}
          <div className="hidden items-center gap-2 rounded-xl border border-line px-2 py-1 sm:flex">
            <Avatar name={user.name} photo={user.photo} size="xs" />
            <span className="pr-1 text-[12px] font-semibold text-ink">{user.name.split(' ')[0]}</span>
          </div>
          <button
            onClick={onLogout}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line p-0 text-muted transition hover:bg-cream-100 hover:text-ink sm:inline-flex sm:h-9 sm:w-9"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </nav>
        {moreOpen && (
          <nav
            className="absolute left-2 right-2 top-full z-40 mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-white p-3 shadow-xl dark:bg-espresso-900 sm:hidden"
            aria-label="More POS actions"
          >
            {moreActions.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-cream-50 px-3 text-xs font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {user.role === 'staff' && !registerOpen && store.settings.requireShiftForOrders && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-amber/40 bg-brand-amber-soft px-4 py-2.5 text-[12.5px] text-brand-navy sm:px-5">
          <span>{canOpenRegister ? 'Open your shift before taking orders.' : 'Your shift is closed. Ask a manager to open one if you need access.'}</span>
          {canOpenRegister && (
            <Link
              to="/admin/register"
              className="shrink-0 rounded-lg bg-brand-amber px-3 py-1.5 font-semibold text-brand-navy hover:bg-brand-amber-hover"
            >
              Open shift
            </Link>
          )}
        </div>
      )}
      {registerOpen && shiftReminderDue && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-amber/40 bg-brand-amber-soft px-4 py-2.5 text-[12.5px] text-brand-navy sm:px-5">
          <span>Close your shift when you are ready to hand over.</span>
          <Link to="/admin/register" className="shrink-0 rounded-lg bg-brand-amber px-3 py-1.5 font-semibold text-brand-navy hover:bg-brand-amber-hover">
            Close shift
          </Link>
        </div>
      )}

    </>
  )
}

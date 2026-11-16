import { Link } from 'react-router-dom'
import { ArrowLeft, Coffee, Flag, LogOut, ReceiptText, Utensils, Users, Zap } from 'lucide-react'
import type { Store, User } from '../../types'
import { Avatar, Badge } from '../../components/ui'
import { AppIcon } from '../../components/AppIcon'
import { ReprintLastReceipt } from '../../components/ReprintLastReceipt'
import { can } from '../../lib/permissions'

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

export function POSHeader({
  store, user, now, registerOpen, canOpenRegister, shiftReminderDue, onLogout, eightySixCount, onShowEightySixList, onStaffItems,
}: POSHeaderProps) {
  const quick = store.settings.posMode === 'quick'
  const hasUnavailableItems = eightySixCount > 0

  return (
    <>
      <header className="glass z-20 mx-3 mt-3 flex min-h-[52px] shrink-0 items-center justify-center rounded-2xl px-2 py-2 sm:h-[64px] sm:min-h-0 sm:justify-between sm:gap-3 sm:px-5 sm:py-0">
        <div className="hidden min-w-0 items-center gap-2 sm:flex sm:gap-3">
          {store.logo
            ? <img src={store.logo} alt="" className="h-8 w-8 shrink-0 rounded-xl object-cover sm:h-10 sm:w-10" />
            : <AppIcon name={store.icon} color={store.iconColor} size={19} className="h-8 w-8 shrink-0 rounded-xl sm:h-10 sm:w-10" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-bold tracking-tight text-ink">{store.name}</span>
              <Badge tone={quick ? 'info' : 'accent'} className="hidden sm:inline-flex">
                {quick ? <Zap className="h-3 w-3" /> : <ReceiptText className="h-3 w-3" />}
                {quick ? 'Quick' : 'Cashier'}
              </Badge>
            </div>
            <div className="truncate text-[10px] text-muted sm:text-[11px]">
              {store.city} · {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {user.name}
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 items-center justify-center gap-1 sm:ml-auto sm:w-auto sm:justify-end sm:gap-2">
          {store.settings.staffConsumption.enabled && store.settings.staffConsumption.allowances.length > 0 &&
            can(user, 'useStaffAllowances') && (
              <button
                type="button"
                onClick={onStaffItems}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-2 text-[12px] font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800 sm:h-9 sm:px-2.5"
              >
                <Coffee className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Staff items</span>
              </button>
            )}
          {store.settings.availability.enabled && store.settings.availability.showListButton && (
            <button
              type="button"
              onClick={onShowEightySixList}
              className="relative inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border border-line bg-white px-2 text-[12px] font-semibold text-ink transition hover:bg-brand-tint dark:bg-espresso-800 sm:h-9 sm:gap-1.5 sm:px-2.5"
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
          {(user.role === 'admin' || user.role === 'manager' || user.role === 'staff') && (
            <Link
              to={user.role === 'admin' || user.role === 'manager' ? '/admin' : '/staff'}
              aria-label="Dashboard"
              title="Dashboard"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Dashboard</span>
            </Link>
          )}
          {store.settings.features.tables && (
            <Link
              to="/pos/floor"
              aria-label="Floor"
              title="Floor"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-2 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800 sm:h-9 sm:px-3"
            >
              <Utensils className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Floor</span>
            </Link>
          )}
          <ReprintLastReceipt compact />
          {(user.role === 'staff' || user.role === 'manager') && (
            <>
              <Link
                to="/admin/customers"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-2 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800 sm:h-9 sm:px-3"
                title="Regulars & tabs"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Regulars</span>
              </Link>
              <Link
                to="/admin/orders"
                className="hidden h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 dark:bg-espresso-800 sm:inline-flex"
              >
                <ReceiptText className="h-3.5 w-3.5" /> Orders
              </Link>
            </>
          )}
          <div className="hidden items-center gap-2 rounded-xl border border-line px-2 py-1 sm:flex">
            <Avatar name={user.name} photo={user.photo} size="xs" />
            <span className="pr-1 text-[12px] font-semibold text-ink">{user.name.split(' ')[0]}</span>
          </div>
          <button
            onClick={onLogout}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line p-0 text-muted transition hover:bg-cream-100 hover:text-ink sm:h-9 sm:w-9"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
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

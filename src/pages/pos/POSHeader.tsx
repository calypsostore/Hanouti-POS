import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut, ReceiptText, Users, Zap } from 'lucide-react'
import type { Store, User } from '../../types'
import { Avatar, Badge } from '../../components/ui'
import { ThemeToggle } from '../../components/ThemeToggle'
import { AppIcon } from '../../components/AppIcon'

type POSHeaderProps = {
  store: Store
  user: User
  now: Date
  registerOpen: boolean
  canOpenRegister: boolean
  onLogout: () => void
}

export function POSHeader({ store, user, now, registerOpen, canOpenRegister, onLogout }: POSHeaderProps) {
  const quick = store.settings.posMode === 'quick'

  return (
    <>
      <header className="glass z-20 mx-3 mt-3 flex h-[64px] shrink-0 items-center gap-3 rounded-2xl px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {store.logo
            ? <img src={store.logo} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
            : <AppIcon name={store.icon} color={store.iconColor} size={19} className="h-10 w-10 rounded-xl" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-bold tracking-tight text-ink">{store.name}</span>
              <Badge tone={quick ? 'info' : 'accent'} className="hidden sm:inline-flex">
                {quick ? <Zap className="h-3 w-3" /> : <ReceiptText className="h-3 w-3" />}
                {quick ? 'Quick' : 'Cashier'}
              </Badge>
            </div>
            <div className="text-[11px] text-muted">
              {store.city} · {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {user.name}
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle accent={store.settings.accent} defaultMode={store.settings.colorMode} />
          {(user.role === 'admin' || user.role === 'manager' || user.role === 'staff') && (
            <Link
              to={user.role === 'admin' || user.role === 'manager' ? '/admin' : '/staff'}
              className="hidden h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 sm:inline-flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
          )}
          {store.settings.features.tables && (
            <Link
              to="/pos/floor"
              className="hidden h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 sm:inline-flex"
            >
              <Users className="h-3.5 w-3.5" /> Floor
            </Link>
          )}
          {(user.role === 'staff' || user.role === 'manager') && (
            <>
              <Link
                to="/admin/customers"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 sm:px-3"
                title="Regulars & tabs"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Regulars</span>
              </Link>
              <Link
                to="/admin/orders"
                className="hidden h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 sm:inline-flex"
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
            className="rounded-xl border border-line p-2 text-muted transition hover:bg-cream-100 hover:text-ink"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {!registerOpen && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-amber/40 bg-brand-amber-soft px-4 py-2.5 text-[12.5px] text-brand-navy sm:px-5">
          <span>{canOpenRegister ? 'Open the register before taking orders.' : 'The register is closed. Ask a manager to open it before taking orders.'}</span>
          {canOpenRegister && (
            <Link
              to="/admin/register"
              className="shrink-0 rounded-lg bg-brand-amber px-3 py-1.5 font-semibold text-brand-navy hover:bg-brand-amber-hover"
            >
              Open register
            </Link>
          )}
        </div>
      )}

    </>
  )
}

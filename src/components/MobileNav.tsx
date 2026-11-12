import { BarChart3, LayoutDashboard, Plus, ReceiptText, Settings, ShoppingBag, Store, Users } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { cn } from '../lib/utils'

export function MobileNav() {
  const { user } = useApp()
  if (!user) return null
  const isSuper = user.role === 'super'
  const items = isSuper
    ? [{ to: '/super', label: 'Overview', icon: LayoutDashboard, end: true }, { to: '/super/stores', label: 'Stores', icon: Store }]
    : user.role === 'staff'
      ? [
          { to: '/staff', label: 'Home', icon: LayoutDashboard, end: true },
          { to: '/pos', label: 'POS', icon: ShoppingBag },
          { to: '/admin/orders', label: 'Orders', icon: ReceiptText },
          { to: '/admin/customers', label: 'Tabs', icon: Users },
          ...(user.permissions.register ? [{ to: '/admin/register', label: 'Register', icon: BarChart3 }] : []),
        ].slice(0, 5)
      : [
          { to: '/admin', label: 'Home', icon: LayoutDashboard, end: true },
          { to: '/pos', label: 'POS', icon: ShoppingBag },
          { to: '/admin/orders', label: 'Orders', icon: ReceiptText },
          { to: '/admin/customers', label: 'Tabs', icon: Users },
          { to: '/admin/settings', label: 'Settings', icon: Settings },
        ]
  return (
    <>
      <nav className="glass-strong fixed inset-x-2 bottom-2 z-30 grid grid-cols-5 rounded-2xl px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 lg:hidden" aria-label="Primary">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-semibold focus-visible:ring-2 focus-visible:ring-brand-amber', isActive ? 'text-brand-navy dark:text-brand-amber' : 'text-muted')}>
            {({ isActive }) => <><span className={cn('flex h-7 w-8 items-center justify-center rounded-lg', isActive ? 'bg-brand-amber-soft dark:bg-amber-950/60' : 'bg-cream-100 dark:bg-espresso-900')}><Icon className="h-4 w-4" /></span>{label}</>}
          </NavLink>
        ))}
      </nav>
      {!isSuper && <Link to="/pos" aria-label="New sale" title="New sale" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-amber to-brand-amber-hover text-brand-navy shadow-lg shadow-brand-navy/20 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber-focus focus-visible:ring-offset-2 lg:hidden">
        <Plus className="h-5 w-5" />
      </Link>}
    </>
  )
}

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Calculator,
  Coffee,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import { useApp } from '../store/AppStore'
import { Avatar, Badge } from './ui'
import { cn, fmtDate } from '../lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const titles: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/orders': 'Orders',
  '/admin/customers': 'Regulars & tabs',
  '/admin/products': 'Products',
  '/admin/staff': 'Team',
  '/admin/reports': 'Reports',
  '/admin/expenses': 'Expenses',
  '/admin/register': 'Cash register',
  '/admin/settings': 'Settings',
  '/super': 'Platform overview',
  '/super/stores': 'Stores',
}

export function AppShell() {
  const { user, store, logout, db } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  if (!user) return null

  const isSuper = user.role === 'super'
  const isStaff = user.role === 'staff'

  const groups: Array<{ label: string; items: NavItem[] }> = isSuper
    ? [
        {
          label: 'Platform',
          items: [
            { to: '/super', label: 'Overview', icon: LayoutDashboard, end: true },
            { to: '/super/stores', label: 'Stores', icon: StoreIcon },
          ],
        },
      ]
    : isStaff
      ? [
          {
            label: 'Workspace',
            items: [
              { to: '/pos', label: 'Take order', icon: ShoppingBag },
              { to: '/admin/orders', label: 'Orders', icon: ReceiptText },
              { to: '/admin/customers', label: 'Regulars', icon: Users },
              ...(user.permissions.register
                ? [{ to: '/admin/register', label: 'Cash register', icon: Calculator }]
                : []),
            ],
          },
        ]
      : [
          {
            label: 'Workspace',
            items: [
              { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
              { to: '/pos', label: 'Point of sale', icon: ShoppingBag },
              { to: '/admin/orders', label: 'Orders', icon: ReceiptText },
              { to: '/admin/customers', label: 'Regulars', icon: Users },
            ],
          },
          {
            label: 'Catalogue',
            items: [
              { to: '/admin/products', label: 'Products', icon: Package },
              { to: '/admin/staff', label: 'Team', icon: Users },
            ],
          },
          {
            label: 'Business',
            items: [
              { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
              { to: '/admin/expenses', label: 'Expenses', icon: Wallet },
              { to: '/admin/register', label: 'Cash register', icon: Calculator },
            ],
          },
          {
            label: 'Manage',
            items: [{ to: '/admin/settings', label: 'Settings', icon: Settings }],
          },
        ]

  const title = titles[location.pathname] ?? (location.pathname.startsWith('/admin') ? 'Workspace' : 'Kawa POS')
  const outstanding = db.ledger
    .filter((l) => l.storeId === store?.id)
    .reduce((acc, l) => acc + (l.type === 'charge' ? l.amount : -l.amount), 0)

  const sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden bg-espresso-900 text-cream-50 grain">
      <div className="relative flex items-center gap-2.5 px-5 pb-5 pt-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-accent-600 shadow-lg shadow-black/30">
          <Coffee className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />
        </div>
        <div className="leading-none">
          <div className="text-[17px] font-extrabold tracking-tight">
            kawa<span className="text-accent-500">.</span>
          </div>
          <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Point of sale
          </div>
        </div>
      </div>

      <div className="relative mx-3 mb-2 rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
        {isSuper ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <ShieldCheck className="h-4 w-4 text-accent-500" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold">Platform console</div>
              <div className="text-[10.5px] text-white/45">All stores · all data</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg">
              {store?.emoji ?? '🏪'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold">{store?.name}</div>
              <div className="flex items-center gap-1.5 text-[10.5px] text-white/45">
                <span className="capitalize">{store?.plan}</span>
                <span className="h-0.5 w-0.5 rounded-full bg-white/30" />
                <span className="inline-flex items-center gap-1">
                  {store?.settings.posMode === 'quick' ? (
                    <>
                      <Zap className="h-2.5 w-2.5" /> Quick order
                    </>
                  ) : (
                    <>
                      <ReceiptText className="h-2.5 w-2.5" /> Cashier
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 py-4 thin-scrollbar">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 px-2.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/30">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                      isActive
                        ? 'bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                        : 'text-white/55 hover:bg-white/[0.05] hover:text-white/90',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn('h-4 w-4 shrink-0', isActive ? 'text-accent-500' : 'text-white/40')}
                        strokeWidth={2}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.label === 'Regulars' && outstanding > 0 && !isSuper && (
                        <span className="rounded-full bg-accent-600/20 px-1.5 py-0.5 text-[9.5px] font-bold text-accent-500">
                          {Math.round(outstanding)}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-white/[0.07] p-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          <Avatar name={user.name} size="sm" className="bg-white/10 text-white" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold">{user.name}</div>
            <div className="text-[10.5px] capitalize text-white/40">{user.role}</div>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-espresso-900/50" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-[262px] animate-[slideLeft_.2s_ease-out]">{sidebar}</div>
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute left-[278px] top-4 rounded-full bg-white p-2 text-ink shadow-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-cream-100/85 backdrop-blur-md">
          <div className="mx-auto flex h-[62px] max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-line bg-white p-2 text-ink lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[16px] font-bold tracking-tight text-ink">{title}</h1>
              <p className="hidden text-[11.5px] text-muted sm:block">
                {isSuper ? 'Kawa POS · platform administration' : `${store?.name} · ${store?.city}`}
              </p>
            </div>
            <div className="hidden items-center gap-2 text-[12px] text-muted md:flex">
              <span className="rounded-lg border border-line bg-white px-2.5 py-1.5 font-medium">
                {fmtDate(now.toISOString())}
              </span>
            </div>
            {!isSuper && (
              <NavLink
                to="/pos"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent-600 px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-accent-700"
              >
                <Plus className="h-4 w-4" />
                New sale
              </NavLink>
            )}
            {isSuper && (
              <Badge tone="dark" className="hidden sm:inline-flex">
                <ShieldCheck className="h-3 w-3" /> Super admin
              </Badge>
            )}
            <Avatar name={user.name} size="sm" className="lg:hidden" />
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

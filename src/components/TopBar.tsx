import { useEffect, useState } from 'react'
import {
  Bell,
  CreditCard,
  Menu,
  PackageX,
  Settings,
  ShieldCheck,
  Clock3,
  UserRound,
  X,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { getDashboardNotices } from '../lib/dashboard'
import { BRAND_NAME } from '../lib/brand'
import { fmtDate, fmtTime } from '../lib/utils'
import { BrandLogo } from './BrandLogo'
import { ThemeToggle } from './ThemeToggle'
import { Avatar, Badge } from './ui'

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
  '/staff': 'My dashboard',
  '/super': 'Platform overview',
  '/super/stores': 'Stores',
}

export function TopBar({
  onMenu,
  onToggleSidebar,
}: {
  onMenu: () => void
  onToggleSidebar: () => void
}) {
  const { db, user, store, logout } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [now, setNow] = useState(() => new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  const [noticesOpen, setNoticesOpen] = useState(false)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  if (!user) return null

  const isSuper = user.role === 'super'
  const notices = store && user.role === 'admin' ? getDashboardNotices(db, store) : []
  const noticeCount = notices.reduce((total, notice) => total + notice.count, 0)
  const title = titles[location.pathname] ?? BRAND_NAME
  const profilePath = isSuper ? '/super' : user.role === 'admin' ? '/admin/settings' : '/staff'
  const activeMode = searchParams.get('channel') === 'dine-in' ? 'tables' : 'pos'
  const onSignOut = () => { logout(); navigate('/login') }

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 backdrop-blur-md dark:bg-espresso-800/95">
      <div className="mx-auto flex min-h-[68px] max-w-[1680px] items-center gap-2 px-3 sm:px-5 lg:px-7">
        <button
          type="button"
          onClick={() => {
            if (window.matchMedia('(min-width: 1024px)').matches) onToggleSidebar()
            else onMenu()
          }}
          className="rounded-xl border border-line bg-white p-2 text-ink shadow-sm hover:bg-cream-100 dark:bg-espresso-800"
          aria-label="Toggle navigation"
          title="Toggle navigation"
        ><Menu className="h-4 w-4" /></button>
        <BrandLogo size="sm" markOnly className="hidden h-9 w-9 overflow-hidden sm:flex [&_img]:h-9 [&_img]:w-9" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[14px] font-extrabold tracking-tight text-ink sm:text-[16px]">{title}</h1>
          <p className="hidden truncate text-[10.5px] text-muted sm:block">
            {isSuper ? `${BRAND_NAME} · platform administration` : `${store?.name ?? ''} · ${store?.city ?? ''}`}
          </p>
        </div>

        {!isSuper && store && (
          <div className="hidden items-center rounded-xl border border-line bg-cream-100 p-1 md:flex">
            <Link to="/pos" className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${activeMode === 'pos' ? 'bg-white text-ink shadow-sm dark:bg-espresso-700' : 'text-muted'}`}>POS</Link>
            {store.settings.features.tables && (
              <Link to="/pos?channel=dine-in" className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${activeMode === 'tables' ? 'bg-white text-ink shadow-sm dark:bg-espresso-700' : 'text-muted'}`}>Tables</Link>
            )}
          </div>
        )}
        <div className="hidden flex-col items-end text-[10.5px] leading-tight text-muted xl:flex">
          <span>{fmtDate(now.toISOString())}</span><span>{fmtTime(now.toISOString())}</span>
        </div>
        <ThemeToggle accent={store?.settings.accent} />
        {user.role === 'admin' && (
          <div className="relative">
            <button type="button" onClick={() => setNoticesOpen(!noticesOpen)} className="relative rounded-xl border border-line bg-white p-2 text-ink hover:bg-cream-100 dark:bg-espresso-800" aria-label="Notifications" aria-expanded={noticesOpen}>
              <Bell className="h-4 w-4" />
              {noticeCount > 0 && <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger-strong px-1 text-[9px] font-bold text-white">{noticeCount}</span>}
            </button>
            {noticesOpen && (
              <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-line bg-white p-2 shadow-xl dark:bg-espresso-800">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-bold">Notifications</span>
                  <button type="button" onClick={() => setNoticesOpen(false)} aria-label="Close notifications"><X className="h-3.5 w-3.5 text-muted" /></button>
                </div>
                {notices.length === 0 ? <p className="px-2 py-4 text-xs text-muted">You&apos;re all caught up.</p> : notices.map((notice) => {
                  const Icon = notice.id === 'stock' ? PackageX : notice.id === 'tabs' ? CreditCard : Clock3
                  return <Link key={notice.id} to={notice.href} onClick={() => setNoticesOpen(false)} className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-xs hover:bg-cream-100 dark:hover:bg-espresso-700">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tint text-brand-navy"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">{notice.label}</span><Badge tone="warning">{notice.count}</Badge>
                  </Link>
                })}
              </div>
            )}
          </div>
        )}
        {user.role === 'admin' && (
          <Link to="/admin/settings" aria-label="Settings" title="Settings" className="rounded-xl border border-line bg-white p-2 text-ink hover:bg-cream-100 dark:bg-espresso-800"><Settings className="h-4 w-4" /></Link>
        )}
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 rounded-xl border border-line bg-white p-1.5 pr-2 text-left hover:bg-cream-100 dark:bg-espresso-800" aria-label="User menu" aria-expanded={menuOpen}>
            <Avatar name={user.name} size="sm" />
            <span className="hidden max-w-24 truncate text-[11px] font-bold text-ink lg:block">{user.name.split(' ')[0]}</span>
          </button>
          {menuOpen && <div className="absolute right-0 top-12 z-40 w-48 rounded-2xl border border-line bg-white p-1.5 shadow-xl dark:bg-espresso-800">
            <div className="border-b border-line px-2.5 py-2">
              <p className="truncate text-xs font-bold">{user.name}</p><p className="text-[10px] capitalize text-muted">{user.role}</p>
            </div>
            <Link to={profilePath} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs hover:bg-cream-100 dark:hover:bg-espresso-700"><UserRound className="h-3.5 w-3.5" /> Profile</Link>
            <button type="button" onClick={onSignOut} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-cream-100 dark:hover:bg-espresso-700"><ShieldCheck className="h-3.5 w-3.5" /> Switch user / log out</button>
          </div>}
        </div>
      </div>
    </header>
  )
}

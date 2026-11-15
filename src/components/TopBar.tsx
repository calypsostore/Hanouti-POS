import { useEffect, useState } from 'react'
import {
  Bell,
  CreditCard,
  ChefHat,
  Menu,
  PackageX,
  Printer,
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
import { AppIcon } from './AppIcon'
import { BrandLogo } from './BrandLogo'
import { ThemeToggle } from './ThemeToggle'
import { InstallAppButton } from './InstallAppButton'
import { Avatar, Badge } from './ui'
import { can } from '../lib/permissions'
import { hasPrintCapability } from '../lib/printQueue'
import { useToast } from './toast'
import { ReprintLastReceipt } from './ReprintLastReceipt'

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
}: {
  onMenu: () => void
}) {
  const { db, user, store, logout, providerMode, providerStatus, printPendingHere, acknowledgeProviderConflicts } = useApp()
  const { push } = useToast()
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
  const notices = store && can(user, 'viewReports') ? getDashboardNotices(db, store) : []
  const readyOrders = store
    ? db.openOrders.filter((order) => order.storeId === store.id && order.staffId === user.id &&
        order.items.some((item) => item.status === 'ready'))
    : []
  const readyCount = readyOrders.reduce((total, order) =>
    total + order.items.filter((item) => item.status === 'ready').reduce((sum, item) => sum + item.qty, 0), 0)
  const noticeCount = notices.reduce((total, notice) => total + notice.count, 0) + readyCount
  const localFailedPrintCount = store
    ? db.printJobs.filter((job) => job.storeId === store.id && job.status === 'failed').length
    : 0
  const failedPrintCount = providerMode === 'hub'
    ? Math.max(localFailedPrintCount, providerStatus.failedPrintCount)
    : localFailedPrintCount
  const localPrinterAvailable = store && db.printers.some((printer) =>
    printer.storeId === store.id && printer.enabled && printer.connection === 'browser-webserial' &&
    hasPrintCapability(printer),
  )
  const queuedHubPrint = store && providerStatus.pendingPrintCount > 0
    ? db.printJobs.find((job) => job.storeId === store.id && job.status === 'queued')
    : undefined
  const connectionLabel = providerStatus.connection === 'connected'
    ? 'Hub connected'
    : providerStatus.connection === 'internet-offline'
      ? 'Internet offline · hub is fine'
      : 'Hub offline · working locally'
  const connectionTone = providerStatus.connection === 'connected'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : providerStatus.connection === 'internet-offline'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-rose-200 bg-rose-50 text-rose-800'
  const title = titles[location.pathname] ?? BRAND_NAME
  const profilePath = isSuper ? '/super' : can(user, 'manageSettings') ? '/admin/settings' : user.role === 'manager' ? '/admin' : '/staff'
  const activeMode = searchParams.get('channel') === 'dine-in' ? 'tables' : 'pos'
  const onSignOut = () => { logout(); navigate('/login') }

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/60 backdrop-blur-md dark:bg-espresso-800/60">
      <div className="mx-auto flex min-h-[68px] max-w-[1680px] items-center gap-2 px-3 sm:px-5 lg:px-7">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-xl border border-line bg-white p-2 text-ink shadow-sm hover:bg-cream-100 dark:bg-espresso-800 lg:hidden"
          aria-label="Toggle navigation"
          title="Toggle navigation"
        ><Menu className="h-4 w-4" /></button>
        {!isSuper && store
          ? store.logo
            ? <img src={store.logo} alt={`${store.name} logo`} className="hidden h-9 w-9 shrink-0 rounded-xl object-cover sm:block" />
            : <AppIcon name={store.icon} color={store.iconColor} size={16} className="hidden h-9 w-9 rounded-xl sm:inline-flex" />
          : <BrandLogo size="sm" markOnly className="hidden h-9 w-9 overflow-hidden sm:flex [&_img]:h-9 [&_img]:w-9" />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[14px] font-extrabold tracking-tight text-ink sm:text-[16px]">{title}</h1>
          <p className="hidden truncate text-[10.5px] text-muted sm:block">
            {isSuper ? `${BRAND_NAME} · platform administration` : `${store?.name ?? ''} · ${store?.city ?? ''}`}
          </p>
        </div>

        {!isSuper && store && (
          <div className="hidden items-center rounded-xl border border-line bg-cream-100 p-1 dark:bg-espresso-900 md:flex">
            <Link to="/pos" className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${activeMode === 'pos' ? 'bg-white text-ink shadow-sm dark:bg-espresso-700' : 'text-muted'}`}>POS</Link>
            {store.settings.features.tables && (
              <Link to="/pos?channel=dine-in&focus=table" className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${activeMode === 'tables' ? 'bg-white text-ink shadow-sm dark:bg-espresso-700' : 'text-muted'}`}>Tables</Link>
            )}
          </div>
        )}
        <div className="hidden flex-col items-end text-[10.5px] leading-tight text-muted xl:flex">
          <span>{fmtDate(now.toISOString())}</span><span>{fmtTime(now.toISOString())}</span>
        </div>
        <ThemeToggle accent={store?.settings.accent} defaultMode={store?.settings.colorMode} />
        <InstallAppButton />
        {!isSuper && store && <div className="hidden sm:block"><ReprintLastReceipt /></div>}
        <div
          className={`max-w-40 truncate rounded-lg border px-2 py-1 text-[9px] font-bold leading-tight sm:max-w-none sm:text-[10px] ${providerMode === 'hub' ? connectionTone : 'border-line bg-cream-100 text-muted'}`}
          role="status"
          aria-live="polite"
          title={providerMode === 'hub' ? connectionLabel : 'Local data on this device'}
        >
          {providerMode === 'hub'
            ? `${connectionLabel}${providerStatus.pendingCount ? ` · ${providerStatus.pendingCount} changes waiting` : ''}${providerStatus.lastError ? ` · ${providerStatus.lastError}` : ''}`
            : 'This device'}
        </div>
        {providerMode === 'hub' && providerStatus.connection === 'offline' &&
          providerStatus.pendingPrintCount > 0 && !localPrinterAvailable && (
            <span
              className="max-w-40 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-900 sm:max-w-64"
              role="status"
              title="Print jobs remain queued on this device until the hub reconnects or a local WebSerial printer is configured."
            >
              Print queued · reconnect hub or configure local printer
            </span>
          )}
        {providerMode === 'hub' && store && (
          <div className="flex max-w-32 gap-1 overflow-x-auto sm:max-w-56" aria-label="Hub printer status">
            {db.printers.filter((printer) => printer.storeId === store.id && printer.enabled).map((printer) => {
              const status = providerStatus.printerStatuses[printer.id] ?? 'offline'
              const tone = status === 'online'
                ? 'bg-emerald-100 text-emerald-800'
                : status === 'error'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-100 text-slate-700'
              return <span key={printer.id} className={`shrink-0 rounded-full px-1.5 py-1 text-[9px] font-semibold ${tone}`} title={`${printer.name}: ${status}`} aria-label={`${printer.name}: ${status}`}>
                {printer.name.slice(0, 7)} · {status}
              </span>
            })}
          </div>
        )}
        {providerMode === 'hub' && providerStatus.connection === 'offline' &&
          providerStatus.pendingPrintCount > 0 && queuedHubPrint && localPrinterAvailable && (
            <button
              type="button"
              onClick={() => {
                void printPendingHere(queuedHubPrint.id).then((result) => {
                  push(result.ok ? 'Print sent to this device.' : result.error, result.ok ? 'success' : 'error')
                }).catch((error: unknown) => {
                  push(error instanceof Error ? error.message : 'Local printing failed.', 'error')
                })
              }}
              className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-900"
              title="Send the oldest unattempted hub print job to a local WebSerial printer"
            >
              Print here instead
            </button>
          )}
        {providerMode === 'hub' && providerStatus.conflicts.length > 0 && (
          <Link
            to="/admin/products"
            onClick={acknowledgeProviderConflicts}
            className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-900"
            title={`Another phone changed ${providerStatus.conflicts.join(', ')}. The hub's latest edit is active; review the menu.`}
          >
            Review menu conflict
          </Link>
        )}
        {(can(user, 'viewReports') || readyOrders.length > 0) && (
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
                {readyOrders.map((order) => {
                  const count = order.items.filter((item) => item.status === 'ready').reduce((sum, item) => sum + item.qty, 0)
                  return <Link key={order.id} to={`/pos?channel=dine-in&focus=table&orderId=${encodeURIComponent(order.id)}`} onClick={() => setNoticesOpen(false)} className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-xs hover:bg-cream-100 dark:hover:bg-espresso-700">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tint text-accent-foreground"><ChefHat className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">{order.tableName} · items ready</span><Badge tone="success">{count}</Badge>
                  </Link>
                })}
                {notices.length === 0 && readyOrders.length === 0 ? <p className="px-2 py-4 text-xs text-muted">You&apos;re all caught up.</p> : notices.map((notice) => {
                  const Icon = notice.id === 'stock' ? PackageX : notice.id === 'tabs' ? CreditCard : Clock3
                  return <Link key={notice.id} to={notice.href} onClick={() => setNoticesOpen(false)} className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-xs hover:bg-cream-100 dark:hover:bg-espresso-700">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tint text-accent-foreground"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">{notice.label}</span><Badge tone="warning">{notice.count}</Badge>
                  </Link>
                })}
              </div>
            )}
          </div>
        )}
        {can(user, 'manageSettings') && (
          <Link to="/admin/settings" aria-label="Settings" title="Settings" className="rounded-xl border border-line bg-white p-2 text-ink hover:bg-cream-100 dark:bg-espresso-800"><Settings className="h-4 w-4" /></Link>
        )}
        {failedPrintCount > 0 && (
          <Link to="/admin/settings?tab=devices" aria-label={`${failedPrintCount} prints failed`} title={`${failedPrintCount} prints failed`} className="flex items-center gap-1 rounded-xl border border-danger/30 bg-danger/5 px-2 py-1.5 text-danger">
            <Printer className="h-4 w-4" /><Badge tone="danger">{failedPrintCount}</Badge>
          </Link>
        )}
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 rounded-xl border border-line bg-white p-1.5 pr-2 text-left hover:bg-cream-100 dark:bg-espresso-800" aria-label="User menu" aria-expanded={menuOpen}>
            <Avatar name={user.name} photo={user.photo} size="sm" />
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

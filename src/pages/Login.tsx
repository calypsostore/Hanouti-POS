import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  Store as StoreIcon,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { Button, Field, Input, Segmented } from '../components/ui'
import { cn, money } from '../lib/utils'
import { BRAND_NAME } from '../lib/brand'
import { BrandLogo } from '../components/BrandLogo'
import { ThemeToggle } from '../components/ThemeToggle'
import { InstallAppButton } from '../components/InstallAppButton'
import { APP_BUILD_TIMESTAMP, APP_VERSION } from '../lib/appVersion'
import { DB_KEY } from '../store/database'
import type { User } from '../types'
import { PIN_MAX_LENGTH, PIN_RANGE_HINT } from '../shared/pin'

type DemoAccount = {
  role: 'Super admin' | 'Store admin' | 'Staff'
  name: string
  email?: string
  username?: string
  pin?: string
  icon: LucideIcon
  desc: string
}

const demoAccounts: DemoAccount[] = [
  {
    role: 'Super admin',
    name: 'Platform Owner',
    email: 'owner@cafepos.tn',
    icon: ShieldCheck,
    desc: 'Every store, every number',
  },
  {
    role: 'Store admin',
    name: 'Sami · Café Yasmine',
    email: 'sami@cafeyasmine.tn',
    icon: StoreIcon,
    desc: 'Full control of one café',
  },
  {
    role: 'Staff',
    name: 'Amine · Café Yasmine',
    username: 'amine.yasmine',
    pin: '1234',
    icon: Users,
    desc: 'amine.yasmine · PIN 1234',
  },
]

export default function Login() {
  const { db, login, loginPin, databaseReady, databaseError, providerMode } = useApp()
  const navigate = useNavigate()
  const [method, setMethod] = useState<'email' | 'pin'>('email')
  const [email, setEmail] = useState('sami@cafeyasmine.tn')
  const [password, setPassword] = useState('password')
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState('amine.yasmine')
  const [pin, setPin] = useState('1234')
  const [storeCode, setStoreCode] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canSubmit = databaseReady && !databaseError && !isSubmitting

  const go = (role: string, account?: User) => {
    if (account?.stationOnly) {
      navigate(account.stationId ? `/station/${encodeURIComponent(account.stationId)}` : '/kitchen')
    } else if (account?.goStraightToStation && account.stationId) {
      navigate(`/station/${encodeURIComponent(account.stationId)}`)
    } else if (role === 'super') navigate('/super')
    else if (role === 'staff') navigate('/pos')
    else navigate('/admin')
  }

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setIsSubmitting(true)
    try {
      const res = await login(email, password, storeCode)
      if (!res.ok) {
        setError(res.error)
        return
      }
      const account = res.user ?? db.users.find((candidate) => candidate.email?.toLowerCase() === email.trim().toLowerCase())
      const target = account?.role ?? (email.toLowerCase() === 'owner@cafepos.tn' ? 'super' : 'admin')
      go(target, account)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign in failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setIsSubmitting(true)
    try {
      const res = await loginPin(username, pin, storeCode)
      if (!res.ok) {
        setError(res.error)
        return
      }
      const account = res.user ?? db.users.find((candidate) => candidate.username?.toLowerCase() === username.trim().toLowerCase())
      go(account?.role ?? 'staff', account)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign in failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const quickLogin = async (account: DemoAccount) => {
    if (!canSubmit) return
    setError('')
    setIsSubmitting(true)
    try {
      const res = account.role === 'Staff'
        ? await loginPin(account.username ?? '', account.pin ?? '')
        : await login(account.email ?? '', 'password')
      if (!res.ok) {
        setError(res.error)
        return
      }
      const user = res.user ?? (account.role === 'Staff'
        ? db.users.find((candidate) => candidate.username === account.username)
        : db.users.find((candidate) => candidate.email === account.email))
      go(user?.role ?? (account.role === 'Super admin' ? 'super' : account.role === 'Staff' ? 'staff' : 'admin'), user)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign in failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen bg-cream-100">
      <ThemeToggle accent="7anouti" className="absolute right-5 top-5 z-20 sm:right-8 sm:top-8" />
      {/* Brand panel */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-espresso-900 p-10 text-cream-50 brand-gradient grain lg:flex xl:p-14">
        <div className="relative flex items-center gap-3">
          <BrandLogo size="md" variant="dark" />
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/55">7anouti-POS</span>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-[42px] font-extrabold leading-[1.05] tracking-[-0.03em] xl:text-[50px]">
            Every shop runs
            <br />
            better on <span className="text-brand-amber">{BRAND_NAME}</span>
          </h1>
          <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-white/55">
            Take orders, track tabs, print receipts and see exactly how your business is doing —
            all from one beautifully simple place.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { icon: CreditCard, text: 'Cash, card or on account' },
              { icon: BarChart3, text: 'Daily, weekly, yearly reports' },
              { icon: Users, text: 'Staff logins with PIN' },
              { icon: ShieldCheck, text: 'Isolated per-store data' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-2.5 text-[12.5px] text-white/60">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.07]">
                  <f.icon className="h-3.5 w-3.5 text-brand-amber" />
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  Today · Café Yasmine
                </div>
                <div className="mt-1 text-[26px] font-extrabold tracking-tight">
                  {money(842.5)}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--semantic-green-soft)] px-2 py-1 text-[10px] font-bold text-[var(--semantic-green-text)]">
                +12.4%
              </div>
            </div>
            <div className="mt-3 flex h-12 items-end gap-1.5">
              {[38, 55, 30, 62, 48, 75, 58, 82, 66, 92, 71, 88, 60, 78, 52, 68, 84, 96].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-brand-amber/80"
                  style={{ height: `${h}%`, opacity: 0.35 + (i / 18) * 0.65 }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10.5px] text-white/35">
              <span>07:00</span>
              <span>128 orders served</span>
              <span>20:00</span>
            </div>
          </div>
          <div className="mt-5 grid max-w-md grid-cols-2 gap-3">
            <button
              type="button"
              disabled
              aria-label="Android app download coming soon"
              className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2.5 text-left opacity-80"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-[#3DDC84]">
                <path d="M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3197.5506 1.0577.1563 1.6504-.394.5926-1.1038.8138-1.584.4941-.48-.3197-.5503-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z" />
              </svg>
              <span>
                <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">Android app</span>
                <span className="block text-[11px] font-bold text-white">APK coming soon</span>
              </span>
            </button>
            <button
              type="button"
              disabled
              aria-label="iOS app download coming soon"
              className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2.5 text-left opacity-80"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-white">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
              </svg>
              <span>
                <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">iOS app</span>
                <span className="block text-[11px] font-bold text-white">App Store soon</span>
              </span>
            </button>
          </div>
          <p className="mt-4 text-[11px] text-white/30">
            © 2026 {BRAND_NAME} · One POS for every kind of shop
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="glass-strong w-full max-w-[500px] rounded-[30px] p-5 sm:p-8">
          <div className="mb-8 flex items-center justify-between gap-2.5 lg:hidden">
            <BrandLogo size="md" />
            <InstallAppButton />
          </div>

          <h2 className="text-[28px] font-extrabold tracking-[-0.03em] text-ink">Welcome back</h2>
          <p className="mt-1.5 text-[13.5px] text-muted">
            Sign in to your workspace to start the day.
          </p>
          <p className="mt-2 text-[11px] font-semibold text-muted">
            Data mode: {providerMode === 'hub' ? 'Shop hub' : 'This device'}
          </p>

          <div className="mt-6">
            <Segmented
              value={method}
              onChange={(v) => {
                setMethod(v)
                setError('')
              }}
              options={[
                { value: 'email', label: 'Email sign in' },
                { value: 'pin', label: 'Staff PIN' },
              ]}
              className="w-full [&>button]:flex-1"
            />
          </div>

          {databaseError ? (
            <div role="alert" className="mt-4 rounded-xl border border-[var(--semantic-rose-border)] bg-[var(--semantic-rose-soft)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--semantic-rose-text)]">
              Could not load the local database: {databaseError}
            </div>
          ) : !databaseReady ? (
            <p role="status" className="mt-4 text-center text-xs text-muted">
              Preparing the demo workspace. Sign-in will be available shortly.
            </p>
          ) : error ? (
            <div role="alert" className="mt-4 rounded-xl border border-[var(--semantic-rose-border)] bg-[var(--semantic-rose-soft)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--semantic-rose-text)]">
              {error}
            </div>
          ) : null}

          {method === 'email' ? (
            <form onSubmit={submitEmail} className="mt-5 space-y-4">
              {providerMode === 'hub' && (
                <Field label="Store code">
                  <Input value={storeCode} onChange={(event) => setStoreCode(event.target.value.toLowerCase())} placeholder="your-store-code" autoComplete="organization" required />
                </Field>
              )}
              <Field label="Email address">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    placeholder="you@yourcafe.tn"
                    autoComplete="email"
                    required
                  />
                </div>
              </Field>
              <Field label="Password" hint={providerMode === 'local' ? 'Demo: password' : undefined}>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={!canSubmit} loading={!databaseReady || isSubmitting}>
                {databaseReady ? 'Sign in' : 'Preparing demo…'} {!isSubmitting && databaseReady && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitPin} className="mt-5 space-y-4">
              {providerMode === 'hub' && (
                <Field label="Store code">
                  <Input value={storeCode} onChange={(event) => setStoreCode(event.target.value.toLowerCase())} placeholder="your-store-code" autoComplete="organization" required />
                </Field>
              )}
              <Field label="Username" hint={providerMode === 'local' ? 'Demo: amine.yasmine' : undefined}>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="username"
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="PIN" hint={providerMode === 'local' ? `${PIN_RANGE_HINT} · Demo: 1234` : PIN_RANGE_HINT}>
                <Input
                  value={pin}
                  maxLength={PIN_MAX_LENGTH}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH))}
                  placeholder="••••"
                  inputMode="numeric"
                  className="text-center text-lg font-bold tracking-[0.5em]"
                  required
                />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={!canSubmit} loading={!databaseReady || isSubmitting}>
                {databaseReady ? 'Open register' : 'Preparing demo…'} {!isSubmitting && databaseReady && <ArrowRight className="h-4 w-4" />}
              </Button>
              <p className="text-center text-[11.5px] text-muted">
                Staff PINs are created by your store admin.
              </p>
            </form>
          )}

          {providerMode === 'local' && <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted/70">
              Explore the demo
            </span>
            <div className="h-px flex-1 bg-line" />
          </div>}

          {providerMode === 'local' && <div className="space-y-2">
            {demoAccounts.map((a) => (
              <button
                key={a.role}
                onClick={() => quickLogin(a)}
                disabled={!canSubmit}
                className={cn(
                  'glass-subtle group flex w-full items-center gap-3 rounded-2xl border border-line/70 bg-transparent px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                  'hover:border-accent-foreground/40 hover:shadow-sm',
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream-200 text-muted transition group-hover:bg-accent-50 group-hover:text-accent-foreground">
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-ink">{a.name}</span>
                    <span className="rounded-full bg-cream-200 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted">
                      {a.role}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-muted">{a.desc}</div>
                </div>
                <Check className="h-4 w-4 text-line opacity-0 transition group-hover:text-accent-foreground group-hover:opacity-100" />
              </button>
            ))}
          </div>}

          <p className="mt-5 text-center text-[10.5px] leading-relaxed text-muted/80">
            {providerMode === 'hub'
              ? 'The shop hub is the sync authority. This device keeps an encrypted-session local data cache for offline work.'
              : 'Data is stored in this browser/device. Staff must use the same device or import the store backup.'}
            <br />
            {providerMode === 'local' && <>Owner/admin demo password: <span className="font-semibold text-muted">password</span>.</>}
          </p>
          <p className="mt-3 break-all text-center text-[9.5px] leading-relaxed text-muted/70">
            App {APP_VERSION} · Database {DB_KEY} · Built {APP_BUILD_TIMESTAMP}
          </p>
        </div>
      </div>
    </div>
  )
}

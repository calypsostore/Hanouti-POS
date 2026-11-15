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
              <Field label="Password" hint="Demo: password">
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
              <Field label="Username" hint="Demo: amine.yasmine">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="username"
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="PIN" hint="4–6 digits · Demo: 1234">
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
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

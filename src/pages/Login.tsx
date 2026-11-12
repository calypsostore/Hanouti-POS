import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Check,
  Coffee,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  Sparkles,
  Store as StoreIcon,
  Users,
} from 'lucide-react'
import { useApp } from '../store/AppStore'
import { Button, Field, Input, Segmented } from '../components/ui'
import { cn, money } from '../lib/utils'

const demoAccounts = [
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
    email: 'amine@cafeyasmine.tn',
    icon: Users,
    desc: 'Counter, orders & tabs',
  },
]

export default function Login() {
  const { login, loginPin } = useApp()
  const navigate = useNavigate()
  const [method, setMethod] = useState<'email' | 'pin'>('email')
  const [email, setEmail] = useState('sami@cafeyasmine.tn')
  const [password, setPassword] = useState('password')
  const [showPassword, setShowPassword] = useState(false)
  const [slug, setSlug] = useState('yasmine')
  const [pin, setPin] = useState('1234')
  const [error, setError] = useState('')

  const go = (role: string) => {
    if (role === 'super') navigate('/super')
    else if (role === 'staff') navigate('/pos')
    else navigate('/admin')
  }

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = login(email, password)
    if (!res.ok) return setError(res.error)
    const target = email.toLowerCase() === 'owner@cafepos.tn' ? 'super' : email.includes('amine') ? 'staff' : 'admin'
    go(target)
  }

  const submitPin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = loginPin(slug, pin)
    if (!res.ok) return setError(res.error)
    go('staff')
  }

  const quickLogin = (accountEmail: string, role: string) => {
    setError('')
    const res = login(accountEmail, 'password')
    if (!res.ok) return setError(res.error)
    go(role === 'Super admin' ? 'super' : role === 'Staff' ? 'staff' : 'admin')
  }

  return (
    <div className="flex min-h-screen bg-cream-100">
      {/* Brand panel */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-espresso-900 p-10 text-cream-50 brand-gradient grain lg:flex xl:p-14">
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 shadow-lg shadow-black/30">
            <Coffee className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-[19px] font-extrabold leading-none tracking-tight">
              kawa<span className="text-accent-500">.</span>
            </div>
            <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Point of sale
            </div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-accent-500" />
            Built for Tunisian cafés
          </div>
          <h1 className="text-[42px] font-extrabold leading-[1.05] tracking-[-0.03em] xl:text-[50px]">
            Every café runs
            <br />
            better on <span className="text-accent-500">kawa.</span>
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
                  <f.icon className="h-3.5 w-3.5 text-accent-500" />
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
              <div className="rounded-lg bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-400">
                +12.4%
              </div>
            </div>
            <div className="mt-3 flex h-12 items-end gap-1.5">
              {[38, 55, 30, 62, 48, 75, 58, 82, 66, 92, 71, 88, 60, 78, 52, 68, 84, 96].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-accent-600/70"
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
            © 2026 Kawa POS · Made for cafés, snacks & salons de thé
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600">
              <Coffee className="h-5 w-5 text-white" />
            </div>
            <div className="text-[18px] font-extrabold tracking-tight">
              kawa<span className="text-accent-500">.</span>
            </div>
          </div>

          <h2 className="text-[26px] font-extrabold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-1.5 text-[13.5px] text-muted">
            Sign in to your workspace to start the day.
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

          {method === 'email' ? (
            <form onSubmit={submitEmail} className="mt-5 space-y-4">
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
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] font-medium text-red-700">
                  {error}
                </div>
              )}
              <Button type="submit" size="lg" className="w-full">
                Sign in <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={submitPin} className="mt-5 space-y-4">
              <Field label="Store code" hint="e.g. yasmine">
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="store code"
                  required
                />
              </Field>
              <Field label="4-digit PIN" hint="Demo: 1234">
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  inputMode="numeric"
                  className="text-center text-lg font-bold tracking-[0.5em]"
                  required
                />
              </Field>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] font-medium text-red-700">
                  {error}
                </div>
              )}
              <Button type="submit" size="lg" className="w-full">
                Open register <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-[11.5px] text-muted">
                Staff PINs are created by your store admin.
              </p>
            </form>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted/70">
              Explore the demo
            </span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <div className="space-y-2">
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                onClick={() => quickLogin(a.email, a.role)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 text-left transition',
                  'hover:border-accent-500/40 hover:shadow-sm',
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream-200 text-muted transition group-hover:bg-accent-50 group-hover:text-accent-600">
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
                <Check className="h-4 w-4 text-line opacity-0 transition group-hover:text-accent-500 group-hover:opacity-100" />
              </button>
            ))}
          </div>

          <p className="mt-5 text-center text-[10.5px] leading-relaxed text-muted/80">
            Demo workspace · all data is stored locally in your browser.
            <br />
            Passwords are <span className="font-semibold text-muted">password</span>.
          </p>
        </div>
      </div>
    </div>
  )
}

import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'
import { ChevronDown, Loader2, X } from 'lucide-react'
import { cn, initials } from '../lib/utils'

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-600 text-white shadow-sm hover:bg-accent-700 active:translate-y-px disabled:bg-accent-600/50',
  secondary:
    'bg-white text-ink border border-line shadow-sm hover:bg-cream-100 active:translate-y-px disabled:opacity-50',
  ghost: 'text-muted hover:bg-cream-200/70 hover:text-ink disabled:opacity-40',
  danger: 'bg-danger text-white shadow-sm hover:bg-danger/90 active:translate-y-px disabled:opacity-50',
  dark: 'bg-espresso-900 text-cream-50 shadow-sm hover:bg-espresso-800 active:translate-y-px disabled:opacity-50',
  outline: 'border border-white/25 text-white hover:bg-white/10 disabled:opacity-40',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-2',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-line/80 bg-white shadow-[0_1px_2px_rgba(36,30,25,0.04)]', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ---------------------------------- Badge ---------------------------------- */

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'info' | 'dark'

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-cream-200 text-muted',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-1 ring-red-600/15',
  accent: 'bg-accent-50 text-accent-700 ring-1 ring-accent-600/15',
  info: 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/15',
  dark: 'bg-espresso-900 text-cream-50',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5 tracking-wide',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn('h-1.5 w-1.5 rounded-full', className)} />
}

/* ---------------------------------- Inputs --------------------------------- */

export const inputClass =
  'h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/60 outline-none transition focus:border-accent-500/60 focus:ring-4 focus:ring-accent-500/10 disabled:bg-cream-100'

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label?: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="mb-1.5 flex items-baseline justify-between text-[12.5px] font-semibold text-ink">
          {label}
          {hint && <span className="text-[11px] font-normal text-muted">{hint}</span>}
        </span>
      )}
      {children}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(inputClass, 'h-auto min-h-[84px] resize-y py-2.5 leading-relaxed', className)}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(inputClass, 'appearance-none pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40',
          checked ? 'bg-accent-600' : 'bg-espresso-900/15',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200',
            checked ? 'left-[19px]' : 'left-[3px]',
          )}
        />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-[13.5px] font-semibold text-ink">{label}</span>}
          {description && <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{description}</span>}
        </span>
      )}
    </label>
  )
}

/* ---------------------------------- Avatar --------------------------------- */

const avatarPalette = [
  'bg-accent-100 text-accent-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

export function Avatar({
  name,
  size = 'md',
  emoji,
  className,
}: {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  emoji?: string
  className?: string
}) {
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % avatarPalette.length
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-10 w-10 text-[13px]',
    lg: 'h-12 w-12 text-[15px]',
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        emoji ? 'bg-cream-200 text-lg' : avatarPalette[idx],
        sizes[size],
        className,
      )}
    >
      {emoji ?? initials(name)}
    </span>
  )
}

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
}: {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlay?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-espresso-900/45 backdrop-blur-[3px] animate-[fadeIn_.15s_ease-out]"
        onClick={closeOnOverlay ? onClose : undefined}
      />
      <div
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl',
          'animate-[slideUp_.22s_cubic-bezier(0.16,1,0.3,1)]',
          widths[size],
        )}
        role="dialog"
        aria-modal="true"
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4 sm:px-6">
            <div>
              {title && <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="-mr-1 rounded-lg p-1.5 text-muted transition hover:bg-cream-200 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="border-t border-line/70 bg-cream-50 px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------------------------------- Drawer --------------------------------- */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-xl',
}: {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-espresso-900/40 backdrop-blur-[2px] animate-[fadeIn_.15s_ease-out]"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative flex h-full w-full flex-col bg-cream-50 shadow-2xl animate-[slideLeft_.25s_cubic-bezier(0.16,1,0.3,1)]',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line bg-white px-6 py-5">
          <div>
            {title && <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-cream-200 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line bg-white px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

/* ----------------------------------- Tabs ---------------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: ReactNode }>
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl border border-line bg-cream-100 p-0.5',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[9px] font-semibold transition',
            size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]',
            value === o.value
              ? 'bg-white text-ink shadow-sm ring-1 ring-line/60'
              : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------- Stat ----------------------------------- */

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'neutral',
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'danger'
  className?: string
}) {
  const tones = {
    neutral: 'bg-cream-200 text-espresso-800',
    accent: 'bg-accent-50 text-accent-600',
    success: 'bg-emerald-50 text-emerald-600',
    danger: 'bg-red-50 text-red-500',
  }
  return (
    <Card className={cn('p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">{label}</div>
          <div className="mt-2 truncate text-[22px] font-bold leading-tight tracking-tight text-ink">
            {value}
          </div>
          {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
        </div>
        {icon && <div className={cn('rounded-xl p-2', tones[tone])}>{icon}</div>}
      </div>
    </Card>
  )
}

/* -------------------------------- EmptyState ------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-200 text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

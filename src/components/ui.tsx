import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Loader2, X } from 'lucide-react'
import { cn, initials } from '../lib/utils'

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-brand-amber to-brand-amber-hover text-brand-navy shadow-[0_8px_24px_rgba(248,168,26,0.2)] hover:brightness-105 active:translate-y-px active:brightness-95 disabled:opacity-50',
  secondary:
    'glass-subtle border border-line/70 bg-transparent text-ink hover:border-brand-amber/50 active:translate-y-px disabled:opacity-50',
  ghost: 'text-muted hover:bg-white/40 hover:text-ink disabled:opacity-40 dark:hover:bg-white/5',
  danger: 'bg-[var(--semantic-rose-solid)] text-white shadow-sm hover:brightness-105 active:translate-y-px disabled:opacity-50',
  dark: 'glass-strong bg-transparent text-ink hover:brightness-105 active:translate-y-px disabled:opacity-50',
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
        'inline-flex items-center justify-center font-medium transition-all duration-200 ease-out disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber-focus focus-visible:ring-offset-2',
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
      className={cn('glass rounded-3xl', className)}
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
  neutral: 'bg-[var(--semantic-slate-soft)] text-[var(--semantic-slate-text)] ring-1 ring-[var(--semantic-slate-border)]',
  success: 'bg-[var(--semantic-green-soft)] text-[var(--semantic-green-text)] ring-1 ring-[var(--semantic-green-border)]',
  warning: 'bg-[var(--semantic-amber-soft)] text-[var(--semantic-amber-text)] ring-1 ring-[var(--semantic-amber-border)]',
  danger: 'bg-[var(--semantic-red-soft)] text-[var(--semantic-red-text)] ring-1 ring-[var(--semantic-red-border)]',
  accent: 'bg-[var(--semantic-amber-soft)] text-[var(--semantic-amber-text)] ring-1 ring-[var(--semantic-amber-border)]',
  info: 'bg-[var(--semantic-blue-soft)] text-[var(--semantic-blue-text)] ring-1 ring-[var(--semantic-blue-border)]',
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
  'glass-subtle h-10 w-full rounded-2xl border border-line/80 bg-transparent px-3 text-sm text-ink placeholder:text-muted/70 outline-none transition focus:border-brand-amber-focus focus:ring-4 focus:ring-brand-amber-focus/20 disabled:opacity-65'

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
          'relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground/40',
          checked ? 'bg-brand-amber' : 'bg-espresso-900/15',
        )}
      >
        <span
          className={cn(
            cn('absolute top-[3px] h-4 w-4 rounded-full shadow-sm transition-all duration-200', checked ? 'bg-brand-navy' : 'bg-white'),
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
  'bg-accent-100 text-accent-foreground',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-brand-amber-soft text-brand-navy',
  'bg-rose-100 text-rose-700',
]

export function Avatar({
  name,
  photo,
  size = 'md',
  className,
}: {
  name: string
  photo?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
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
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold',
        avatarPalette[idx],
        sizes[size],
        className,
      )}
    >
      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials(name)}
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
  compact = false,
}: {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlay?: boolean
  compact?: boolean
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-espresso-900/45 backdrop-blur-[3px] animate-[fadeIn_.15s_ease-out]"
        onClick={closeOnOverlay ? onClose : undefined}
      />
      <div
        className={cn(
          'glass-strong relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl',
          compact && 'min-h-[88vh]',
          'animate-[slideUp_.22s_cubic-bezier(0.16,1,0.3,1)]',
          widths[size],
        )}
        role="dialog"
        aria-modal="true"
      >
        {(title || subtitle) && (
          <div className={cn(
            'flex items-start justify-between gap-4 border-b border-line/70 sm:px-6',
            compact ? 'px-4 py-2 sm:py-3' : 'px-5 py-4',
          )}>
            <div>
              {title && <h2 className={cn('font-semibold tracking-tight text-ink', compact ? 'text-[15px]' : 'text-[17px]')}>{title}</h2>}
              {subtitle && <p className={cn('mt-0.5 text-muted', compact ? 'text-[12px]' : 'text-[13px]')}>{subtitle}</p>}
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
        <div className={cn(
          'min-h-0 flex-1 sm:px-6',
          compact ? 'flex flex-col overflow-hidden px-3 py-3 sm:py-4' : 'overflow-y-auto px-5 py-5',
        )}>{children}</div>
        {footer && <div className="glass-subtle border-t border-line/70 px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
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
          'glass-strong relative flex h-full w-full flex-col shadow-2xl animate-[slideLeft_.25s_cubic-bezier(0.16,1,0.3,1)]',
          width,
        )}
      >
        <div className="glass-subtle flex items-start justify-between gap-4 border-b border-line px-6 py-5">
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
        {footer && <div className="glass-subtle border-t border-line px-6 py-4">{footer}</div>}
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
        'glass-subtle inline-flex items-center rounded-full border border-line/70 p-1',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full font-semibold transition-all duration-200',
            size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]',
            value === o.value
              ? 'glass bg-white/70 text-ink shadow-sm ring-1 ring-white/70 dark:bg-white/10 dark:ring-white/10'
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
    neutral: 'bg-[var(--semantic-slate-soft)] text-[var(--semantic-slate-text)]',
    accent: 'bg-[var(--semantic-amber-soft)] text-[var(--semantic-amber-text)]',
    success: 'bg-[var(--semantic-green-soft)] text-[var(--semantic-green-text)]',
    danger: 'bg-[var(--semantic-rose-soft)] text-[var(--semantic-rose-text)]',
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

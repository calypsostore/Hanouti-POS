import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; href: string } | { label: string; onClick: () => void }
}) {
  const actionView: ReactNode = action && ('href' in action
    ? <Link to={action.href} className="mt-4 inline-flex rounded-xl bg-brand-amber px-4 py-2 text-[12px] font-bold text-brand-navy hover:bg-brand-amber-hover">{action.label}</Link>
    : <button type="button" onClick={action.onClick} className="mt-4 rounded-xl bg-brand-amber px-4 py-2 text-[12px] font-bold text-brand-navy hover:bg-brand-amber-hover">{action.label}</button>)
  return (
    <div className="flex flex-col items-center px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-tint text-brand-navy">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p>
      {actionView}
    </div>
  )
}

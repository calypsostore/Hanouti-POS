import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { DASHBOARD_PALETTE, type DashboardTone } from '../../lib/palette'

type Props = {
  icon: LucideIcon
  tone: DashboardTone
  label: string
  detail?: string
  href?: string
  onClick?: () => void
}

const className =
  'glass quick-glass-tile group flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-3xl border border-white/30 p-3 text-center text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber-focus focus-visible:ring-offset-2'

export function QuickActionTile({ icon: Icon, tone, label, detail, href, onClick }: Props) {
  const colors = DASHBOARD_PALETTE[tone]
  const content = (
    <>
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', colors.icon)}>
        <Icon className={cn('h-5 w-5', colors.iconColor)} aria-hidden="true" />
      </span>
      <span>{label}</span>
      {detail && <span className="text-[10px] font-medium opacity-80">{detail}</span>}
    </>
  )
  if (href) {
    return <Link to={href} className={cn(className, colors.gradient, colors.text)}>{content}</Link>
  }
  return (
    <button type="button" onClick={onClick} className={cn(className, colors.gradient, colors.text)}>
      {content}
    </button>
  )
}

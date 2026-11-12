import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { DASHBOARD_PALETTE, SOFT_TONE, type DashboardTone } from '../../lib/palette'

export function IconChip({
  icon: Icon,
  tone = 'blue',
  className,
}: {
  icon: LucideIcon
  tone?: DashboardTone
  className?: string
}) {
  const palette = DASHBOARD_PALETTE[tone]
  return (
    <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', SOFT_TONE[tone], className)}>
      <Icon className={cn('h-[18px] w-[18px]', palette.iconColor === 'text-white' ? 'text-current' : palette.iconColor)} aria-hidden="true" />
    </span>
  )
}

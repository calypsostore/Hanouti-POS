import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '../ui'
import { IconChip } from './IconChip'
import type { DashboardTone } from '../../lib/palette'

export function SectionCard({
  icon,
  tone = 'blue',
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  icon: LucideIcon
  tone?: DashboardTone
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card className={className}>
      <div className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <IconChip icon={icon} tone={tone} className="h-9 w-9 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-[11.5px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </Card>
  )
}

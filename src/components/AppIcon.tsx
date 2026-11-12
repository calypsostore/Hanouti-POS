import { createElement, type CSSProperties } from 'react'
import type { IconColor } from '../types'
import { semanticColorFor } from '../lib/semanticColors'
import { getIcon } from '../lib/icons'
import { cn } from '../lib/utils'

export function AppIcon({
  name,
  color = 'amber',
  size = 20,
  className,
}: {
  name: string
  color?: IconColor
  size?: number
  className?: string
}) {
  const Icon = getIcon(name)
  const palette = semanticColorFor('icons', color)
  const style = {
    '--icon-solid': palette.solid,
    '--icon-soft': palette.softBackground,
    '--icon-border': palette.border,
  } as CSSProperties
  return (
    <span className={cn('app-icon-tile inline-flex shrink-0 items-center justify-center', className)} style={style}>
      {createElement(Icon, { size, strokeWidth: 1.9, 'aria-hidden': true })}
    </span>
  )
}

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { applyAccent, applyColorMode, readColorMode, saveColorMode, type ColorMode } from '../lib/theme'
import { cn } from '../lib/utils'

const COLOR_MODES: ColorMode[] = ['system', 'light', 'dark']

export function ThemeToggle({
  accent,
  defaultMode,
  className,
}: {
  accent?: string
  defaultMode?: ColorMode
  className?: string
}) {
  const [selection, setSelection] = useState(() => ({
    defaultMode,
    mode: readColorMode(defaultMode),
  }))
  const mode = selection.defaultMode === defaultMode
    ? selection.mode
    : defaultMode ?? selection.mode

  useEffect(() => {
    applyColorMode(mode)
    applyAccent(accent ?? '7anouti')
  }, [accent, mode])

  const toggle = () => {
    const next = COLOR_MODES[(COLOR_MODES.indexOf(mode) + 1) % COLOR_MODES.length]
    setSelection({ defaultMode, mode: next })
    applyColorMode(next)
    applyAccent(accent ?? '7anouti')
    saveColorMode(next)
  }
  const nextMode = COLOR_MODES[(COLOR_MODES.indexOf(mode) + 1) % COLOR_MODES.length]
  const modeLabel = mode[0].toUpperCase() + mode.slice(1)

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Appearance: ${modeLabel}. Switch to ${nextMode}.`}
      title={`Appearance: ${modeLabel}. Switch to ${nextMode}.`}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink transition hover:bg-brand-tint dark:bg-espresso-800',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber-focus focus-visible:ring-offset-2',
        className,
      )}
    >
      {mode === 'system' ? <Monitor className="h-4 w-4" /> : mode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}

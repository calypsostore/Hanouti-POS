import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyAccent, applyColorMode, COLOR_MODE_KEY, readColorMode, type ColorMode } from '../lib/theme'
import { cn } from '../lib/utils'

export function ThemeToggle({ accent, className }: { accent?: string; className?: string }) {
  const [mode, setMode] = useState<ColorMode>(readColorMode)

  useEffect(() => {
    applyColorMode(mode)
    applyAccent(accent ?? '7anouti')
  }, [accent, mode])

  const toggle = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    applyColorMode(next)
    applyAccent(accent ?? '7anouti')
    try {
      localStorage.setItem(COLOR_MODE_KEY, next)
    } catch {
      // The visual preference still applies for this session if storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      aria-pressed={mode === 'dark'}
      title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink transition hover:bg-brand-tint',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber-focus focus-visible:ring-offset-2',
        className,
      )}
    >
      {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

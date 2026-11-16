import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn, uid } from '../lib/utils'

type Tone = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  tone: Tone
}

const ToastContext = createContext<{ push: (message: string, tone?: Tone) => void } | null>(null)

const toneStyles: Record<Tone, string> = {
  success: 'border-[var(--semantic-green-border)] bg-[var(--semantic-green-soft)] text-ink',
  error: 'border-[var(--semantic-rose-border)] bg-[var(--semantic-rose-soft)] text-ink',
  info: 'border-line bg-white/70 text-ink dark:bg-white/10',
}

const toneIcon: Record<Tone, ReactNode> = {
  success: <CheckCircle2 className="h-[18px] w-[18px] text-[var(--semantic-green-text)]" />,
  error: <AlertTriangle className="h-[18px] w-[18px] text-[var(--semantic-rose-text)]" />,
  info: <Info className="h-[18px] w-[18px] text-[var(--semantic-amber-text)]" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, tone: Tone = 'success') => {
    const id = uid('t')
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, tone === 'error' ? 6500 : 3800)
  }, [])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-[calc(100vw-2.5rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'glass-strong pointer-events-auto flex items-start gap-3 rounded-full border px-4 py-3 shadow-lg shadow-espresso-900/5',
              'animate-[toastIn_.22s_cubic-bezier(0.16,1,0.3,1)]',
              toneStyles[t.tone],
            )}
          >
            <span className="mt-px">{toneIcon[t.tone]}</span>
            <p className="flex-1 text-[13.5px] font-medium leading-5">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="rounded-md p-0.5 text-muted transition hover:bg-cream-200 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

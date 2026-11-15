import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { useToast } from './toast'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const { push } = useToast()

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const handleInstalled = () => setPrompt(null)
    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (!prompt) return null
  const install = async () => {
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      setPrompt(null)
      push(choice.outcome === 'accepted' ? 'App installation started.' : 'App installation was dismissed.', 'info')
    } catch (error) {
      setPrompt(null)
      push(error instanceof Error ? `Could not open the install prompt: ${error.message}` : 'Could not open the install prompt.', 'error')
    }
  }
  return (
    <button
      type="button"
      onClick={() => { void install() }}
      className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 py-2 text-[11px] font-semibold text-ink hover:bg-cream-100 dark:bg-espresso-800"
    >
      <Download className="h-4 w-4" /> Install app
    </button>
  )
}

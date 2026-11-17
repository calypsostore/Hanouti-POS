import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { useLocation } from 'react-router-dom'
import { checkForAppUpdate, downloadAndInstallUpdate, type AppUpdate } from '../lib/appUpdate'

export function UpdateBanner() {
  const { pathname } = useLocation()
  const [update, setUpdate] = useState<AppUpdate | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const isDashboard = ['/admin', '/staff', '/super'].includes(pathname)

  useEffect(() => {
    let active = true
    let appStateListener: Awaited<ReturnType<typeof App.addListener>> | undefined
    const refresh = () => {
      void checkForAppUpdate().then((available) => {
        if (active) setUpdate(available)
      })
    }

    refresh()
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) refresh()
    }).then((listener) => {
      if (active) appStateListener = listener
      else void listener.remove()
    }).catch(() => {
      // Update checks are best-effort; listener failures must not affect POS use.
    })

    return () => {
      active = false
      if (appStateListener) void appStateListener.remove()
    }
  }, [])

  if (!isDashboard || !update || update.versionCode === dismissedVersion) return null

  const startUpdate = async () => {
    setDownloading(true)
    setMessage('')
    setProgress(null)
    try {
      await downloadAndInstallUpdate(update, setProgress)
      setMessage('Installer opened. Allow installs from this app if Android asks.')
    } catch {
      setMessage('Could not download or open the installer. Check your connection and install permission, then retry.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-brand-amber/40 bg-brand-amber/10 p-3 text-ink sm:flex-row sm:items-center sm:justify-between sm:px-4" role="status">
      <div className="min-w-0">
        <p className="text-sm font-bold">New version {update.versionName} available</p>
        {downloading && (
          <p className="mt-1 text-xs text-muted">
            Downloading update{progress === null ? '…' : `… ${progress}%`}
          </p>
        )}
        {message && <p className="mt-1 text-xs text-muted">{message}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void startUpdate()}
          disabled={downloading}
          className="rounded-xl bg-brand-amber px-3 py-2 text-xs font-bold text-brand-navy disabled:cursor-wait disabled:opacity-60"
        >
          {downloading ? 'Downloading…' : 'Update'}
        </button>
        <button
          type="button"
          onClick={() => setDismissedVersion(update.versionCode)}
          disabled={downloading}
          className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-ink disabled:opacity-60 dark:bg-espresso-800"
        >
          Later
        </button>
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Download } from 'lucide-react'
import { Button, Card } from '../../../components/ui'
import {
  checkForAppUpdateManually,
  downloadAndInstallUpdate,
  type AppUpdate,
  type ManualAppUpdateCheckResult,
} from '../../../lib/appUpdate'
import { ensureUpdateNotificationPermission } from '../../../lib/updateNotification'

interface InstalledAppInfo {
  version: string
  build: string
}

export default function AppUpdatesSection({ embedded = false }: { embedded?: boolean }) {
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  const [installedInfo, setInstalledInfo] = useState<InstalledAppInfo | null>(null)
  const [installedInfoError, setInstalledInfoError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<ManualAppUpdateCheckResult | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [downloadMessage, setDownloadMessage] = useState('')

  useEffect(() => {
    if (!isAndroidNative) return
    void ensureUpdateNotificationPermission()
    let active = true
    void App.getInfo().then((info) => {
      if (active) setInstalledInfo({ version: info.version, build: info.build })
    }).catch(() => {
      if (active) setInstalledInfoError(true)
    })
    return () => {
      active = false
    }
  }, [isAndroidNative])

  if (!isAndroidNative) return null

  const checkForUpdates = async () => {
    setChecking(true)
    setCheckResult(null)
    setDownloadMessage('')
    setProgress(null)
    try {
      setCheckResult(await checkForAppUpdateManually())
    } finally {
      setChecking(false)
    }
  }

  const startUpdate = async (update: AppUpdate) => {
    setDownloading(true)
    setProgress(null)
    setDownloadMessage('')
    try {
      await downloadAndInstallUpdate(update, setProgress)
      setDownloadMessage('Installer opened. Allow installs from this app if Android asks.')
    } catch {
      setDownloadMessage('Could not download or open the installer. Check your connection and install permission, then retry.')
    } finally {
      setDownloading(false)
    }
  }

  const checkMessage = checkResult?.status === 'up-to-date'
    ? "You're up to date"
    : checkResult?.status === 'update-available'
      ? `New version ${checkResult.update.versionName} available`
      : checkResult?.status === 'error'
        ? checkResult.reason === 'network'
          ? 'Could not reach GitHub. Check your internet connection and try again.'
          : checkResult.reason === 'timeout'
            ? 'The check timed out. Try again.'
            : checkResult.reason === 'http'
              ? `GitHub answered with error ${checkResult.statusCode ?? 'unknown'}.`
              : checkResult.reason === 'invalid-response'
                ? 'The update file is invalid.'
                : 'Could not read the installed app version.'
        : ''

  const content = (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-ink dark:bg-espresso-700">
          <Download className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-[15px] font-bold text-ink">App updates</h3>
          <p className="mt-1 text-[12px] text-muted">Check for and install the latest Android app version.</p>
        </div>
      </div>

      <p className="text-[13px] text-muted">
        Installed version:{' '}
        <span className="font-semibold text-ink">
          {installedInfo
            ? `${installedInfo.version} (build ${installedInfo.build})`
            : installedInfoError ? 'Could not read app version' : 'Loading…'}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void checkForUpdates()}
          disabled={checking || downloading}
          loading={checking}
        >
          {checking ? 'Checking…' : 'Check for updates'}
        </Button>
        {checkResult?.status === 'update-available' && (
          <Button
            type="button"
            onClick={() => void startUpdate(checkResult.update)}
            disabled={downloading}
            loading={downloading}
          >
            {downloading
              ? `Downloading${progress === null ? '…' : `… ${progress}%`}`
              : 'Update'}
          </Button>
        )}
      </div>

      {checkMessage && (
        <p
          role={checkResult?.status === 'error' ? 'alert' : 'status'}
          className={`text-[13px] ${checkResult?.status === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-muted'}`}
        >
          {checkMessage}
        </p>
      )}
      {downloadMessage && <p role="status" className="text-[12px] text-muted">{downloadMessage}</p>}
    </>
  )

  if (embedded) return <div className="space-y-4 px-4 pb-4 sm:px-5">{content}</div>
  return <Card className="space-y-4 p-4 sm:p-5">{content}</Card>
}

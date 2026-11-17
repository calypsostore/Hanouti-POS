import { App } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

export interface AppUpdate {
  versionCode: number
  versionName: string
  apkUrl: string
  notes: string
}

interface ApkInstallerPlugin {
  installApk(options: { path: string }): Promise<void>
}

const VERSION_URL = 'https://github.com/calypsostore/Hanouti-POS/releases/latest/download/version.json'
const APK_URL_PREFIX = 'https://github.com/calypsostore/Hanouti-POS/releases/download/'
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const LAST_CHECK_KEY = '7anouti.appUpdate.lastCheck'
const UPDATE_CACHE_KEY = '7anouti.appUpdate.available'
const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller')

let lastCheckAt = 0
let checkInFlight: Promise<AppUpdate | null> | null = null
let cachedUpdate: AppUpdate | null = null

function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

function parseUpdate(value: unknown): AppUpdate | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (!Number.isSafeInteger(candidate.versionCode) || (candidate.versionCode as number) < 1) return null
  if (typeof candidate.versionName !== 'string' || !candidate.versionName.trim()) return null
  if (typeof candidate.apkUrl !== 'string' || !candidate.apkUrl.startsWith(APK_URL_PREFIX)) return null
  if (typeof candidate.notes !== 'string') return null
  return {
    versionCode: candidate.versionCode as number,
    versionName: candidate.versionName,
    apkUrl: candidate.apkUrl,
    notes: candidate.notes,
  }
}

function readCachedUpdate(): AppUpdate | null {
  try {
    cachedUpdate = parseUpdate(JSON.parse(localStorage.getItem(UPDATE_CACHE_KEY) ?? 'null'))
  } catch {
    return cachedUpdate
  }
  return cachedUpdate
}

function readLastCheckAt(): number {
  try {
    return Math.max(lastCheckAt, Number(localStorage.getItem(LAST_CHECK_KEY)) || 0)
  } catch {
    return lastCheckAt
  }
}

export function checkForAppUpdate(): Promise<AppUpdate | null> {
  if (!isAndroidNative()) return Promise.resolve(null)
  if (checkInFlight) return checkInFlight

  checkInFlight = (async () => {
    try {
      const installed = await App.getInfo()
      const installedVersionCode = Number.parseInt(installed.build, 10)
      if (!Number.isSafeInteger(installedVersionCode)) return null

      const lastCheck = readLastCheckAt()
      if (Date.now() - lastCheck < CHECK_INTERVAL_MS) {
        const cached = readCachedUpdate()
        return cached && cached.versionCode > installedVersionCode ? cached : null
      }

      lastCheckAt = Date.now()
      try {
        localStorage.setItem(LAST_CHECK_KEY, String(lastCheckAt))
      } catch {
        // Keep the in-memory throttle if browser storage is unavailable.
      }

      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 5_000)
      try {
        const response = await fetch(VERSION_URL, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          signal: controller.signal,
        })
        if (!response.ok) {
          const cached = readCachedUpdate()
          return cached && cached.versionCode > installedVersionCode ? cached : null
        }

        const update = parseUpdate(await response.json())
        if (!update) {
          const cached = readCachedUpdate()
          return cached && cached.versionCode > installedVersionCode ? cached : null
        }
        if (update.versionCode <= installedVersionCode) {
          cachedUpdate = null
          try {
            localStorage.removeItem(UPDATE_CACHE_KEY)
          } catch {
            // The in-memory update cache remains usable without browser storage.
          }
          return null
        }
        cachedUpdate = update
        try {
          localStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(update))
        } catch {
          // Keep the update available for this app session.
        }
        return update
      } catch {
        const cached = readCachedUpdate()
        return cached && cached.versionCode > installedVersionCode ? cached : null
      } finally {
        window.clearTimeout(timeout)
      }
    } catch {
      return null
    } finally {
      checkInFlight = null
    }
  })()

  return checkInFlight
}

export async function downloadAndInstallUpdate(
  update: AppUpdate,
  onProgress: (progress: number | null) => void,
): Promise<void> {
  if (!isAndroidNative()) throw new Error('APK installation is only available in the Android app.')
  if (!update.apkUrl.startsWith(APK_URL_PREFIX)) throw new Error('The update APK URL is not trusted.')

  const progressListener = await Filesystem.addListener('progress', (status) => {
    if (status.url !== update.apkUrl || status.contentLength <= 0) return
    onProgress(Math.min(100, Math.round((status.bytes / status.contentLength) * 100)))
  })

  try {
    const result = await Filesystem.downloadFile({
      url: update.apkUrl,
      path: '7anouti-pos.apk',
      directory: Directory.Cache,
      progress: true,
    })
    if (!result.path) throw new Error('The downloaded APK path was not returned.')
    await ApkInstaller.installApk({ path: result.path })
  } finally {
    await progressListener.remove()
  }
}

import { App } from '@capacitor/app'
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { notifyForAppUpdate } from './updateNotification'

export interface AppUpdate {
  versionCode: number
  versionName: string
  apkUrl: string
  notes: string
}

export type ManualAppUpdateCheckResult =
  | { status: 'update-available'; update: AppUpdate }
  | { status: 'up-to-date' }
  | { status: 'error'; reason: 'network' | 'timeout' | 'invalid-response' | 'installed-version' }
  | { status: 'error'; reason: 'http'; statusCode: number }
  | { status: 'not-supported' }

interface ApkInstallerPlugin {
  installApk(options: { path: string }): Promise<void>
}

const VERSION_URL = 'https://github.com/calypsostore/Hanouti-POS/releases/latest/download/version.json'
const APK_URL_PREFIX = 'https://github.com/calypsostore/Hanouti-POS/releases/download/'
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const AUTOMATIC_CHECK_TIMEOUT_MS = 5_000
const MANUAL_CHECK_TIMEOUT_MS = 15_000
const LAST_CHECK_KEY = '7anouti.appUpdate.lastCheck'
const UPDATE_CACHE_KEY = '7anouti.appUpdate.available'
const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller')

type UpdateCheckFailure = Extract<ManualAppUpdateCheckResult, { status: 'error' }>
type UpdateRequestResult = { update: AppUpdate } | { error: UpdateCheckFailure }

let lastCheckAt = 0
let checkInFlight: Promise<AppUpdate | null> | null = null
let manualCheckInFlight: Promise<ManualAppUpdateCheckResult> | null = null
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

class UpdateCheckTimeoutError extends Error {}

function nativeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error &&
    typeof error.message === 'string') {
    return error.message
  }
  return ''
}

async function requestUpdate(timeoutMs: number): Promise<UpdateRequestResult> {
  let timeoutId: number | undefined
  try {
    const response = await Promise.race([
      CapacitorHttp.get({
        url: VERSION_URL,
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
        disableRedirects: false,
        responseType: 'text',
      }),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new UpdateCheckTimeoutError()), timeoutMs)
      }),
    ])
    if (!Number.isInteger(response.status)) {
      return { error: { status: 'error', reason: 'invalid-response' } }
    }
    if (response.status < 200 || response.status >= 300) {
      return {
        error: { status: 'error', reason: 'http', statusCode: response.status },
      }
    }

    let responseData: unknown = response.data
    if (typeof responseData === 'string') {
      try {
        responseData = JSON.parse(responseData) as unknown
      } catch {
        return { error: { status: 'error', reason: 'invalid-response' } }
      }
    }

    const update = parseUpdate(responseData)
    return update
      ? { update }
      : { error: { status: 'error', reason: 'invalid-response' } }
  } catch (error: unknown) {
    const message = nativeErrorMessage(error)
    const reason = error instanceof UpdateCheckTimeoutError ||
      /timeout|timed out|sockettimeoutexception/i.test(message)
      ? 'timeout'
      : 'network'
    return { error: { status: 'error', reason } }
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId)
  }
}

export function checkForAppUpdate(options: { force?: boolean } = {}): Promise<AppUpdate | null> {
  if (!isAndroidNative()) return Promise.resolve(null)
  if (options.force) {
    return checkForAppUpdateManually().then((result) =>
      result.status === 'update-available' ? result.update : null,
    )
  }
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

      const result = await requestUpdate(AUTOMATIC_CHECK_TIMEOUT_MS)
      if ('error' in result) {
        const cached = readCachedUpdate()
        return cached && cached.versionCode > installedVersionCode ? cached : null
      }
      const { update } = result
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
      await notifyForAppUpdate(update)
      return update
    } catch {
      return null
    } finally {
      checkInFlight = null
    }
  })()

  return checkInFlight
}

export function checkForAppUpdateManually(): Promise<ManualAppUpdateCheckResult> {
  if (!isAndroidNative()) return Promise.resolve({ status: 'not-supported' })
  if (manualCheckInFlight) return manualCheckInFlight

  manualCheckInFlight = (async () => {
    try {
      let installedVersionCode: number
      try {
        const installed = await App.getInfo()
        installedVersionCode = Number.parseInt(installed.build, 10)
      } catch {
        return { status: 'error', reason: 'installed-version' }
      }

      if (!Number.isSafeInteger(installedVersionCode)) {
        return { status: 'error', reason: 'installed-version' }
      }

      lastCheckAt = Date.now()
      try {
        localStorage.setItem(LAST_CHECK_KEY, String(lastCheckAt))
      } catch {
        // Keep the in-memory throttle if browser storage is unavailable.
      }

      const result = await requestUpdate(MANUAL_CHECK_TIMEOUT_MS)
      if ('error' in result) return result.error

      const { update } = result
      if (update.versionCode <= installedVersionCode) {
        cachedUpdate = null
        try {
          localStorage.removeItem(UPDATE_CACHE_KEY)
        } catch {
          // The in-memory update cache remains usable without browser storage.
        }
        return { status: 'up-to-date' }
      }

      cachedUpdate = update
      try {
        localStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(update))
      } catch {
        // Keep the update available for this app session.
      }
      await notifyForAppUpdate(update)
      return { status: 'update-available', update }
    } finally {
      manualCheckInFlight = null
    }
  })()

  return manualCheckInFlight
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

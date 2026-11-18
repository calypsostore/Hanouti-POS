import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { AppUpdate } from './appUpdate'

const CHANNEL_ID = 'app-updates'
const NOTIFIED_VERSION_KEY = '7anouti.appUpdate.lastNotifiedVersion'
const PERMISSION_REFUSED_KEY = '7anouti.appUpdate.notificationPermissionRefused'

function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function ensureUpdateNotificationPermission(): Promise<boolean> {
  if (!isAndroidNative()) return false
  try {
    if (localStorage.getItem(PERMISSION_REFUSED_KEY) === '1') return false
    const status = await LocalNotifications.checkPermissions()
    if (status.display === 'granted') return true
    if (status.display === 'denied') {
      localStorage.setItem(PERMISSION_REFUSED_KEY, '1')
      return false
    }
    const request = await LocalNotifications.requestPermissions()
    if (request.display === 'granted') return true
    localStorage.setItem(PERMISSION_REFUSED_KEY, '1')
  } catch {
    return false
  }
  return false
}

export async function notifyForAppUpdate(update: AppUpdate): Promise<void> {
  if (!isAndroidNative()) return
  try {
    const lastNotified = Number(localStorage.getItem(NOTIFIED_VERSION_KEY)) || 0
    if (lastNotified >= update.versionCode) return
    if (!await ensureUpdateNotificationPermission()) return

    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'App updates',
      description: 'Notifications when a new 7anouti POS Android version is available',
      importance: 3,
      visibility: 1,
    })
    await LocalNotifications.schedule({
      notifications: [{
        id: update.versionCode,
        title: `New version ${update.versionName} available`,
        body: 'Tap to open the app and update',
        channelId: CHANNEL_ID,
        smallIcon: 'ic_notification',
        extra: { versionCode: update.versionCode },
      }],
    })
    localStorage.setItem(NOTIFIED_VERSION_KEY, String(update.versionCode))
  } catch {
    // Update notifications are best-effort and must not affect update checks.
  }
}

export async function setupUpdateNotificationTap(onTap: () => void): Promise<() => void> {
  if (!isAndroidNative()) return () => undefined
  const listener = await LocalNotifications.addListener('localNotificationActionPerformed', onTap)
  return () => {
    void listener.remove()
  }
}

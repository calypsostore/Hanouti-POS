import type { AutomationSettings, Product, ReceiptPrintPolicy } from '../types.js'
import type { AvailabilitySettings, InventoryItem } from '../types.js'
import { isUnavailable } from './availability.ts'

export type InactivityAction = 'lock' | 'logout' | null

export function inactivityAction(
  elapsedMs: number,
  lockAfterMinutes: number,
  logoutAfterMinutes: number,
): InactivityAction {
  if (logoutAfterMinutes > 0 &&
    (lockAfterMinutes <= 0 || logoutAfterMinutes > lockAfterMinutes) &&
    elapsedMs >= logoutAfterMinutes * 60_000) return 'logout'
  if (lockAfterMinutes > 0 && elapsedMs >= lockAfterMinutes * 60_000) return 'lock'
  return null
}

export function shouldAutoPrintReceipt(policy: ReceiptPrintPolicy): boolean {
  return policy === 'auto'
}

export function shiftReminderDue(openedAt: string, reminderAfterHours: number, now: Date): boolean {
  const opened = Date.parse(openedAt)
  return Number.isFinite(opened) && reminderAfterHours > 0 &&
    now.getTime() - opened >= reminderAfterHours * 60 * 60_000
}

export function automaticPrintRetryLimit(settings?: Partial<AutomationSettings>): number {
  if (settings?.retryPrintJobs === false) return 1
  const limit = settings?.printerRetryLimit
  return Number.isSafeInteger(limit) && Number(limit) >= 1 && Number(limit) <= 10
    ? Number(limit)
    : 5
}

export function validAutomationSettings(settings: AutomationSettings): boolean {
  const validInteger = (value: number, min: number, max: number) =>
    Number.isSafeInteger(value) && value >= min && value <= max
  return typeof settings.drawerKickOnCash === 'boolean' &&
    typeof settings.lowStockAlerts === 'boolean' &&
    typeof settings.hideOutOfStock === 'boolean' &&
    typeof settings.retryPrintJobs === 'boolean' &&
    typeof settings.fallbackPrintJobs === 'boolean' &&
    typeof settings.autoReconnectPrinters === 'boolean' &&
    typeof settings.printerOfflineAlerts === 'boolean' &&
    typeof settings.shiftReminders === 'boolean' &&
    typeof settings.warnAboutOpenTablesAtShiftClose === 'boolean' &&
    typeof settings.backupHealthAlerts === 'boolean' &&
    validInteger(settings.autoLockMinutes, 0, 120) &&
    validInteger(settings.autoLogoutMinutes, 0, 10080) &&
    validInteger(settings.shiftReminderHours, 1, 24) &&
    validInteger(settings.maxShiftHours, 1, 168) &&
    Number.isFinite(settings.cashDifferenceTolerance) &&
    settings.cashDifferenceTolerance >= 0 &&
    validInteger(settings.printerRetryLimit, 1, 10) &&
    validInteger(settings.printerOfflineAlertMinutes, 1, 1440) &&
    (settings.autoLockMinutes === 0 || settings.autoLogoutMinutes === 0 ||
      settings.autoLogoutMinutes > settings.autoLockMinutes)
}

export function printerOfflineAlertDue(offlineSince: string | undefined, alertAfterMinutes: number, now: Date): boolean {
  const since = offlineSince ? Date.parse(offlineSince) : Number.NaN
  return Number.isFinite(since) && alertAfterMinutes > 0 &&
    now.getTime() - since >= alertAfterMinutes * 60_000
}

export function backupHealthIsStale(lastBackupAt: string | null | undefined, now: Date): boolean {
  if (!lastBackupAt) return true
  const backupTime = Date.parse(lastBackupAt)
  return !Number.isFinite(backupTime) || now.getTime() - backupTime > 48 * 60 * 60_000
}

export function productIsOutOfStock(product: Product): boolean {
  const variants = product.variants ?? []
  return variants.length
    ? variants.every((variant) => isUnavailable(product, variant).unavailable)
    : isUnavailable(product, undefined).unavailable
}

export function filterPosProducts(
  products: Product[],
  hideOutOfStock: boolean,
  settings?: AvailabilitySettings,
  inventoryItems: InventoryItem[] = [],
  deductIngredients = false,
): Product[] {
  return hideOutOfStock ? products.filter((product) => {
    const variants = product.variants ?? []
    return variants.length
      ? !variants.every((variant) => isUnavailable(product, variant, settings, inventoryItems, new Date(), deductIngredients).unavailable)
      : !isUnavailable(product, undefined, settings, inventoryItems, new Date(), deductIngredients).unavailable
  }) : products
}

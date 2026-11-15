import type { DevicePrintPreference, ReceiptPrintPolicy } from '../types'

const KEY = '7anouti.print-device-preference.v1'
const OPTIONS: DevicePrintPreference[] = ['hub', 'this-device', 'browser']
const receiptPolicyKey = (storeId: string) => `7anouti.receipt-policy.${storeId}.v1`

export const readDevicePrintPreference = (): DevicePrintPreference => {
  try {
    const stored = localStorage.getItem(KEY)
    return OPTIONS.includes(stored as DevicePrintPreference)
      ? stored as DevicePrintPreference
      : 'this-device'
  } catch {
    return 'this-device'
  }
}

export const saveDevicePrintPreference = (preference: DevicePrintPreference): void => {
  localStorage.setItem(KEY, preference)
}

export const readDeviceReceiptPolicy = (
  storeId: string,
  fallback: ReceiptPrintPolicy,
): ReceiptPrintPolicy => {
  try {
    const stored = localStorage.getItem(receiptPolicyKey(storeId))
    return stored === 'auto' || stored === 'ask' || stored === 'never' ? stored : fallback
  } catch {
    return fallback
  }
}

export const saveDeviceReceiptPolicy = (storeId: string, policy: ReceiptPrintPolicy): void => {
  localStorage.setItem(receiptPolicyKey(storeId), policy)
}

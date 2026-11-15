import type { DevicePrintPreference } from '../types'

const KEY = '7anouti.print-device-preference.v1'
const OPTIONS: DevicePrintPreference[] = ['hub', 'this-device', 'browser']

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

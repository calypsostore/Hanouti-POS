export const STATION_DEVICE_SESSION_KEY = '7anouti.station-device.session.v1'

export interface StationDeviceSession {
  deviceId: string
  token: string
}

export const parseStationDeviceSession = (value: string): StationDeviceSession | null => {
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === 'object' && parsed !== null &&
      'deviceId' in parsed && 'token' in parsed &&
      typeof parsed.deviceId === 'string' && parsed.deviceId.length > 0 &&
      typeof parsed.token === 'string' && parsed.token.length > 0
    ) return { deviceId: parsed.deviceId, token: parsed.token }
  } catch {
    return null
  }
  return null
}

export const hasStationDeviceSession = (): boolean => {
  try {
    return localStorage.getItem(STATION_DEVICE_SESSION_KEY) !== null
  } catch {
    return false
  }
}

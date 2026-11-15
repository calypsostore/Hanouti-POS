import type { OpenOrder, Station, StationDevice, Store } from '../types'

export const isValidPairingCode = (
  device: StationDevice,
  store: Pick<Store, 'id' | 'slug'>,
  storeCode: string,
  enteredCode: string,
  now = Date.now(),
): boolean => {
  const expiresAt = device.pairingCodeExpiresAt ? Date.parse(device.pairingCodeExpiresAt) : Number.NaN
  return device.active &&
    !device.pairedAt &&
    /^\d{6}$/.test(enteredCode) &&
    enteredCode === device.pairingCode &&
    Number.isFinite(expiresAt) &&
    expiresAt > now &&
    store.id === device.storeId &&
    store.slug.toLowerCase() === storeCode.trim().toLowerCase()
}

export const stationIdsForDevice = (
  device: StationDevice,
  stations: Station[],
): string[] => device.active
  ? [...new Set(device.stationIds.filter((stationId) =>
      stations.some((station) =>
        station.id === stationId && station.storeId === device.storeId && station.active && station.screen,
      ),
    ))]
  : []

export const scopeOrdersToDeviceStations = (
  orders: OpenOrder[],
  storeId: string,
  stationIds: string[],
): OpenOrder[] => {
  const allowed = new Set(stationIds)
  return orders.flatMap((order) => {
    if (order.storeId !== storeId) return []
    const items = order.items.filter((item) =>
      !!item.stationId && allowed.has(item.stationId) &&
      (item.status === 'sent' || item.status === 'preparing' || item.status === 'ready'),
    )
    return items.length ? [{ ...order, items }] : []
  })
}

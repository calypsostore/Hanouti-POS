import { useCallback } from 'react'
import type { OrderItemStatus, StationDevice, User } from '../types'
import { isValidPairingCode, stationIdsForDevice } from '../lib/stationDevices'
import { hashSecret, verifySecret } from '../lib/hash'
import { uid } from '../lib/utils'
import { can } from '../lib/permissions'
import { addLog } from './audit'
import type { AppContextValue, PairedDeviceResult, StationDeviceInput, StationDeviceResult } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

const PAIRING_WINDOW_MS = 10 * 60 * 1000
const failedPairingAttempts = new Map<string, { count: number; lockedUntil: number }>()

const generatePairingCode = () => {
  const [value] = crypto.getRandomValues(new Uint32Array(1))
  return String(value % 1_000_000).padStart(6, '0')
}

const generateDeviceToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const validStationIds = (stationIds: string[], storeId: string, knownStations: AppContextValue['db']['stations']) => {
  if (!Array.isArray(stationIds) || stationIds.length < 1 || stationIds.length > 50) return null
  const ids = [...new Set(stationIds)]
  if (ids.length !== stationIds.length || ids.some((id) =>
    !knownStations.some((station) =>
      station.id === id && station.storeId === storeId && station.active && station.screen,
    ),
  )) return null
  return ids
}

const stationSnapshot = (device: StationDevice) => ({
  name: device.name,
  stationIds: [...device.stationIds],
  active: device.active,
  paired: Boolean(device.pairedAt),
})

export function useStationDevicesSlice({ dbRef, commitDb, requireActor, requireCapability }: StoreSliceDependencies) {
  const addStationDevice = useCallback<AppContextValue['addStationDevice']>((storeId, input: StationDeviceInput): StationDeviceResult => {
    const actorResult = requireCapability(storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    const name = input.name.trim().slice(0, 100)
    if (!name) return { ok: false, error: 'Enter a device name.' }
    if (dbRef.current.stationDevices.some((device) =>
      device.storeId === storeId && device.name.toLowerCase() === name.toLowerCase(),
    )) return { ok: false, error: 'A device with this name already exists.' }
    const stationIds = validStationIds(input.stationIds, storeId, dbRef.current.stations)
    if (!stationIds) return { ok: false, error: 'Select one or more active stations from this store.' }
    let pairingCode: string
    try {
      pairingCode = generatePairingCode()
    } catch {
      return { ok: false, error: 'Secure pairing codes are unavailable in this browser.' }
    }
    const now = new Date()
    const device: StationDevice = {
      id: uid('dev'),
      storeId,
      name,
      stationIds,
      pairingCode,
      pairingCodeExpiresAt: new Date(now.getTime() + PAIRING_WINDOW_MS).toISOString(),
      active: true,
    }
    commitDb((prev) => addLog({
      ...prev,
      stationDevices: [...prev.stationDevices, device],
    }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'station',
      entityId: device.id,
      summary: `Added station device ${name}`,
      after: { name, stationIds },
    }))
    return { ok: true, device, pairingCode }
  }, [commitDb, dbRef, requireCapability])

  const updateStationDevice = useCallback<AppContextValue['updateStationDevice']>((id, patch) => {
    const device = dbRef.current.stationDevices.find((candidate) => candidate.id === id)
    if (!device) return { ok: false, error: 'Station device not found.' }
    const actorResult = requireCapability(device.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    const name = patch.name === undefined ? device.name : patch.name.trim().slice(0, 100)
    if (!name) return { ok: false, error: 'Enter a device name.' }
    if (dbRef.current.stationDevices.some((candidate) =>
      candidate.id !== id && candidate.storeId === device.storeId &&
      candidate.name.toLowerCase() === name.toLowerCase(),
    )) return { ok: false, error: 'A device with this name already exists.' }
    const stationIds = patch.stationIds === undefined
      ? device.stationIds
      : validStationIds(patch.stationIds, device.storeId, dbRef.current.stations)
    if (!stationIds) return { ok: false, error: 'Select one or more active stations from this store.' }
    const updated = { ...device, name, stationIds }
    commitDb((prev) => addLog({
      ...prev,
      stationDevices: prev.stationDevices.map((entry) => entry.id === id ? updated : entry),
    }, actorResult.actor, {
      storeId: device.storeId,
      action: 'edited',
      entity: 'station',
      entityId: id,
      summary: `Updated station device ${name}`,
      before: stationSnapshot(device),
      after: stationSnapshot(updated),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const disableStationDevice = useCallback<AppContextValue['disableStationDevice']>((id) => {
    const device = dbRef.current.stationDevices.find((candidate) => candidate.id === id)
    if (!device) return { ok: false, error: 'Station device not found.' }
    const actorResult = requireCapability(device.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    const updated = {
      ...device,
      active: false,
      pairingCode: undefined,
      pairingCodeExpiresAt: undefined,
      deviceTokenHash: undefined,
    }
    commitDb((prev) => addLog({
      ...prev,
      stationDevices: prev.stationDevices.map((entry) => entry.id === id ? updated : entry),
    }, actorResult.actor, {
      storeId: device.storeId,
      action: 'deactivated',
      entity: 'station',
      entityId: id,
      summary: `Disabled station device ${device.name}`,
      before: stationSnapshot(device),
      after: stationSnapshot(updated),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const enableStationDevice = useCallback<AppContextValue['enableStationDevice']>((id): StationDeviceResult => {
    const device = dbRef.current.stationDevices.find((candidate) => candidate.id === id)
    if (!device) return { ok: false, error: 'Station device not found.' }
    const actorResult = requireCapability(device.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    let pairingCode: string
    try {
      pairingCode = generatePairingCode()
    } catch {
      return { ok: false, error: 'Secure pairing codes are unavailable in this browser.' }
    }
    const now = new Date()
    const updated: StationDevice = {
      ...device,
      active: true,
      pairedAt: undefined,
      deviceTokenHash: undefined,
      pairingCode,
      pairingCodeExpiresAt: new Date(now.getTime() + PAIRING_WINDOW_MS).toISOString(),
    }
    commitDb((prev) => addLog({
      ...prev,
      stationDevices: prev.stationDevices.map((entry) => entry.id === id ? updated : entry),
    }, actorResult.actor, {
      storeId: device.storeId,
      action: 'activated',
      entity: 'station',
      entityId: id,
      summary: `Enabled station device ${device.name}`,
      before: stationSnapshot(device),
      after: stationSnapshot(updated),
    }))
    return { ok: true, device: updated, pairingCode }
  }, [commitDb, dbRef, requireCapability])

  const unpairStationDevice = useCallback<AppContextValue['unpairStationDevice']>((id): StationDeviceResult => {
    const device = dbRef.current.stationDevices.find((candidate) => candidate.id === id)
    if (!device) return { ok: false, error: 'Station device not found.' }
    const actorResult = requireCapability(device.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    let pairingCode: string
    try {
      pairingCode = generatePairingCode()
    } catch {
      return { ok: false, error: 'Secure pairing codes are unavailable in this browser.' }
    }
    const now = new Date()
    const updated: StationDevice = {
      ...device,
      pairedAt: undefined,
      deviceTokenHash: undefined,
      pairingCode,
      pairingCodeExpiresAt: new Date(now.getTime() + PAIRING_WINDOW_MS).toISOString(),
    }
    commitDb((prev) => addLog({
      ...prev,
      stationDevices: prev.stationDevices.map((entry) => entry.id === id ? updated : entry),
    }, actorResult.actor, {
      storeId: device.storeId,
      action: 'edited',
      entity: 'station',
      entityId: id,
      summary: `Unpaired station device ${device.name}`,
      before: stationSnapshot(device),
      after: stationSnapshot(updated),
    }))
    return { ok: true, device: updated, pairingCode }
  }, [commitDb, dbRef, requireCapability])

  const pairStationDevice = useCallback<AppContextValue['pairStationDevice']>(async (storeCode, enteredCode): Promise<PairedDeviceResult> => {
    const now = Date.now()
    const throttleKey = storeCode.trim().toLowerCase()
    const attempt = failedPairingAttempts.get(throttleKey)
    if (attempt?.lockedUntil && attempt.lockedUntil > now) {
      return { ok: false, error: 'Too many pairing attempts. Wait one minute and try again.' }
    }
    const store = dbRef.current.stores.find((candidate) =>
      candidate.slug.toLowerCase() === throttleKey && candidate.status !== 'suspended',
    )
    const device = store && dbRef.current.stationDevices.find((candidate) =>
      candidate.storeId === store.id && isValidPairingCode(candidate, store, throttleKey, enteredCode, now),
    )
    if (!store || !device) {
      const failures = (attempt?.count ?? 0) + 1
      failedPairingAttempts.set(throttleKey, {
        count: failures >= 5 ? 0 : failures,
        lockedUntil: failures >= 5 ? now + 60_000 : 0,
      })
      return { ok: false, error: 'Store code or pairing code is invalid or expired.' }
    }
    let token: string
    let deviceTokenHash: string
    try {
      token = generateDeviceToken()
      deviceTokenHash = await hashSecret(token)
    } catch {
      return { ok: false, error: 'Could not securely pair this device.' }
    }
    const latest = dbRef.current.stationDevices.find((candidate) => candidate.id === device.id)
    const currentStore = dbRef.current.stores.find((candidate) =>
      candidate.id === store.id && candidate.status !== 'suspended',
    )
    if (!latest || !currentStore ||
      !isValidPairingCode(latest, currentStore, throttleKey, enteredCode, Date.now())) {
      return { ok: false, error: 'This pairing code expired or was already used. Generate a new code.' }
    }
    const pairedAt = new Date().toISOString()
    const updated = {
      ...latest,
      pairedAt,
      lastSeenAt: pairedAt,
      pairingCode: undefined,
      pairingCodeExpiresAt: undefined,
      deviceTokenHash,
    }
    commitDb((prev) => ({
      ...prev,
      stationDevices: prev.stationDevices.map((entry) => entry.id === updated.id ? updated : entry),
    }))
    failedPairingAttempts.delete(throttleKey)
    return {
      ok: true,
      deviceId: updated.id,
      storeId: updated.storeId,
      token,
      stationIds: stationIdsForDevice(updated, dbRef.current.stations),
    }
  }, [commitDb, dbRef])

  const validateStationDeviceSession = useCallback<AppContextValue['validateStationDeviceSession']>(async (deviceId, token): Promise<PairedDeviceResult> => {
    const device = dbRef.current.stationDevices.find((candidate) =>
      candidate.id === deviceId && candidate.active && candidate.pairedAt && candidate.deviceTokenHash,
    )
    if (!device?.deviceTokenHash || !(await verifySecret(token, device.deviceTokenHash))) {
      return { ok: false, error: 'This device is not paired or has been disabled.' }
    }
    const store = dbRef.current.stores.find((candidate) =>
      candidate.id === device.storeId && candidate.status !== 'suspended',
    )
    if (!store) return { ok: false, error: 'The paired store is unavailable.' }
    const latest = dbRef.current.stationDevices.find((candidate) =>
      candidate.id === deviceId && candidate.active && candidate.deviceTokenHash === device.deviceTokenHash,
    )
    if (!latest) return { ok: false, error: 'This device session was revoked.' }
    const checkedAt = new Date().toISOString()
    if (Date.now() - Date.parse(latest.lastSeenAt ?? '') > 60_000) {
      commitDb((prev) => ({
        ...prev,
        stationDevices: prev.stationDevices.map((entry) =>
          entry.id === latest.id ? { ...entry, lastSeenAt: checkedAt } : entry,
        ),
      }))
    }
    return {
      ok: true,
      deviceId: latest.id,
      storeId: latest.storeId,
      token,
      stationIds: stationIdsForDevice(latest, dbRef.current.stations),
    }
  }, [commitDb, dbRef])

  const updateDeviceOrderItemStatus = useCallback<AppContextValue['updateDeviceOrderItemStatus']>(async (
    deviceId,
    token,
    orderId,
    lineId,
    status,
  ) => {
    const device = dbRef.current.stationDevices.find((candidate) =>
      candidate.id === deviceId && candidate.active && candidate.pairedAt && candidate.deviceTokenHash,
    )
    if (!device?.deviceTokenHash || !(await verifySecret(token, device.deviceTokenHash))) {
      return { ok: false, error: 'This station device session is no longer valid.' }
    }
    const allowedTransitions: Partial<Record<OrderItemStatus, OrderItemStatus[]>> = {
      sent: ['preparing'],
      preparing: ['ready', 'sent'],
      ready: ['served', 'preparing'],
    }
    if (status === 'void' || status === 'draft') {
      return { ok: false, error: 'Station devices cannot void order items.' }
    }
    const order = dbRef.current.openOrders.find((candidate) =>
      candidate.id === orderId && candidate.storeId === device.storeId,
    )
    const item = order?.items.find((candidate) => candidate.lineId === lineId)
    if (!order || !item?.stationId || !stationIdsForDevice(device, dbRef.current.stations).includes(item.stationId)) {
      return { ok: false, error: 'This order item is outside this device’s station scope.' }
    }
    if (!allowedTransitions[item.status ?? 'draft']?.includes(status)) {
      return { ok: false, error: 'This item changed on another screen. Refresh and try again.' }
    }
    const updatedAt = new Date().toISOString()
    const actor = { id: device.id, name: `Station device: ${device.name}`, role: 'unknown' as const }
    commitDb((prev) => {
      const currentOrder = prev.openOrders.find((candidate) =>
        candidate.id === orderId && candidate.storeId === device.storeId,
      )
      const currentItem = currentOrder?.items.find((candidate) => candidate.lineId === lineId)
      if (!currentOrder || !currentItem || currentItem.status !== item.status) return prev
      const updatedItem = { ...currentItem, status, updatedAt }
      const updatedOrder = {
        ...currentOrder,
        items: currentOrder.items.map((candidate) =>
          candidate.lineId === lineId ? updatedItem : candidate,
        ),
        updatedAt,
      }
      return addLog({
        ...prev,
        openOrders: prev.openOrders.map((candidate) =>
          candidate.id === orderId ? updatedOrder : candidate,
        ),
      }, actor, {
        storeId: device.storeId,
        action: 'edited',
        entity: 'order',
        entityId: orderId,
        summary: `Station device ${device.name} moved ${item.name} to ${status}`,
        before: { lineId, status: item.status ?? 'draft' },
        after: { lineId, status },
      })
    })
    return { ok: true }
  }, [commitDb, dbRef])

  const updateStationLanding = useCallback<AppContextValue['updateStationLanding']>((stationId, goStraight) => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    if (!actor.storeId || !can(actor, 'viewStation')) {
      return { ok: false, error: 'Station access is required to change this preference.' }
    }
    if (stationId && !dbRef.current.stations.some((station) =>
      station.id === stationId && station.storeId === actor.storeId && station.active && station.screen,
    )) return { ok: false, error: 'Choose an active station screen from this store.' }
    if (goStraight && !stationId) return { ok: false, error: 'Choose your station first.' }
    const updated: User = { ...actor, stationId, goStraightToStation: goStraight }
    commitDb((prev) => ({
      ...prev,
      users: prev.users.map((user) => user.id === actor.id ? updated : user),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  return {
    addStationDevice,
    updateStationDevice,
    disableStationDevice,
    enableStationDevice,
    unpairStationDevice,
    pairStationDevice,
    validateStationDeviceSession,
    updateDeviceOrderItemStatus,
    updateStationLanding,
  }
}

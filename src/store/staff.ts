import { useCallback } from 'react'
import type { User } from '../types'
import { uid } from '../lib/utils'
import { hashSecret, verifySecret } from '../lib/hash'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

export function useStaffSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireAdmin } = dependencies
  const addStaff = useCallback<AppContextValue['addStaff']>(
    async (storeId, data) => {
      const actorResult = requireAdmin(storeId)
      if (!actorResult.ok) return actorResult
      const current = dbRef.current
      if (data.role !== 'admin' && data.role !== 'staff') {
        return { ok: false, error: 'Choose a valid team member role.' }
      }
      if (current.users.some((u) => u.email.toLowerCase() === data.email.trim().toLowerCase())) {
        return { ok: false, error: 'That email is already in use.' }
      }
      if (!/^\d{4,6}$/.test(data.pin)) return { ok: false, error: 'PIN must contain 4 to 6 digits.' }
      if (data.password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' }
      for (const existing of current.users.filter((u) => u.storeId === storeId)) {
        if (await verifySecret(data.pin, existing.pin)) {
          return { ok: false, error: 'That PIN is already used by another team member.' }
        }
      }
      let password: string
      let pin: string
      try {
        password = await hashSecret(data.password)
        pin = await hashSecret(data.pin)
      } catch {
        return { ok: false, error: 'Could not securely save the credentials. Please try again.' }
      }
      const latestActor = requireAdmin(storeId)
      if (!latestActor.ok) return latestActor
      if (dbRef.current.users.some((u) => u.email.toLowerCase() === data.email.trim().toLowerCase())) {
        return { ok: false, error: 'That email is already in use.' }
      }
      for (const existing of dbRef.current.users.filter((u) => u.storeId === storeId)) {
        if (await verifySecret(data.pin, existing.pin)) {
          return { ok: false, error: 'That PIN is already used by another team member.' }
        }
      }
      commitDb((prev) => ({
        ...prev,
        users: [
          ...prev.users,
          {
            ...data,
            password,
            pin,
            email: data.email.trim(),
            id: uid('usr'),
            storeId,
            createdAt: new Date().toISOString(),
          },
        ],
      }))
      return { ok: true }
    },
    [commitDb, requireAdmin],
  )

  const updateStaff = useCallback<AppContextValue['updateStaff']>(async (id, patch) => {
    const current = dbRef.current
    const member = current.users.find((candidate) => candidate.id === id)
    if (!member?.storeId) return { ok: false, error: 'Team member not found.' }
    const actorResult = requireAdmin(member.storeId)
    if (!actorResult.ok) return actorResult
    if (patch.storeId !== undefined && patch.storeId !== member.storeId) {
      return { ok: false, error: 'A team member cannot be moved to another store.' }
    }
    if (patch.email && current.users.some((u) =>
      u.id !== id && u.email.toLowerCase() === patch.email?.trim().toLowerCase(),
    )) return { ok: false, error: 'That email is already in use.' }
    if (patch.email !== undefined && (!patch.email.trim().includes('@') || !patch.email.trim())) {
      return { ok: false, error: 'Enter a valid email address.' }
    }
    if (patch.role !== undefined && patch.role !== 'admin' && patch.role !== 'staff') {
      return { ok: false, error: 'Choose a valid team member role.' }
    }
    if (patch.pin && !/^\d{4,6}$/.test(patch.pin)) {
      return { ok: false, error: 'PIN must contain 4 to 6 digits.' }
    }
    if (patch.password && patch.password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters.' }
    }
    if (patch.pin) {
      for (const other of current.users.filter((u) => u.storeId === member.storeId && u.id !== id)) {
        if (await verifySecret(patch.pin, other.pin)) {
          return { ok: false, error: 'That PIN is already used by another team member.' }
        }
      }
    }
    const nextRole = patch.role ?? member.role
    const nextActive = patch.active ?? member.active
    const activeAdmins = current.users.filter((u) => u.storeId === member.storeId && u.role === 'admin' && u.active)
    if (member.role === 'admin' && member.active && (nextRole !== 'admin' || !nextActive) && activeAdmins.length <= 1) {
      return { ok: false, error: 'You cannot demote or deactivate the last active store admin.' }
    }
    const safePatch: Partial<User> = { ...patch }
    delete safePatch.id
    delete safePatch.storeId
    delete safePatch.createdAt
    try {
      if (patch.pin) safePatch.pin = await hashSecret(patch.pin)
      else delete safePatch.pin
      if (patch.password) safePatch.password = await hashSecret(patch.password)
      else delete safePatch.password
    } catch {
      return { ok: false, error: 'Could not securely save the credentials. Please try again.' }
    }
    const latestActor = requireAdmin(member.storeId)
    if (!latestActor.ok) return latestActor
    commitDb((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === id ? { ...u, ...safePatch } : u)),
    }))
    return { ok: true }
  }, [commitDb, requireAdmin])

  const deleteStaff = useCallback<AppContextValue['deleteStaff']>(
    (id) => {
      const member = dbRef.current.users.find((candidate) => candidate.id === id)
      if (!member?.storeId) return { ok: false, error: 'Team member not found.' }
      const actorResult = requireAdmin(member.storeId)
      if (!actorResult.ok) return actorResult
      if (actorResult.actor.id === id) return { ok: false, error: 'You cannot delete your own account.' }
      const remainingAdmins = dbRef.current.users.filter(
        (u) => u.storeId === member.storeId && u.role === 'admin' && u.active,
      )
      if (member.role === 'admin' && member.active && remainingAdmins.length <= 1) {
        return { ok: false, error: 'You cannot remove the only active store admin.' }
      }
      commitDb((prev) => ({ ...prev, users: prev.users.filter((u) => u.id !== id) }))
      return { ok: true }
    },
    [commitDb, requireAdmin],
  )


  return { addStaff, updateStaff, deleteStaff }
}

import { useCallback } from 'react'
import type { User } from '../types'
import { uid } from '../lib/utils'
import { hashRandomSecret, hashSecret } from '../lib/hash'
import { isValidUsername, normalizeUsername } from '../lib/staff'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

const isValidPhoto = (photo: string | undefined) =>
  photo === undefined || (photo.startsWith('data:image/') && photo.length <= 307200)

export function useStaffSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireAdmin } = dependencies
  const addStaff = useCallback<AppContextValue['addStaff']>(
    async (storeId, data) => {
      const actorResult = requireAdmin(storeId)
      if (!actorResult.ok) return actorResult
      const current = dbRef.current
      const username = normalizeUsername(data.username)
      if (!data.name.trim()) return { ok: false, error: 'Enter the team member’s full name.' }
      if (!isValidUsername(username)) {
        return { ok: false, error: 'Username must be 3–24 lowercase letters, digits, dots, underscores or hyphens.' }
      }
      if (current.users.some((user) => normalizeUsername(user.username ?? '') === username)) {
        return { ok: false, error: 'That username is already in use.' }
      }
      if (!/^\d{4,6}$/.test(data.pin)) return { ok: false, error: 'PIN must contain 4 to 6 digits.' }
      if (!isValidPhoto(data.photo)) return { ok: false, error: 'Profile photos must be images no larger than 300 KB.' }
      let password: string
      let pin: string
      try {
        ;[password, pin] = await Promise.all([hashRandomSecret(), hashSecret(data.pin)])
      } catch {
        return { ok: false, error: 'Could not securely save the credentials. Please try again.' }
      }
      const latestActor = requireAdmin(storeId)
      if (!latestActor.ok) return latestActor
      if (dbRef.current.users.some((user) => normalizeUsername(user.username ?? '') === username)) {
        return { ok: false, error: 'That username is already in use.' }
      }
      commitDb((prev) => ({
        ...prev,
        users: [
          ...prev.users,
          {
            ...data,
            name: data.name.trim(),
            username,
            email: '',
            password,
            pin,
            role: 'staff',
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
    if (patch.role !== undefined && patch.role !== member.role) {
      return { ok: false, error: 'Team member roles cannot be changed here.' }
    }
    const username = patch.username === undefined ? undefined : normalizeUsername(patch.username)
    if (username !== undefined) {
      if (!isValidUsername(username)) {
        return { ok: false, error: 'Username must be 3–24 lowercase letters, digits, dots, underscores or hyphens.' }
      }
      if (current.users.some((user) =>
        user.id !== id && normalizeUsername(user.username ?? '') === username,
      )) return { ok: false, error: 'That username is already in use.' }
    }
    if (patch.pin && !/^\d{4,6}$/.test(patch.pin)) {
      return { ok: false, error: 'PIN must contain 4 to 6 digits.' }
    }
    if (member.role === 'staff' && patch.password) {
      return { ok: false, error: 'Staff accounts use a PIN, not a password.' }
    }
    if (patch.password && patch.password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters.' }
    }
    if (!isValidPhoto(patch.photo)) {
      return { ok: false, error: 'Profile photos must be images no larger than 300 KB.' }
    }
    const nextRole = patch.role ?? member.role
    const nextActive = patch.active ?? member.active
    const activeAdmins = current.users.filter((u) => u.storeId === member.storeId && u.role === 'admin' && u.active)
    if (member.role === 'admin' && member.active && (nextRole !== 'admin' || !nextActive) && activeAdmins.length <= 1) {
      return { ok: false, error: 'You cannot demote or deactivate the last active store admin.' }
    }
    const safePatch: Partial<User> = { ...patch }
    if (username !== undefined) safePatch.username = username
    delete safePatch.id
    delete safePatch.storeId
    delete safePatch.createdAt
    if (member.role === 'staff') {
      safePatch.email = ''
      delete safePatch.password
    }
    try {
      if (patch.pin) safePatch.pin = await hashSecret(patch.pin)
      else delete safePatch.pin
      if (patch.password && member.role !== 'staff') safePatch.password = await hashSecret(patch.password)
      else delete safePatch.password
    } catch {
      return { ok: false, error: 'Could not securely save the credentials. Please try again.' }
    }
    const latestActor = requireAdmin(member.storeId)
    if (!latestActor.ok) return latestActor
    if (username !== undefined && dbRef.current.users.some((user) =>
      user.id !== id && normalizeUsername(user.username ?? '') === username,
    )) return { ok: false, error: 'That username is already in use.' }
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

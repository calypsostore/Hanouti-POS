import { useCallback, useEffect, useRef, useState } from 'react'
import type { Database } from '../types'
import { verifySecret } from '../lib/hash'
import { clockInAttendance, clockOutAttendance } from '../lib/payroll'
import { addLog } from './audit'
import { loginScheduleError } from '../lib/shiftAccess'
import { openShiftForStaff } from '../lib/registerShifts'
import type { LoginResult } from './types'
import type { DataProvider } from './providers/DataProvider'
import { LEGACY_SESSION_KEYS, SESSION_KEY } from './database'

const readStoredUserId = () => {
  try {
    const current = localStorage.getItem(SESSION_KEY)
    if (current) return current
    for (const key of LEGACY_SESSION_KEYS) {
      const legacy = localStorage.getItem(key)
      if (legacy) {
        localStorage.setItem(SESSION_KEY, legacy)
        localStorage.removeItem(key)
        return legacy
      }
    }
    return null
  } catch {
    return null
  }
}

type AuthSliceDependencies = {
  dbRef: { current: Database }
  ready: boolean
  loadError: string
  commitDb: (update: (prev: Database) => Database) => Database
  provider: DataProvider
  applyProviderSnapshot: (snapshot: Database) => void
}

export function useAuthSlice(dependencies: AuthSliceDependencies) {
  const { dbRef, ready, loadError, commitDb, provider, applyProviderSnapshot } = dependencies
  const [userId, setStoredUserId] = useState<string | null>(readStoredUserId)
  const userIdRef = useRef<string | null>(userId)
  const pinFailures = useRef(new Map<string, { count: number; lockedUntil: number }>())
  const setSessionUserId = useCallback((next: string | null) => {
    userIdRef.current = next
    setStoredUserId(next)
  }, [])
  const recordFailure = useCallback((identifier: string, user?: Database['users'][number]) => {
    const label = identifier.slice(0, 254)
    const actor = user
      ? { id: user.id, name: user.name, role: user.role }
      : { id: 'unknown', name: label, role: 'unknown' as const }
    commitDb((prev) => addLog(prev, actor, {
      storeId: user?.storeId ?? 'system',
      action: 'login_failure',
      entity: 'auth',
      entityId: user?.id,
      summary: `Sign-in failed for ${label}`,
    }))
  }, [commitDb])
  useEffect(() => {
    try {
      if (userId) localStorage.setItem(SESSION_KEY, userId)
      else localStorage.removeItem(SESSION_KEY)
      for (const key of LEGACY_SESSION_KEYS) localStorage.removeItem(key)
    } catch { /* ignore */ }
  }, [userId])
  const login = useCallback(
    async (email: string, password: string, storeCode?: string): Promise<LoginResult> => {
      if (!ready) return { ok: false, error: loadError || 'The local database is still loading.' }
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) return { ok: false, error: 'Enter your email address.' }
      if (provider.mode === 'hub') {
        const cachedUser = dbRef.current.users.find((u) =>
          u.role !== 'staff' && u.email?.toLowerCase() === normalizedEmail,
        )
        const inferredStoreCode = storeCode ?? dbRef.current.stores.find((store) =>
          store.id === cachedUser?.storeId,
        )?.slug
        const hubResult = await provider.login(inferredStoreCode ?? '', normalizedEmail, password)
        if (hubResult.ok) {
          const snapshot = await provider.pullSnapshot()
          if (snapshot) applyProviderSnapshot(snapshot.database)
          const user = dbRef.current.users.find((candidate) => candidate.id === hubResult.userId)
          if (!user?.active) return { ok: false, error: 'The hub account is not present in the synchronized store data.' }
          userIdRef.current = user.id
          setSessionUserId(user.id)
          return { ok: true, user }
        }
        if (!hubResult.offline) return { ok: false, error: hubResult.error }
      }
      const current = dbRef.current
      const found = current.users.find((u) =>
        u.role !== 'staff' && u.email?.toLowerCase() === normalizedEmail,
      )
      if (!found || !(await verifySecret(password, found.password))) {
        recordFailure(normalizedEmail, found)
        return { ok: false, error: 'Incorrect email or password.' }
      }
      if (!found.active) {
        recordFailure(normalizedEmail, found)
        return { ok: false, error: 'This account has been deactivated.' }
      }
      if (found.storeId) {
        const owner = current.stores.find((s) => s.id === found.storeId)
        if (owner?.status === 'suspended') {
          recordFailure(normalizedEmail, found)
          return { ok: false, error: 'This store is suspended. Contact the platform owner.' }
        }
      }
      commitDb((prev) => addLog(prev, found, {
        storeId: found.storeId ?? 'system',
        action: 'login_success',
        entity: 'auth',
        entityId: found.id,
        summary: `Signed in with email ${normalizedEmail.slice(0, 254)}`,
      }))
      userIdRef.current = found.id
      setSessionUserId(found.id)
      return { ok: true, user: found }
    },
    [dbRef, ready, loadError, recordFailure, commitDb, setSessionUserId, provider, applyProviderSnapshot],
  )

  const loginPin = useCallback(
    async (username: string, pin: string, storeCode?: string): Promise<LoginResult> => {
      const needle = username.trim().toLowerCase()
      if (!ready) return { ok: false, error: loadError || 'The local database is still loading.' }
      if (!needle) return { ok: false, error: 'Enter your username.' }
      if (provider.mode === 'hub') {
        const cachedUser = dbRef.current.users.find((user) =>
          (user.role === 'staff' || user.role === 'manager') && user.username?.toLowerCase() === needle,
        )
        const inferredStoreCode = storeCode ?? dbRef.current.stores.find((store) =>
          store.id === cachedUser?.storeId,
        )?.slug
        const hubResult = await provider.login(inferredStoreCode ?? '', needle, pin.trim())
        if (hubResult.ok) {
          const snapshot = await provider.pullSnapshot()
          if (snapshot) applyProviderSnapshot(snapshot.database)
          const user = dbRef.current.users.find((candidate) => candidate.id === hubResult.userId)
          if (!user?.active) return { ok: false, error: 'The hub account is not present in the synchronized store data.' }
          userIdRef.current = user.id
          setSessionUserId(user.id)
          return { ok: true, user }
        }
        if (!hubResult.offline) return { ok: false, error: hubResult.error }
      }
      const current = dbRef.current
      const found = current.users.find(
        (user) => (user.role === 'staff' || user.role === 'manager') &&
          user.username?.toLowerCase() === needle,
      )
      const failure = pinFailures.current.get(needle)
      if (failure?.lockedUntil && failure.lockedUntil > Date.now()) {
        const seconds = Math.ceil((failure.lockedUntil - Date.now()) / 1000)
        recordFailure(needle, found)
        return { ok: false, error: `Too many failed PIN attempts. Try again in ${seconds} seconds.` }
      }
      const enteredPin = pin.trim()
      const validPin = found && /^\d{4,6}$/.test(enteredPin)
        ? await verifySecret(enteredPin, found.pin)
        : false
      if (!found || !validPin) {
        const latestFailure = pinFailures.current.get(needle)
        if (latestFailure?.lockedUntil && latestFailure.lockedUntil > Date.now()) {
          const seconds = Math.ceil((latestFailure.lockedUntil - Date.now()) / 1000)
          recordFailure(needle, found)
          return { ok: false, error: `Too many failed PIN attempts. Try again in ${seconds} seconds.` }
        }
        const attempts = (latestFailure?.count ?? 0) + 1
        pinFailures.current.set(needle, {
          count: attempts >= 5 ? 0 : attempts,
          lockedUntil: attempts >= 5 ? Date.now() + 30_000 : 0,
        })
        recordFailure(needle, found)
        return {
          ok: false,
          error: attempts >= 5
            ? 'Too many failed PIN attempts. Try again in 30 seconds.'
            : 'Username or PIN not recognised.',
        }
      }
      pinFailures.current.delete(needle)
      if (!found.active) {
        recordFailure(needle, found)
        return { ok: false, error: 'This account has been deactivated.' }
      }
      const store = found.storeId
        ? current.stores.find((candidate) => candidate.id === found.storeId)
        : undefined
      if (!store) {
        recordFailure(needle, found)
        return { ok: false, error: 'This staff account is not linked to a store.' }
      }
      if (store.status === 'suspended') {
        recordFailure(needle, found)
        return { ok: false, error: 'This store is suspended. Contact your manager.' }
      }
      if (found.role === 'staff') {
        const scheduleError = loginScheduleError(
          store.settings.shiftAccess,
          current.shifts,
          store.id,
          found.id,
          new Date(),
          !!openShiftForStaff(current, store.id, found.id),
        )
        if (scheduleError) {
          commitDb((prev) => addLog(prev, found, {
            storeId: store.id,
            action: 'shift_access_denied',
            entity: 'auth',
            summary: `Blocked sign-in: ${scheduleError}`,
          }))
          return { ok: false, error: scheduleError }
        }
      }
      commitDb((prev) => {
        const logged = addLog(prev, found, {
          storeId: store.id,
          action: 'login_success',
          entity: 'auth',
          entityId: found.id,
          summary: `Signed in with username ${needle.slice(0, 254)}`,
        })
        return found.role === 'staff' ? clockInAttendance(logged, found) : logged
      })
      userIdRef.current = found.id
      setSessionUserId(found.id)
      return { ok: true, user: found }
    },
    [dbRef, ready, loadError, pinFailures, recordFailure, commitDb, setSessionUserId, provider, applyProviderSnapshot],
  )

  const logout = useCallback(() => {
    provider.logout()
    const actor = dbRef.current.users.find((candidate) => candidate.id === userIdRef.current)
    if (actor) {
      commitDb((prev) => {
        const logged = addLog(prev, actor, {
          storeId: actor.storeId ?? 'system',
          action: 'logout',
          entity: 'auth',
          entityId: actor.id,
          summary: 'Logged out',
        })
        return actor.role === 'staff' ? clockOutAttendance(logged, actor) : logged
      })
    }
    userIdRef.current = null
    setSessionUserId(null)
  }, [commitDb, dbRef, setSessionUserId, provider])


  return { userId, userIdRef, setUserId: setSessionUserId, login, loginPin, logout }
}

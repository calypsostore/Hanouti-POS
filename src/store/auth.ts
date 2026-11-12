import { useCallback, useEffect, useRef, useState } from 'react'
import type { Database } from '../types'
import { verifySecret } from '../lib/hash'
import type { Result } from './types'
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
}

export function useAuthSlice(dependencies: AuthSliceDependencies) {
  const { dbRef, ready, loadError } = dependencies
  const [userId, setStoredUserId] = useState<string | null>(readStoredUserId)
  const userIdRef = useRef<string | null>(userId)
  const pinFailures = useRef(new Map<string, { count: number; lockedUntil: number }>())
  const setSessionUserId = useCallback((next: string | null) => {
    userIdRef.current = next
    setStoredUserId(next)
  }, [])
  useEffect(() => {
    try {
      if (userId) localStorage.setItem(SESSION_KEY, userId)
      else localStorage.removeItem(SESSION_KEY)
      for (const key of LEGACY_SESSION_KEYS) localStorage.removeItem(key)
    } catch { /* ignore */ }
  }, [userId])
  const login = useCallback(
    async (email: string, password: string): Promise<Result> => {
      if (!ready) return { ok: false, error: loadError || 'The local database is still loading.' }
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) return { ok: false, error: 'Enter your email address.' }
      const current = dbRef.current
      const found = current.users.find((u) =>
        u.role !== 'staff' && u.email?.toLowerCase() === normalizedEmail,
      )
      if (!found || !(await verifySecret(password, found.password))) {
        return { ok: false, error: 'Incorrect email or password.' }
      }
      if (!found.active) return { ok: false, error: 'This account has been deactivated.' }
      if (found.storeId) {
        const owner = current.stores.find((s) => s.id === found.storeId)
        if (owner?.status === 'suspended') {
          return { ok: false, error: 'This store is suspended. Contact the platform owner.' }
        }
      }
      userIdRef.current = found.id
      setSessionUserId(found.id)
      return { ok: true }
    },
    [dbRef, ready, loadError, setSessionUserId],
  )

  const loginPin = useCallback(
    async (username: string, pin: string): Promise<Result> => {
      const needle = username.trim().toLowerCase()
      if (!ready) return { ok: false, error: loadError || 'The local database is still loading.' }
      if (!needle) return { ok: false, error: 'Enter your username.' }
      const current = dbRef.current
      const failure = pinFailures.current.get(needle)
      if (failure?.lockedUntil && failure.lockedUntil > Date.now()) {
        const seconds = Math.ceil((failure.lockedUntil - Date.now()) / 1000)
        return { ok: false, error: `Too many failed PIN attempts. Try again in ${seconds} seconds.` }
      }
      const found = current.users.find(
        (user) => user.role === 'staff' && user.username?.toLowerCase() === needle,
      )
      const enteredPin = pin.trim()
      const validPin = found && /^\d{4,6}$/.test(enteredPin)
        ? await verifySecret(enteredPin, found.pin)
        : false
      if (!found || !validPin) {
        const latestFailure = pinFailures.current.get(needle)
        if (latestFailure?.lockedUntil && latestFailure.lockedUntil > Date.now()) {
          const seconds = Math.ceil((latestFailure.lockedUntil - Date.now()) / 1000)
          return { ok: false, error: `Too many failed PIN attempts. Try again in ${seconds} seconds.` }
        }
        const attempts = (latestFailure?.count ?? 0) + 1
        pinFailures.current.set(needle, {
          count: attempts >= 5 ? 0 : attempts,
          lockedUntil: attempts >= 5 ? Date.now() + 30_000 : 0,
        })
        return {
          ok: false,
          error: attempts >= 5
            ? 'Too many failed PIN attempts. Try again in 30 seconds.'
            : 'Username or PIN not recognised.',
        }
      }
      pinFailures.current.delete(needle)
      if (!found.active) return { ok: false, error: 'This account has been deactivated.' }
      const store = found.storeId
        ? current.stores.find((candidate) => candidate.id === found.storeId)
        : undefined
      if (!store) return { ok: false, error: 'This staff account is not linked to a store.' }
      if (store.status === 'suspended') {
        return { ok: false, error: 'This store is suspended. Contact your manager.' }
      }
      userIdRef.current = found.id
      setSessionUserId(found.id)
      return { ok: true }
    },
    [dbRef, ready, loadError, pinFailures, setSessionUserId],
  )

  const logout = useCallback(() => {
    userIdRef.current = null
    setSessionUserId(null)
  }, [setSessionUserId])


  return { userId, userIdRef, setUserId: setSessionUserId, login, loginPin, logout }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Database, User } from '../types'
import { verifySecret } from '../lib/hash'
import type { Result } from './types'
import { SESSION_KEY } from './database'

type AuthSliceDependencies = {
  dbRef: { current: Database }
  ready: boolean
  loadError: string
}

export function useAuthSlice(dependencies: AuthSliceDependencies) {
  const { dbRef, ready, loadError } = dependencies
  const [userId, setStoredUserId] = useState<string | null>(() => {
    try { return localStorage.getItem(SESSION_KEY) } catch { return null }
  })
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
    } catch { /* ignore */ }
  }, [userId])
  const login = useCallback(
    async (email: string, password: string): Promise<Result> => {
      if (!ready) return { ok: false, error: loadError || 'The local database is still loading.' }
      const current = dbRef.current
      const found = current.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
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
    async (slug: string, pin: string): Promise<Result> => {
      const needle = slug.trim().toLowerCase()
      if (!ready) return { ok: false, error: loadError || 'The local database is still loading.' }
      const current = dbRef.current
      const target = current.stores.find(
        (s) => s.slug.toLowerCase() === needle || s.id.toLowerCase() === needle,
      )
      if (!target) return { ok: false, error: 'Store code not found.' }
      if (target.status === 'suspended') {
        return { ok: false, error: 'This store is suspended. Contact your manager.' }
      }
      const failure = pinFailures.current.get(target.id)
      if (failure?.lockedUntil && failure.lockedUntil > Date.now()) {
        const seconds = Math.ceil((failure.lockedUntil - Date.now()) / 1000)
        return { ok: false, error: `Too many failed PIN attempts. Try again in ${seconds} seconds.` }
      }
      const candidates = current.users.filter((u) => u.storeId === target.id && u.active)
      let found: User | undefined
      for (const candidate of candidates) {
        if (await verifySecret(pin.trim(), candidate.pin)) {
          found = candidate
          break
        }
      }
      if (!found) {
        const latestFailure = pinFailures.current.get(target.id)
        if (latestFailure?.lockedUntil && latestFailure.lockedUntil > Date.now()) {
          const seconds = Math.ceil((latestFailure.lockedUntil - Date.now()) / 1000)
          return { ok: false, error: `Too many failed PIN attempts. Try again in ${seconds} seconds.` }
        }
        const attempts = (latestFailure?.count ?? 0) + 1
        pinFailures.current.set(target.id, {
          count: attempts >= 5 ? 0 : attempts,
          lockedUntil: attempts >= 5 ? Date.now() + 30_000 : 0,
        })
        return {
          ok: false,
          error: attempts >= 5
            ? 'Too many failed PIN attempts. Try again in 30 seconds.'
            : 'PIN not recognised for this store.',
        }
      }
      pinFailures.current.delete(target.id)
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

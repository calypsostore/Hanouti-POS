import { useCallback, useEffect, useRef, useState } from 'react'
import type { Database } from '../types'
import { buildSeed } from '../data/seed'
import { loadDb, DB_KEY } from './database'
import type { ActorResult } from './types'

type DatabaseRuntime = {
  db: Database
  dbRef: { current: Database }
  ready: boolean
  loadError: string
  commitDb: (update: (prev: Database) => Database) => Database
}

export function useDatabase(): DatabaseRuntime {
  const [db, setDbState] = useState<Database>(buildSeed)
  const dbRef = useRef(db)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const commitDb = useCallback((update: (prev: Database) => Database) => {
    const next = update(dbRef.current)
    dbRef.current = next
    setDbState(next)
    return next
  }, [])

  useEffect(() => {
    let active = true
    void loadDb().then((loaded) => {
      if (!active) return
      dbRef.current = loaded
      setDbState(loaded)
      setReady(true)
    }).catch((error: unknown) => {
      if (!active) return
      setLoadError(error instanceof Error ? error.message : 'Could not load the local database.')
      setReady(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!ready || loadError) return
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)) } catch { /* storage full ? ignore in demo */ }
  }, [db, loadError, ready])

  return { db, dbRef, ready, loadError, commitDb }
}

export function useActorGuards({
  dbRef, ready, loadError, userIdRef,
}: Pick<DatabaseRuntime, 'dbRef' | 'ready' | 'loadError'> & { userIdRef: { current: string | null } }) {
  const requireActor = useCallback((storeId?: string): ActorResult => {
    if (!ready) return { ok: false, error: loadError || 'The local database is still loading.' }
    const actor = dbRef.current.users.find((candidate) => candidate.id === userIdRef.current)
    if (!actor?.active) return { ok: false, error: 'No active session.' }
    if (storeId && actor.storeId !== storeId) return { ok: false, error: 'You can only manage your own store.' }
    return { ok: true, actor }
  }, [dbRef, ready, loadError, userIdRef])

  const requireAdmin = useCallback((storeId: string): ActorResult => {
    const result = requireActor(storeId)
    if (!result.ok) return result
    if (result.actor.role !== 'admin') return { ok: false, error: 'Only a store admin can perform this action.' }
    return result
  }, [requireActor])

  return { requireActor, requireAdmin }
}

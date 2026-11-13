import { useCallback, useEffect, useRef, useState } from 'react'
import type { Database } from '../types'
import { buildSeed } from '../data/seed'
import { useToast } from '../components/toast'
import { readIndexedValue, writeIndexedValue } from '../lib/storage'
import { APP_BUILD_STORAGE_KEY, APP_BUILD_TIMESTAMP, APP_VERSION, getOffByDefaultSettings } from '../lib/appVersion'
import { clearLocalDatabaseCopies, loadDb, DB_KEY } from './database'
import { addLog } from './audit'
import { can } from '../lib/permissions'
import type { Capability } from '../types'
import type { ActorResult } from './types'

type DatabaseRuntime = {
  db: Database
  dbRef: { current: Database }
  ready: boolean
  loadError: string
  commitDb: (update: (prev: Database) => Database) => Database
}

export function useDatabase(): DatabaseRuntime {
  const { push } = useToast()
  const [db, setDbState] = useState<Database>(buildSeed)
  const dbRef = useRef(db)
  const persistenceWarningShown = useRef(false)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const reportStorageError = useCallback((operation: string, error: unknown) => {
    console.error(`7anouti: failed while ${operation}.`, error)
    if (operation === 'saving IndexedDB') {
      if (persistenceWarningShown.current) return
      persistenceWarningShown.current = true
      push('Changes could not be saved in this browser. They will remain available until you close this page.', 'error')
      return
    }
    if (operation.includes('app build metadata')) {
      push('Could not update app-version information in this browser.', 'error')
    }
  }, [push])
  const commitDb = useCallback((update: (prev: Database) => Database) => {
    const next = update(dbRef.current)
    dbRef.current = next
    setDbState(next)
    return next
  }, [])

  useEffect(() => {
    let active = true
    const initialize = async () => {
      let previousBuildTimestamp: string | null = null
      try {
        previousBuildTimestamp = await readIndexedValue(APP_BUILD_STORAGE_KEY)
      } catch (error) {
        reportStorageError('reading app build metadata', error)
      }
      const { database: loaded, hasPersistedData } = await loadDb(dbRef.current, reportStorageError)
      if (!active) return
      const previousBuildTime = previousBuildTimestamp ? Date.parse(previousBuildTimestamp) : Number.NaN
      const currentBuildTime = Date.parse(APP_BUILD_TIMESTAMP)
      const isNewerBuild = Number.isFinite(previousBuildTime)
        ? Number.isFinite(currentBuildTime) && currentBuildTime > previousBuildTime
        : hasPersistedData
      const next = isNewerBuild
        ? loaded.stores.reduce((current, store) => addLog(current, {
            id: 'system',
            name: '7anouti',
            role: 'unknown',
          }, {
            storeId: store.id,
            action: 'app_updated',
            entity: 'settings',
            summary: `App updated to ${APP_VERSION}`,
          }), loaded)
        : loaded
      let saveBuildUpdate = true
      if (isNewerBuild) {
        try {
          await writeIndexedValue(DB_KEY, JSON.stringify(next))
          clearLocalDatabaseCopies()
        } catch (error) {
          saveBuildUpdate = false
          reportStorageError('saving IndexedDB', error)
        }
      }
      dbRef.current = next
      setDbState(next)
      setReady(true)
      if (isNewerBuild) {
        const newSettings = getOffByDefaultSettings(next)
        const settingNote = newSettings.length
          ? ` New settings off by default: ${newSettings.join(', ')}.`
          : ''
        push(`App updated to ${APP_VERSION}.${settingNote}`, 'info')
      }
      if (saveBuildUpdate) {
        try {
          await writeIndexedValue(APP_BUILD_STORAGE_KEY, APP_BUILD_TIMESTAMP)
        } catch (error) {
          reportStorageError('saving app build metadata', error)
        }
      }
    }
    void initialize().catch((error: unknown) => {
      if (!active) return
      console.error('7anouti: database initialization failed.', error)
      setLoadError(error instanceof Error ? error.message : 'Could not load the local database.')
      setReady(true)
    })
    return () => { active = false }
  }, [push, reportStorageError])

  useEffect(() => {
    if (!ready || loadError) return
    const timeout = window.setTimeout(() => {
      let serialized: string
      try {
        serialized = JSON.stringify(db)
      } catch (error) {
        reportStorageError('serializing the database', error)
        return
      }
      void writeIndexedValue(DB_KEY, serialized).then(
        clearLocalDatabaseCopies,
        (error: unknown) => reportStorageError('saving IndexedDB', error),
      )
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [db, loadError, ready, reportStorageError])

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

  const requireCapability = useCallback((storeId: string, capability: Capability): ActorResult => {
    const result = requireActor(storeId)
    if (!result.ok) return result
    if (!can(result.actor, capability)) {
      return { ok: false, error: 'You do not have permission to perform this action.' }
    }
    return result
  }, [requireActor])

  return { requireActor, requireAdmin, requireCapability }
}

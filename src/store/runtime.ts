import { useCallback, useEffect, useRef, useState } from 'react'
import type { Database } from '../types'
import { buildSeed } from '../data/seed'
import { useToast } from '../components/toast'
import { readIndexedValue, writeIndexedValue } from '../lib/storage'
import { APP_BUILD_STORAGE_KEY, APP_BUILD_TIMESTAMP, APP_VERSION, getOffByDefaultSettings } from '../lib/appVersion'
import { clearLocalDatabaseCopies, loadDb, DB_KEY } from './database'
import { normalizeDb } from './database'
import { addLog } from './audit'
import { can } from '../lib/permissions'
import { openShiftForStaff } from '../lib/registerShifts'
import { mergeOpenOrderSnapshots } from '../lib/openOrderMerge'
import { diffCollections, type SyncDocument } from '../shared/sync'
import { detectDataProvider, LocalProvider, type DataProvider, type ProviderStatus } from './providers/DataProvider'
import type { Capability } from '../types'
import type { ActorResult } from './types'

type DatabaseRuntime = {
  db: Database
  dbRef: { current: Database }
  ready: boolean
  loadError: string
  commitDb: (update: (prev: Database) => Database) => Database
  provider: DataProvider
  providerStatus: ProviderStatus
  applyProviderSnapshot: (snapshot: Database) => void
}

export function useDatabase(): DatabaseRuntime {
  const { push } = useToast()
  const [db, setDbState] = useState<Database>(buildSeed)
  const dbRef = useRef(db)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const remoteSnapshotRef = useRef<Database | null>(null)
  const persistenceWarningShown = useRef(false)
  const providerRef = useRef<DataProvider>(new LocalProvider())
  const [provider, setProvider] = useState<DataProvider>(providerRef.current)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>(providerRef.current.status())
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
    if (operation.includes('hub')) {
      push(`Hub sync issue: ${error instanceof Error ? error.message : 'The hub request failed.'}`, 'error')
    }
  }, [push])
  const applyHubSnapshot = useCallback((snapshot: Database) => {
    const normalized = normalizeDb(snapshot, dbRef.current)
    if (!normalized) {
      reportStorageError('applying a hub database snapshot', new Error('The hub snapshot did not match the app database shape.'))
      return
    }
    dbRef.current = normalized
    providerRef.current.setCache(normalized)
    remoteSnapshotRef.current = normalized
    setDbState(normalized)
  }, [reportStorageError])
  const commitDb = useCallback((update: (prev: Database) => Database) => {
    const previous = dbRef.current
    const next = update(previous)
    dbRef.current = next
    providerRef.current.setCache(next)
    setDbState(next)
    const activeProvider = providerRef.current
    if (activeProvider.mode === 'hub') {
      let sessionUserId: string | null = null
      try { sessionUserId = localStorage.getItem('7anouti.session.v2') } catch { /* The in-memory session still works. */ }
      const storeId = next.users.find((candidate) => candidate.id === sessionUserId)?.storeId
      if (storeId) {
        const asCollections = (value: Database) =>
          Object.fromEntries(Object.entries(value).map(([key, rows]) => [
            key,
            key === 'printJobs'
              ? []
              : (rows as Array<SyncDocument & { storeId?: string }>).filter((row) =>
                  key === 'stores' ? row.id === storeId : row.storeId === storeId,
                ),
          ]))
        const changeSet = diffCollections(asCollections(previous), asCollections(next), {
          opId: typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          deviceId: activeProvider.deviceIdentifier(),
          storeId,
          baseSeq: activeProvider.currentSequence(),
        })
        void activeProvider.queueChangeSet(changeSet).catch((error: unknown) =>
          reportStorageError('saving changes to the hub outbox', error),
        )
      }
    }
    return next
  }, [reportStorageError])

  useEffect(() => {
    const unsubscribe = provider.subscribe(() => setProviderStatus(provider.status()))
    return unsubscribe
  }, [provider])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('7anouti-pos:database-updates')
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data !== 'database-updated') return
      void readIndexedValue(DB_KEY).then((raw) => {
        if (!raw) throw new Error('The saved database was missing after a cross-tab update.')
        const normalized = normalizeDb(JSON.parse(raw), dbRef.current)
        if (!normalized) throw new Error('The saved database from another tab was invalid.')
        const merged = mergeOpenOrderSnapshots(normalized, dbRef.current)
        dbRef.current = merged
        remoteSnapshotRef.current = merged
        setDbState(merged)
      }).catch((error: unknown) => reportStorageError('applying a cross-tab database update', error))
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [reportStorageError])

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
      const selectedProvider = await detectDataProvider((message) => push(message, 'error'), next)
      if (!active) return
      providerRef.current = selectedProvider
      setProvider(selectedProvider)
      setProviderStatus(selectedProvider.status())
      if (selectedProvider.mode === 'hub' && selectedProvider.hasSession()) {
        const snapshot = await selectedProvider.pullSnapshot()
        if (snapshot) {
          const normalized = normalizeDb(snapshot.database, next)
          if (normalized) {
            dbRef.current = normalized
            selectedProvider.setCache(normalized)
            setDbState(normalized)
          } else {
            reportStorageError('applying a hub database snapshot', new Error('The hub snapshot did not match the app database shape.'))
            dbRef.current = next
            setDbState(next)
          }
        } else {
          dbRef.current = next
          setDbState(next)
        }
      } else {
        dbRef.current = next
        setDbState(next)
      }
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
  }, [applyHubSnapshot, push, reportStorageError])

  useEffect(() => {
    const unsubscribeSnapshot = provider.useSnapshot((snapshot) => applyHubSnapshot(snapshot))
    const unsubscribeStatus = provider.subscribe(() => setProviderStatus(provider.status()))
    return () => {
      unsubscribeSnapshot()
      unsubscribeStatus()
    }
  }, [applyHubSnapshot, provider])

  useEffect(() => {
    if (!ready || loadError) return
    if (remoteSnapshotRef.current === db) {
      remoteSnapshotRef.current = null
      return
    }
    remoteSnapshotRef.current = null
    const timeout = window.setTimeout(() => {
      const current = dbRef.current
      let serialized: string
      try {
        serialized = JSON.stringify(current)
      } catch (error) {
        reportStorageError('serializing the database', error)
        return
      }
      void readIndexedValue(DB_KEY).then((raw) => {
        if (!raw) return current
        const persisted = normalizeDb(JSON.parse(raw), current)
        return persisted ? mergeOpenOrderSnapshots(current, persisted) : current
      }).then((snapshot) => {
        serialized = JSON.stringify(snapshot)
        if (snapshot !== dbRef.current) {
          dbRef.current = snapshot
          setDbState(snapshot)
        }
        return writeIndexedValue(DB_KEY, serialized)
      }).then(
        () => {
          clearLocalDatabaseCopies()
          channelRef.current?.postMessage('database-updated')
        },
        (error: unknown) => reportStorageError('saving IndexedDB', error),
      )
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [db, loadError, ready, reportStorageError])

  return {
    db, dbRef, ready, loadError, commitDb, provider, providerStatus,
    applyProviderSnapshot: applyHubSnapshot,
  }
}

export function useActorGuards({
  dbRef, ready, loadError, userIdRef,
}: Pick<DatabaseRuntime, 'dbRef' | 'ready' | 'loadError'> & { userIdRef: { current: string | null } }) {
  const requireActor = useCallback((storeId?: string, allowStaffWithoutShift = false): ActorResult => {
    if (!ready) return { ok: false, error: loadError || 'The local database is still loading.' }
    const actor = dbRef.current.users.find((candidate) => candidate.id === userIdRef.current)
    if (!actor?.active) return { ok: false, error: 'No active session.' }
    if (storeId && actor.storeId !== storeId) return { ok: false, error: 'You can only manage your own store.' }
    const store = actor.storeId
      ? dbRef.current.stores.find((candidate) => candidate.id === actor.storeId)
      : undefined
    if (actor.role === 'staff' && !actor.stationOnly && !allowStaffWithoutShift &&
      store?.settings.shiftAccess.requireOpenShiftForStoreAccess &&
      !openShiftForStaff(dbRef.current, actor.storeId ?? '', actor.id)) {
      return { ok: false, error: 'Open your shift before accessing store operations.' }
    }
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

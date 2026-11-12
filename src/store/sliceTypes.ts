import type { Database } from '../types'
import type { ActorResult } from './types'

type DbRef = { current: Database }
type UserIdRef = { current: string | null }
type CommitDb = (update: (prev: Database) => Database) => Database
type RequireActor = (storeId?: string) => ActorResult
type RequireAdmin = (storeId: string) => ActorResult

export interface StoreSliceDependencies {
  dbRef: DbRef
  commitDb: CommitDb
  requireActor: RequireActor
  requireAdmin: RequireAdmin
}

export interface SettingsSliceDependencies extends StoreSliceDependencies {
  userIdRef: UserIdRef
  setUserId: (userId: string | null) => void
}

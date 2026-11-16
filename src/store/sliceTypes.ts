import type { Database } from '../types'
import type { Capability } from '../types'
import type { ActorResult } from './types'
import type { DataProvider } from './providers/DataProvider'
import type { AuthorizationPinPurpose, AuthorizationPinResult } from '../lib/authorizationPin'

type DbRef = { current: Database }
type UserIdRef = { current: string | null }
type CommitDb = (update: (prev: Database) => Database) => Database
type RequireActor = (storeId?: string, allowStaffWithoutShift?: boolean) => ActorResult
type RequireAdmin = (storeId: string) => ActorResult
type RequireCapability = (storeId: string, capability: Capability) => ActorResult

export interface StoreSliceDependencies {
  dbRef: DbRef
  commitDb: CommitDb
  requireActor: RequireActor
  requireAdmin: RequireAdmin
  requireCapability: RequireCapability
  verifyAuthorizationPin: (
    pin: string,
    storeId: string,
    purpose: AuthorizationPinPurpose,
  ) => Promise<AuthorizationPinResult>
  provider: DataProvider
}

export interface SettingsSliceDependencies extends StoreSliceDependencies {
  userIdRef: UserIdRef
  setUserId: (userId: string | null) => void
}

import type { ChangeSet, SyncDocument, SyncState } from '../../src/shared/sync.ts'

export interface HubStoreState extends SyncState {
  storeId: string
}

export interface HubUser extends SyncDocument {
  id: string
  storeId: string
  username?: string
  email?: string
  name: string
  role: 'admin' | 'manager' | 'staff'
  active: boolean
  password: string
  pin: string
  mustChangePassword?: boolean
  permissions: Record<string, boolean | undefined>
  stationOnly?: boolean
}

export interface AuthenticatedActor {
  storeId: string
  userId: string
  role: HubUser['role']
  permissions: HubUser['permissions']
  stationOnly: boolean
  deviceId?: string
  stationIds?: string[]
  deviceToken?: boolean
}

export interface PersistedChange {
  seq: number
  changeSet: ChangeSet
  state?: HubStoreState
}

export type JsonRecord = SyncDocument & { storeId: string }

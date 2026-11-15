import type { ChangeSet } from '../../shared/sync'

export interface CloudSyncAdapter {
  push(changeSet: ChangeSet): Promise<void>
  pull(afterSequence: number): Promise<{ sequence: number; changes: ChangeSet[] }>
}

export class UnavailableCloudSyncAdapter implements CloudSyncAdapter {
  async push(): Promise<void> {
    throw new Error('Cloud sync is not configured. The shop hub remains the sync authority.')
  }

  async pull(): Promise<{ sequence: number; changes: ChangeSet[] }> {
    throw new Error('Cloud sync is not configured. The shop hub remains the sync authority.')
  }
}

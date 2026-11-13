import type { Database } from '../types'

export const APP_VERSION = __APP_VERSION__
export const APP_BUILD_TIMESTAMP = __APP_BUILD_TIMESTAMP__
export const APP_BUILD_STORAGE_KEY = '7anouti.app-build-timestamp'

export function getOffByDefaultSettings(database: Database): string[] {
  return database.stores.some((store) => !store.settings.features.tables) ? ['Tables'] : []
}

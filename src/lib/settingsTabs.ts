import type { StoreSettings, User } from '../types.ts'
import { can } from './permissions.ts'
import { modeFeatures } from './posMode.ts'

export type SettingsTab =
  | 'profile'
  | 'branding'
  | 'register'
  | 'permissions'
  | 'receipt'
  | 'tables'
  | 'stations'
  | 'service'
  | 'devices'
  | 'automation'
  | 'connectivity'
  | 'data'

export function visibleSettingsTabs(settings: StoreSettings, user: User | null): SettingsTab[] {
  const quick = !modeFeatures(settings).payments
  const tabs: SettingsTab[] = quick
    ? ['profile', 'branding', 'register', 'devices', 'automation', 'connectivity']
    : ['profile', 'branding', 'register', 'receipt', 'tables', 'stations', 'service', 'devices', 'automation', 'connectivity']
  if (quick && user && can(user, 'manageStaff')) tabs.splice(3, 0, 'permissions')
  if (user?.role === 'admin') tabs.push('data')
  return tabs
}

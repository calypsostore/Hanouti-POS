import { Capacitor } from '@capacitor/core'
import { Download } from 'lucide-react'
import AppUpdatesSection from '../pages/admin/Settings/AppUpdatesSection'
import { SectionCard } from './dashboard/SectionCard'

export function ApplicationUpdatesCard() {
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  if (!isAndroidNative) return null

  return (
    <SectionCard
      icon={Download}
      tone="amber"
      title="Application updates"
      subtitle="Check and install the latest Android app version"
    >
      <AppUpdatesSection embedded />
    </SectionCard>
  )
}

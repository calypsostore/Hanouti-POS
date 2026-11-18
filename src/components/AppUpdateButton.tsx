import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Download } from 'lucide-react'
import { useApp } from '../store/AppStore'
import AppUpdatesSection from '../pages/admin/Settings/AppUpdatesSection'
import { Button, Modal } from './ui'

export function AppUpdateButton() {
  const { user } = useApp()
  const [open, setOpen] = useState(false)
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

  if (!user || !isAndroidNative) return null

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-4 z-40 shadow-lg sm:bottom-4"
      >
        <Download className="h-4 w-4" />
        Check for updates
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="App updates" size="sm">
        <AppUpdatesSection />
      </Modal>
    </>
  )
}

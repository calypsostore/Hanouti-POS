import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { X } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { UpdateBanner } from './UpdateBanner'

export function AppShell() {
  const { user } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  if (!user) return null

  const sidebarWidth = collapsed ? 'lg:pl-[78px]' : 'lg:pl-[258px]'
  return (
    <div className="min-h-screen transition-[padding]">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden transition-[width] lg:block ${collapsed ? 'w-[78px]' : 'w-[258px]'}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-brand-navy/55" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
          <div className="relative h-full w-[258px] animate-[slideLeft_.2s_ease-out]">
            <Sidebar collapsed={false} mobile onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
          </div>
          <button type="button" onClick={() => setMobileOpen(false)} className="absolute left-[270px] top-4 rounded-full bg-white p-2 text-ink shadow-lg" aria-label="Close navigation"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className={`min-h-screen ${sidebarWidth}`}>
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto min-h-[calc(100vh-68px)] max-w-[1680px] px-3 py-4 pb-36 sm:px-5 sm:py-6 sm:pb-28 lg:px-7 lg:py-7 lg:pb-10">
          <UpdateBanner />
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}

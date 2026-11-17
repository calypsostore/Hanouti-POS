import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { AppProvider, useApp } from './store/AppStore'
import { ToastProvider } from './components/toast'
import { AppShell } from './components/Layout'
import Login from './pages/Login'
import POS from './pages/POS'
import TableFloor from './pages/pos/TableFloor'
import StationBoard from './pages/pos/StationBoard'
import AdminOverview from './pages/admin/Overview'
import StaffDashboard from './pages/admin/overview/StaffDashboard'
import Orders from './pages/admin/Orders'
import Customers from './pages/admin/Customers'
import Register from './pages/admin/Register'
import Products from './pages/admin/Products'
import Inventory from './pages/admin/Inventory'
import Purchases from './pages/admin/Purchases'
import Staff from './pages/admin/Staff'
import StaffDetail from './pages/admin/staff/StaffDetail'
import Reports from './pages/admin/Reports'
import Expenses from './pages/admin/Expenses'
import ActivityLog from './pages/admin/ActivityLog'
import Settings from './pages/admin/Settings'
import SetupWizard from './pages/admin/SetupWizard'
import SuperOverview from './pages/super/Overview'
import SuperStores from './pages/super/Stores'
import type { Role, User } from './types'
import type { Capability } from './types'
import { can } from './lib/permissions'
import { canViewCustomerTabs } from './lib/customerTabs'
import { isCashier, modeFeatures, type PosModeFeatures } from './lib/posMode'
import { openShiftForStaff } from './lib/registerShifts'
import { hasStationDeviceSession } from './lib/stationDeviceSession'
import PairStationDevice from './pages/PairStationDevice'
import StationDeviceKiosk from './pages/StationDeviceKiosk'
import { SessionAutomationGuard } from './components/SessionAutomationGuard'

function homeFor(user: User) {
  if (user.stationOnly) return user.stationId ? `/station/${encodeURIComponent(user.stationId)}` : '/kitchen'
  if (user.role === 'super') return '/super'
  if (user.role === 'staff') return '/staff'
  return '/admin'
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, databaseReady, databaseError } = useApp()
  if (!databaseReady && !databaseError) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">Loading your workspace…</div>
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function StationOnlyGate({ children }: { children: React.ReactNode }) {
  const { user } = useApp()
  const { pathname } = useLocation()
  if (user?.stationOnly && pathname !== '/kitchen' && !/^\/station\/[^/]+$/.test(pathname)) {
    return <Navigate to={homeFor(user)} replace />
  }
  return <>{children}</>
}

function DeviceKioskGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  if (hasStationDeviceSession() && pathname !== '/kiosk') {
    return <Navigate to="/kiosk" replace />
  }
  return <>{children}</>
}

function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />
  return <>{children}</>
}

function CapabilityGate({ capability, children }: { capability: Capability; children: React.ReactNode }) {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (!can(user, capability)) return <Navigate to={user.role === 'manager' ? '/pos' : homeFor(user)} replace />
  return <>{children}</>
}

function ModeFeatureGate({ feature, children }: {
  feature: keyof PosModeFeatures
  children: React.ReactNode
}) {
  const { store, user } = useApp()
  if (!store || !user) return <Navigate to="/login" replace />
  if (feature === 'tablesFloor' && isCashier(store)) return <>{children}</>
  if (!modeFeatures(store)[feature]) return <Navigate to={homeFor(user)} replace />
  return <>{children}</>
}

function CustomerTabsGate({ children }: { children: React.ReactNode }) {
  const { store, user } = useApp()
  if (!store || !user) return <Navigate to="/login" replace />
  if (!canViewCustomerTabs(store, user)) return <Navigate to={homeFor(user)} replace />
  return <>{children}</>
}

function RegisterGate({ children }: { children: React.ReactNode }) {
  const { user, store } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (!can(user, 'openShift') && !can(user, 'closeShift')) {
    if (user.role === 'staff' && store?.settings.shiftAccess.requireOpenShiftForStoreAccess) {
      return <div className="p-6 text-sm text-muted">Ask the store owner to enable shift access for your account.</div>
    }
    return <Navigate to={user.role === 'staff' ? '/pos' : '/admin'} replace />
  }
  return <>{children}</>
}

function StaffShiftAccessGate({ children }: { children: React.ReactNode }) {
  const { db, store, user } = useApp()
  const { pathname } = useLocation()
  if (!user || user.role !== 'staff' || user.stationOnly ||
    !store?.settings.shiftAccess.requireOpenShiftForStoreAccess ||
    openShiftForStaff(db, store.id, user.id) || pathname === '/admin/register') {
    return <>{children}</>
  }
  return <Navigate to="/admin/register" replace />
}

function LoginRoute() {
  const { user } = useApp()
  if (user) return <Navigate to={homeFor(user)} replace />
  return <Login />
}

function AdminShell() {
  const { store, user } = useApp()
  if (store && !store.setupComplete) {
    if (user?.role === 'admin') return <SetupWizard />
    return <div className="p-6 text-sm text-muted">The store owner must finish setup before the team can continue.</div>
  }
  return <AppShell />
}

function POSPage() {
  const [searchParams] = useSearchParams()
  return <POS key={`${searchParams.get('channel') ?? ''}:${searchParams.get('focus') ?? ''}:${searchParams.get('orderId') ?? ''}`} />
}

function StoreSetupGate({ children }: { children: React.ReactNode }) {
  const { user, store } = useApp()
  if (user?.role === 'admin' && store && !store.setupComplete) return <Navigate to="/admin" replace />
  return <>{children}</>
}

function HomeRoute() {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homeFor(user)} replace />
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <BrowserRouter>
          <ScrollToTop />
          <DeviceKioskGate>
          <StationOnlyGate>
          <SessionAutomationGuard>
          <StaffShiftAccessGate>
          <Routes>
            <Route path="/pair" element={<PairStationDevice />} />
            <Route path="/kiosk" element={<StationDeviceKiosk />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/" element={<HomeRoute />} />

            <Route
              path="/staff"
              element={
                <Protected>
                  <RoleGate roles={['staff']}>
                    <AppShell />
                  </RoleGate>
                </Protected>
              }
            >
              <Route index element={<StaffDashboard />} />
            </Route>

            <Route
              path="/pos"
              element={
                <Protected>
                  <RoleGate roles={['admin', 'manager', 'staff']}>
                    <StoreSetupGate>
                      <POSPage />
                    </StoreSetupGate>
                  </RoleGate>
                </Protected>
              }
            />
            <Route
              path="/pos/floor"
              element={
                <Protected>
                  <RoleGate roles={['admin', 'manager', 'staff']}>
                    <StoreSetupGate>
                      <ModeFeatureGate feature="tablesFloor">
                        <TableFloor />
                      </ModeFeatureGate>
                    </StoreSetupGate>
                  </RoleGate>
                </Protected>
              }
            />
            <Route
              path="/kitchen"
              element={
                <Protected>
                  <RoleGate roles={['admin', 'manager', 'staff']}>
                    <StoreSetupGate>
                      <ModeFeatureGate feature="kitchenStations">
                        <CapabilityGate capability="viewStation">
                          <StationBoard />
                        </CapabilityGate>
                      </ModeFeatureGate>
                    </StoreSetupGate>
                  </RoleGate>
                </Protected>
              }
            />
            <Route
              path="/station/:stationId"
              element={
                <Protected>
                  <RoleGate roles={['admin', 'manager', 'staff']}>
                    <StoreSetupGate>
                      <ModeFeatureGate feature="kitchenStations">
                        <CapabilityGate capability="viewStation">
                          <StationBoard />
                        </CapabilityGate>
                      </ModeFeatureGate>
                    </StoreSetupGate>
                  </RoleGate>
                </Protected>
              }
            />

            <Route
              path="/admin"
              element={
                <Protected>
                  <RoleGate roles={['admin', 'manager', 'staff']}>
                    <AdminShell />
                  </RoleGate>
                </Protected>
              }
            >
              <Route
                index
                element={
                  <CapabilityGate capability="viewReports">
                    <AdminOverview />
                  </CapabilityGate>
                }
              />
              <Route path="orders" element={<RoleGate roles={['admin', 'manager', 'staff']}><Orders /></RoleGate>} />
              <Route path="customers" element={<CustomerTabsGate><Customers /></CustomerTabsGate>} />
              <Route path="register" element={<RegisterGate><Register /></RegisterGate>} />
              <Route
                path="products"
                element={
                  <ModeFeatureGate feature="inventory">
                    <CapabilityGate capability="manageProducts">
                      <Products />
                    </CapabilityGate>
                  </ModeFeatureGate>
                }
              />
              <Route
                path="inventory"
                element={
                  <ModeFeatureGate feature="inventory">
                    <CapabilityGate capability="manageInventory">
                      <Inventory />
                    </CapabilityGate>
                  </ModeFeatureGate>
                }
              />
              <Route
                path="purchases"
                element={
                  <ModeFeatureGate feature="purchases">
                    <CapabilityGate capability="recordPurchases">
                      <Purchases />
                    </CapabilityGate>
                  </ModeFeatureGate>
                }
              />
              <Route
                path="staff"
                element={
                  <RoleGate roles={['admin', 'manager', 'staff']}>
                    <Staff />
                  </RoleGate>
                }
              />
              <Route
                path="staff/:id"
                element={
                  <RoleGate roles={['admin', 'manager', 'staff']}>
                    <StaffDetail />
                  </RoleGate>
                }
              />
              <Route
                path="reports"
                element={
                  <CapabilityGate capability="viewReports">
                    <Reports />
                  </CapabilityGate>
                }
              />
              <Route
                path="expenses"
                element={
                  <RoleGate roles={['admin', 'manager', 'staff']}>
                    <Expenses />
                  </RoleGate>
                }
              />
              <Route
                path="settings"
                element={
                  <CapabilityGate capability="manageSettings">
                    <Settings />
                  </CapabilityGate>
                }
              />
              <Route
                path="logs"
                element={
                  <CapabilityGate capability="viewReports">
                    <ActivityLog />
                  </CapabilityGate>
                }
              />
            </Route>

            <Route
              path="/super"
              element={
                <Protected>
                  <RoleGate roles={['super']}>
                    <AppShell />
                  </RoleGate>
                </Protected>
              }
            >
              <Route index element={<SuperOverview />} />
              <Route path="stores" element={<SuperStores />} />
            </Route>

            <Route path="*" element={<HomeRoute />} />
          </Routes>
          </StaffShiftAccessGate>
          </SessionAutomationGuard>
          </StationOnlyGate>
          </DeviceKioskGate>
        </BrowserRouter>
      </AppProvider>
    </ToastProvider>
  )
}

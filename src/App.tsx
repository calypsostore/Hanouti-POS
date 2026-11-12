import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './store/AppStore'
import { ToastProvider } from './components/toast'
import { AppShell } from './components/Layout'
import Login from './pages/Login'
import POS from './pages/POS'
import AdminOverview from './pages/admin/Overview'
import Orders from './pages/admin/Orders'
import Customers from './pages/admin/Customers'
import Register from './pages/admin/Register'
import Products from './pages/admin/Products'
import Staff from './pages/admin/Staff'
import Reports from './pages/admin/Reports'
import Expenses from './pages/admin/Expenses'
import Settings from './pages/admin/Settings'
import SetupWizard from './pages/admin/SetupWizard'
import SuperOverview from './pages/super/Overview'
import SuperStores from './pages/super/Stores'
import type { Role } from './types'

function homeFor(role: Role) {
  if (role === 'super') return '/super'
  if (role === 'staff') return '/pos'
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
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  return <>{children}</>
}

function LoginRoute() {
  const { user } = useApp()
  if (user) return <Navigate to={homeFor(user.role)} replace />
  return <Login />
}

function AdminShell() {
  const { store } = useApp()
  if (store && !store.setupComplete) return <SetupWizard />
  return <AppShell />
}

function StoreSetupGate({ children }: { children: React.ReactNode }) {
  const { user, store } = useApp()
  if (user?.role === 'admin' && store && !store.setupComplete) return <Navigate to="/admin" replace />
  return <>{children}</>
}

function HomeRoute() {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homeFor(user.role)} replace />
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/" element={<HomeRoute />} />

            <Route
              path="/pos"
              element={
                <Protected>
                  <RoleGate roles={['admin', 'staff']}>
                    <StoreSetupGate>
                      <POS />
                    </StoreSetupGate>
                  </RoleGate>
                </Protected>
              }
            />

            <Route
              path="/admin"
              element={
                <Protected>
                  <RoleGate roles={['admin', 'staff']}>
                    <AdminShell />
                  </RoleGate>
                </Protected>
              }
            >
              <Route
                index
                element={
                  <RoleGate roles={['admin']}>
                    <AdminOverview />
                  </RoleGate>
                }
              />
              <Route path="orders" element={<Orders />} />
              <Route path="customers" element={<Customers />} />
              <Route path="register" element={<Register />} />
              <Route
                path="products"
                element={
                  <RoleGate roles={['admin']}>
                    <Products />
                  </RoleGate>
                }
              />
              <Route
                path="staff"
                element={
                  <RoleGate roles={['admin']}>
                    <Staff />
                  </RoleGate>
                }
              />
              <Route
                path="reports"
                element={
                  <RoleGate roles={['admin']}>
                    <Reports />
                  </RoleGate>
                }
              />
              <Route
                path="expenses"
                element={
                  <RoleGate roles={['admin']}>
                    <Expenses />
                  </RoleGate>
                }
              />
              <Route
                path="settings"
                element={
                  <RoleGate roles={['admin']}>
                    <Settings />
                  </RoleGate>
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
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  )
}

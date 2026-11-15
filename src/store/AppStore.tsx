import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { applyAccent, applyColorMode, readColorMode } from '../lib/theme'
import type { Store, User } from '../types'
import { useAuthSlice } from './auth'
import { useCatalogSlice } from './catalog'
import { useCustomersSlice } from './customers'
import { useOrdersSlice } from './orders'
import { useRegisterSlice } from './register'
import { useSettingsSlice } from './settings'
import { useStaffSlice } from './staff'
import { usePayrollSlice } from './payroll'
import { useShiftsSlice } from './shifts'
import { useTablesSlice } from './tables'
import { useInventorySlice } from './inventory'
import { usePurchasesSlice } from './purchases'
import { useDataManagementSlice } from './dataManagement'
import { useOpenOrdersSlice } from './openOrders'
import { useStationDevicesSlice } from './stationDevices'
import { usePrintingSlice } from './printing'
import { useDatabase, useActorGuards } from './runtime'
import type { AppContextValue } from './types'

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const database = useDatabase()
  const auth = useAuthSlice({
    dbRef: database.dbRef,
    ready: database.ready,
    loadError: database.loadError,
    commitDb: database.commitDb,
  })
  const guards = useActorGuards({
    dbRef: database.dbRef,
    ready: database.ready,
    loadError: database.loadError,
    userIdRef: auth.userIdRef,
  })
  const dependencies = { ...database, ...guards }
  const orders = useOrdersSlice(dependencies)
  const openOrders = useOpenOrdersSlice(dependencies, orders.createOrder)
  const register = useRegisterSlice(dependencies)
  const catalog = useCatalogSlice(dependencies)
  const customers = useCustomersSlice(dependencies)
  const staff = useStaffSlice(dependencies)
  const payroll = usePayrollSlice(dependencies)
  const shifts = useShiftsSlice(dependencies)
  const tables = useTablesSlice(dependencies)
  const inventory = useInventorySlice(dependencies)
  const purchases = usePurchasesSlice(dependencies)
  const dataManagement = useDataManagementSlice(dependencies)
  const stationDevices = useStationDevicesSlice(dependencies)
  const printing = usePrintingSlice(dependencies)
  const { heartbeatAttendance, reconcileAttendance } = payroll
  const settings = useSettingsSlice({ ...dependencies, userIdRef: auth.userIdRef, setUserId: auth.setUserId })
  const { db } = database
  const { userId } = auth
  const user = useMemo<User | null>(
    () => (database.ready && !database.loadError
      ? db.users.find((candidate) => candidate.id === userId && candidate.active) ?? null
      : null),
    [db.users, database.loadError, database.ready, userId],
  )
  const store = useMemo<Store | null>(
    () => (user?.storeId ? db.stores.find((candidate) => candidate.id === user.storeId) ?? null : null),
    [db.stores, user],
  )
  useEffect(() => {
    if (!database.ready || database.loadError) return
    const updateAttendance = () => {
      if (user?.role === 'staff' && user.attendanceEnabled !== false) heartbeatAttendance(user.id)
      else reconcileAttendance()
    }
    updateAttendance()
    const interval = window.setInterval(updateAttendance, 60_000)
    return () => window.clearInterval(interval)
  }, [
    database.loadError,
    database.ready,
    heartbeatAttendance,
    reconcileAttendance,
    user?.id,
    user?.role,
    user?.attendanceEnabled,
  ])
  useEffect(() => {
    applyColorMode(readColorMode(store?.settings.colorMode ?? 'system'))
    applyAccent(store?.settings.accent ?? '7anouti')
  }, [store?.settings.accent, store?.settings.colorMode])

  const value: AppContextValue = {
    db,
    databaseReady: database.ready,
    databaseError: database.loadError,
    user,
    store,
    login: auth.login,
    loginPin: auth.loginPin,
    logout: auth.logout,
    ...orders,
    ...openOrders,
    ...register,
    ...catalog,
    ...customers,
    ...staff,
    ...payroll,
    ...shifts,
    ...tables,
    ...inventory,
    ...purchases,
    ...dataManagement,
    ...stationDevices,
    ...printing,
    ...settings,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}

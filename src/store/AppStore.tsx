import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { applyAccent } from '../lib/theme'
import type { Store, User } from '../types'
import { useAuthSlice } from './auth'
import { useCatalogSlice } from './catalog'
import { useCustomersSlice } from './customers'
import { useOrdersSlice } from './orders'
import { useRegisterSlice } from './register'
import { useSettingsSlice } from './settings'
import { useStaffSlice } from './staff'
import { useDatabase, useActorGuards } from './runtime'
import type { AppContextValue } from './types'

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const database = useDatabase()
  const auth = useAuthSlice({
    dbRef: database.dbRef,
    ready: database.ready,
    loadError: database.loadError,
  })
  const guards = useActorGuards({
    dbRef: database.dbRef,
    ready: database.ready,
    loadError: database.loadError,
    userIdRef: auth.userIdRef,
  })
  const dependencies = { ...database, ...guards }
  const orders = useOrdersSlice(dependencies)
  const register = useRegisterSlice(dependencies)
  const catalog = useCatalogSlice(dependencies)
  const customers = useCustomersSlice(dependencies)
  const staff = useStaffSlice(dependencies)
  const settings = useSettingsSlice({ ...dependencies, userIdRef: auth.userIdRef, setUserId: auth.setUserId })
  const { db } = database
  const { userId } = auth
  const user = useMemo<User | null>(
    () => (database.ready && !database.loadError ? db.users.find((candidate) => candidate.id === userId) ?? null : null),
    [db.users, database.loadError, database.ready, userId],
  )
  const store = useMemo<Store | null>(
    () => (user?.storeId ? db.stores.find((candidate) => candidate.id === user.storeId) ?? null : null),
    [db.stores, user],
  )
  useEffect(() => { applyAccent(store?.settings.accent ?? 'caramel') }, [store?.settings.accent])

  const value: AppContextValue = {
    db,
    user,
    store,
    login: auth.login,
    loginPin: auth.loginPin,
    logout: auth.logout,
    ...orders,
    ...register,
    ...catalog,
    ...customers,
    ...staff,
    ...settings,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}

import { useCallback } from 'react'
import type { Store, User } from '../types'
import { round } from '../lib/pricing-utils'
import { dateKey, uid } from '../lib/utils'
import { buildSeed } from '../data/seed'
import { hashSecret } from '../lib/hash'
import { DEFAULT_PRINTER, defaultPermissions } from '../lib/defaults'
import { businessTemplate } from '../lib/businessTemplates'
import type { AppContextValue } from './types'
import type { CreateStoreInput } from './types'
import type { SettingsSliceDependencies } from './sliceTypes'

export function useSettingsSlice(dependencies: SettingsSliceDependencies) {
  const { dbRef, commitDb, requireActor, requireAdmin, userIdRef, setUserId } = dependencies
  const addExpense = useCallback<AppContextValue['addExpense']>((storeId, data) => {
    const actorResult = requireAdmin(storeId)
    if (!actorResult.ok) return actorResult
    if (!Number.isFinite(data.amount) || data.amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.' }
    const datePart = data.date.slice(0, 10)
    const date = new Date(`${datePart}T12:00:00`)
    if (!Number.isFinite(date.getTime()) || dateKey(date) !== datePart) {
      return { ok: false, error: 'Choose a valid expense date.' }
    }
    const timestamp = datePart === dateKey(new Date())
      ? new Date().toISOString()
      : date.toISOString()
    commitDb((prev) => ({
      ...prev,
      expenses: [
        {
          id: uid('exp'),
          storeId,
          category: data.category,
          note: data.note,
          amount: round(data.amount),
          date: timestamp,
          createdAt: new Date().toISOString(),
          createdBy: actorResult.actor.id,
        },
        ...prev.expenses,
      ],
    }))
    return { ok: true }
  }, [commitDb, requireAdmin])

  const deleteExpense = useCallback<AppContextValue['deleteExpense']>((id) => {
    const expense = dbRef.current.expenses.find((candidate) => candidate.id === id)
    if (!expense) return { ok: false, error: 'Expense not found.' }
    const actorResult = requireAdmin(expense.storeId)
    if (!actorResult.ok) return actorResult
    commitDb((prev) => ({ ...prev, expenses: prev.expenses.filter((e) => e.id !== id) }))
    return { ok: true }
  }, [commitDb, requireAdmin])

  const updateSettings = useCallback<AppContextValue['updateSettings']>((storeId, patch) => {
    const actorResult = requireAdmin(storeId)
    if (!actorResult.ok) return actorResult
    if (!dbRef.current.stores.some((store) => store.id === storeId)) {
      return { ok: false, error: 'Store not found.' }
    }
    if (patch.features) {
      const featureValues = Object.values(patch.features)
      if (featureValues.length !== 4 || !featureValues.every((enabled) => typeof enabled === 'boolean')) {
        return { ok: false, error: 'Business feature settings must be enabled or disabled.' }
      }
    }
    commitDb((prev) => ({
      ...prev,
      stores: prev.stores.map((s) =>
        s.id === storeId ? { ...s, settings: { ...s.settings, ...patch } } : s,
      ),
    }))
    return { ok: true }
  }, [commitDb, requireAdmin])

  const completeBusinessSetup = useCallback<AppContextValue['completeBusinessSetup']>((storeId, businessType) => {
    const actorResult = requireAdmin(storeId)
    if (!actorResult.ok) return actorResult
    if (!['cafe', 'restaurant', 'bakery', 'snack', 'retail', 'salon'].includes(businessType)) {
      return { ok: false, error: 'Choose a supported business type.' }
    }
    const store = dbRef.current.stores.find((candidate) => candidate.id === storeId)
    if (!store) return { ok: false, error: 'Store not found.' }
    const template = businessTemplate(businessType)
    commitDb((prev) => {
      const hasProducts = prev.products.some((product) => product.storeId === storeId)
      const categories = hasProducts
        ? prev.categories
        : [
            ...prev.categories.filter((category) => category.storeId !== storeId),
            ...template.categories.map((category, sort) => ({
              ...category,
              id: uid('cat'),
              storeId,
              sort,
            })),
          ]
      return {
        ...prev,
        categories,
        stores: prev.stores.map((candidate) => candidate.id === storeId
          ? {
              ...candidate,
              businessType,
              setupComplete: true,
              settings: {
                ...candidate.settings,
                posMode: template.posMode,
                receiptFooter: template.receiptFooter,
                features: template.features,
              },
            }
          : candidate),
      }
    })
    return { ok: true }
  }, [commitDb, dbRef, requireAdmin])

  const createStore = useCallback<AppContextValue['createStore']>(async (data: CreateStoreInput) => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    if (actorResult.actor.role !== 'super') return { ok: false, error: 'Only the platform owner can create a store.' }
    const name = data.name.trim()
    const slug = data.slug.trim().toLowerCase()
    const adminEmail = data.adminEmail.trim().toLowerCase()
    if (!name || !slug || !data.adminName.trim() || !adminEmail || !data.adminPassword) {
      return { ok: false, error: 'Complete the store and administrator details.' }
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return { ok: false, error: 'Store code can use lowercase letters, numbers and hyphens.' }
    }
    if (!/^\d{4,6}$/.test(data.adminPin)) return { ok: false, error: 'PIN must contain 4–6 digits.' }
    const latest = dbRef.current
    if (latest.stores.some((store) => store.slug.toLowerCase() === slug)) {
      return { ok: false, error: 'That store code is already in use.' }
    }
    if (latest.users.some((user) => user.email.toLowerCase() === adminEmail)) {
      return { ok: false, error: 'That administrator email is already in use.' }
    }
    let password: string
    let pin: string
    try {
      ;[password, pin] = await Promise.all([hashSecret(data.adminPassword), hashSecret(data.adminPin)])
    } catch {
      return { ok: false, error: 'Could not securely create the administrator credentials.' }
    }
    const currentActor = requireActor()
    if (!currentActor.ok) return currentActor
    if (currentActor.actor.role !== 'super') return { ok: false, error: 'Only the platform owner can create a store.' }
    if (dbRef.current.stores.some((store) => store.slug.toLowerCase() === slug)) {
      return { ok: false, error: 'That store code is already in use.' }
    }
    if (dbRef.current.users.some((user) => user.email.toLowerCase() === adminEmail)) {
      return { ok: false, error: 'That administrator email is already in use.' }
    }
    const template = businessTemplate('cafe')
    const storeId = uid('st')
    const admin: User = {
      id: uid('usr'),
      storeId,
      name: data.adminName.trim(),
      email: adminEmail,
      password,
      pin,
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString(),
      permissions: defaultPermissions('admin'),
    }
    const store: Store = {
      id: storeId,
      name,
      slug,
      ownerName: data.ownerName.trim(),
      ownerEmail: data.ownerEmail.trim().toLowerCase(),
      phone: data.phone.trim(),
      address: data.address.trim(),
      city: data.city.trim(),
      emoji: '🏪',
      plan: 'starter',
      status: 'trial',
      businessType: 'cafe',
      setupComplete: false,
      createdAt: new Date().toISOString(),
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      settings: {
        posMode: template.posMode,
        currency: 'TND',
        taxRate: 0,
        taxInclusive: true,
        serviceCharge: 0,
        allowCredit: true,
        requireCustomerForCredit: true,
        receiptFooter: template.receiptFooter,
        lowStockThreshold: 10,
        accent: 'caramel',
        printer: { ...DEFAULT_PRINTER },
        features: template.features,
      },
    }
    commitDb((prev) => ({ ...prev, stores: [...prev.stores, store], users: [...prev.users, admin] }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const updateStore = useCallback<AppContextValue['updateStore']>((storeId, patch) => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    if (actor.role !== 'super' && (actor.role !== 'admin' || actor.storeId !== storeId)) {
      return { ok: false, error: 'Only a store admin can edit this store profile.' }
    }
    if (!dbRef.current.stores.some((s) => s.id === storeId)) return { ok: false, error: 'Store not found.' }
    const safePatch: Partial<Store> = { ...patch }
    delete safePatch.id
    delete safePatch.settings
    delete safePatch.status
    delete safePatch.plan
    delete safePatch.createdAt
    delete safePatch.trialEndsAt
    commitDb((prev) => ({
      ...prev,
      stores: prev.stores.map((s) => (s.id === storeId ? { ...s, ...safePatch } : s)),
    }))
    return { ok: true as const }
  }, [commitDb, requireActor])

  const setStoreStatus = useCallback<AppContextValue['setStoreStatus']>((storeId, status) => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    if (actorResult.actor.role !== 'super') return { ok: false, error: 'Only the platform owner can change store status.' }
    if (!dbRef.current.stores.some((s) => s.id === storeId)) return { ok: false, error: 'Store not found.' }
    commitDb((prev) => ({
      ...prev,
      stores: prev.stores.map((s) => (s.id === storeId ? { ...s, status } : s)),
    }))
    return { ok: true as const }
  }, [commitDb, requireActor])

  const changePlan = useCallback<AppContextValue['changePlan']>((storeId, plan) => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    if (actorResult.actor.role !== 'super') return { ok: false, error: 'Only the platform owner can change a store plan.' }
    if (!dbRef.current.stores.some((s) => s.id === storeId)) return { ok: false, error: 'Store not found.' }
    commitDb((prev) => ({
      ...prev,
      stores: prev.stores.map((s) => (s.id === storeId ? { ...s, plan } : s)),
    }))
    return { ok: true }
  }, [commitDb, requireActor])

  const resetDemo = useCallback(async () => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    const fresh = buildSeed()
    let users: User[]
    try {
      users = await Promise.all(fresh.users.map(async (candidate) => ({
        ...candidate,
        password: await hashSecret(candidate.password),
        pin: await hashSecret(candidate.pin),
      })))
    } catch {
      return { ok: false, error: 'Could not securely rebuild the demo credentials. Please try again.' }
    }
    const latestActor = requireActor()
    if (!latestActor.ok) return latestActor
    commitDb(() => ({ ...fresh, users }))
    userIdRef.current = null
    setUserId(null)
    return { ok: true as const }
  }, [commitDb, requireActor, userIdRef, setUserId])


  return {
    addExpense,
    deleteExpense,
    updateSettings,
    completeBusinessSetup,
    createStore,
    updateStore,
    setStoreStatus,
    changePlan,
    resetDemo,
  }
}

import { useCallback } from 'react'
import type { AuditJsonValue, Category, Database, Expense, Store, StoreSettings, User } from '../types'
import { round } from '../lib/pricing-utils'
import { dateKey, uid } from '../lib/utils'
import { buildSeed } from '../data/seed'
import { hashSecret } from '../lib/hash'
import { DEFAULT_AUTOMATION_SETTINGS, DEFAULT_AVAILABILITY_SETTINGS, DEFAULT_COFFEE_TRACKING, DEFAULT_ORDER_RULES, DEFAULT_PAYROLL_SETTINGS, DEFAULT_PRINTER, DEFAULT_STAFF_CONSUMPTION, defaultPermissions, normalizeCoffeeTracking, normalizeStaffConsumption } from '../lib/defaults'
import { businessTemplate } from '../lib/businessTemplates'
import { defaultStationsForStore } from '../lib/stations'
import { openShiftForStaff } from '../lib/registerShifts'
import { validAutomationSettings } from '../lib/automation'
import { addLog, changedAuditFields } from './audit'
import type { AppContextValue } from './types'
import type { CreateStoreInput } from './types'
import type { SettingsSliceDependencies } from './sliceTypes'

const expenseSnapshot = (expense: Expense): Record<string, AuditJsonValue> => ({
  category: expense.category,
  note: expense.note.slice(0, 120),
  amount: expense.amount,
  date: dateKey(expense.date),
})

const settingsSnapshot = (settings: StoreSettings): Record<string, AuditJsonValue> => ({
  posMode: settings.posMode,
  currency: settings.currency,
  taxRate: settings.taxRate,
  taxInclusive: settings.taxInclusive,
  serviceCharge: settings.serviceCharge,
  allowCredit: settings.allowCredit,
  requireCustomerForCredit: settings.requireCustomerForCredit,
  receiptFooter: settings.receiptFooter,
  lowStockThreshold: settings.lowStockThreshold,
  tableMode: settings.tableMode,
  guestRequirement: settings.guestRequirement,
  staffPickSectionsOnShift: settings.staffPickSectionsOnShift,
  requireShiftForOrders: settings.requireShiftForOrders,
  accent: settings.accent,
  colorMode: settings.colorMode,
  printer: { ...settings.printer },
  features: { ...settings.features },
  ticketSendPolicy: settings.ticketSendPolicy,
  ticketDelaySeconds: settings.ticketDelaySeconds,
  ticketIdleSeconds: settings.ticketIdleSeconds,
  stationTimerMinutes: settings.stationTimerMinutes,
  receiptPrintPolicy: settings.receiptPrintPolicy,
  stationTicketPrintPolicy: settings.stationTicketPrintPolicy,
  reportPrintPolicy: settings.reportPrintPolicy,
  automation: {
    drawerKickOnCash: settings.automation.drawerKickOnCash,
    autoLockMinutes: settings.automation.autoLockMinutes,
    autoLogoutMinutes: settings.automation.autoLogoutMinutes,
    shiftReminders: settings.automation.shiftReminders,
    shiftReminderHours: settings.automation.shiftReminderHours,
    maxShiftHours: settings.automation.maxShiftHours,
    cashDifferenceTolerance: settings.automation.cashDifferenceTolerance,
    warnAboutOpenTablesAtShiftClose: settings.automation.warnAboutOpenTablesAtShiftClose,
    lowStockAlerts: settings.automation.lowStockAlerts,
    hideOutOfStock: settings.automation.hideOutOfStock,
    retryPrintJobs: settings.automation.retryPrintJobs,
    fallbackPrintJobs: settings.automation.fallbackPrintJobs,
    printerRetryLimit: settings.automation.printerRetryLimit,
    autoReconnectPrinters: settings.automation.autoReconnectPrinters,
    printerOfflineAlerts: settings.automation.printerOfflineAlerts,
    printerOfflineAlertMinutes: settings.automation.printerOfflineAlertMinutes,
    backupHealthAlerts: settings.automation.backupHealthAlerts,
  },
  availability: {
    ...settings.availability,
    reasons: [...settings.availability.reasons],
  },
  coffeeTracking: { ...settings.coffeeTracking },
  staffConsumption: {
    ...settings.staffConsumption,
    allowances: settings.staffConsumption.allowances.map((allowance) => ({ ...allowance })),
  },
  orderRules: {
    ...settings.orderRules,
    stockOverrideRoles: { ...settings.orderRules.stockOverrideRoles },
  },
})

const storeProfileSnapshot = (store: Store): Record<string, AuditJsonValue> => ({
  name: store.name,
  ownerName: store.ownerName,
  ownerEmail: store.ownerEmail,
  phone: store.phone,
  address: store.address,
  city: store.city,
  icon: store.icon,
  iconColor: store.iconColor,
  logo: store.logo ? 'set' : 'not set',
})

export function useSettingsSlice(dependencies: SettingsSliceDependencies) {
  const { dbRef, commitDb, requireActor, requireAdmin, requireCapability, userIdRef, setUserId } = dependencies
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
    const expense: Expense = {
      id: uid('exp'),
      storeId,
      category: data.category,
      note: data.note,
      amount: round(data.amount),
      date: timestamp,
      createdAt: new Date().toISOString(),
      createdBy: actorResult.actor.id,
      shiftId: openShiftForStaff(dbRef.current, storeId, actorResult.actor.id)?.id,
    }
    commitDb((prev) => addLog({
      ...prev,
      expenses: [expense, ...prev.expenses],
    }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'expense',
      entityId: expense.id,
      summary: `Recorded ${expense.category} expense of ${expense.amount.toFixed(3)} DT`,
      after: expenseSnapshot(expense),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireAdmin])

  const updateExpense = useCallback<AppContextValue['updateExpense']>((id, data) => {
    const expense = dbRef.current.expenses.find((candidate) => candidate.id === id)
    if (!expense) return { ok: false, error: 'Expense not found.' }
    const actorResult = requireAdmin(expense.storeId)
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
    const updated: Expense = {
      ...expense,
      category: data.category,
      note: data.note,
      amount: round(data.amount),
      date: timestamp,
    }
    const changes = changedAuditFields(expenseSnapshot(expense), expenseSnapshot(updated))
    commitDb((prev) => addLog({
      ...prev,
      expenses: prev.expenses.map((entry) => (entry.id === id ? updated : entry)),
    }, actorResult.actor, {
      storeId: expense.storeId,
      action: 'edited',
      entity: 'expense',
      entityId: id,
      summary: `Edited ${expense.category} expense${changes.fields.length ? ` (${changes.fields.join(', ')})` : ''}`,
      before: changes.before,
      after: changes.after,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireAdmin])

  const deleteExpense = useCallback<AppContextValue['deleteExpense']>((id) => {
    const expense = dbRef.current.expenses.find((candidate) => candidate.id === id)
    if (!expense) return { ok: false, error: 'Expense not found.' }
    const actorResult = requireAdmin(expense.storeId)
    if (!actorResult.ok) return actorResult
    commitDb((prev) => addLog({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }, actorResult.actor, {
      storeId: expense.storeId,
      action: 'deleted',
      entity: 'expense',
      entityId: id,
      summary: `Deleted ${expense.category} expense of ${expense.amount.toFixed(3)} DT`,
      before: expenseSnapshot(expense),
    }))
    return { ok: true }
  }, [commitDb, requireAdmin])

  const updateSettings = useCallback<AppContextValue['updateSettings']>((storeId, patch) => {
    const actorResult = requireCapability(storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    if (patch.tableMode !== undefined &&
      !['sections_tables', 'tables_only', 'manual'].includes(patch.tableMode)) {
      return { ok: false, error: 'Choose a valid table system mode.' }
    }
    if (patch.guestRequirement !== undefined &&
      !['required', 'optional', 'off'].includes(patch.guestRequirement)) {
      return { ok: false, error: 'Choose a valid guest-count requirement.' }
    }
    if (patch.staffPickSectionsOnShift !== undefined &&
      typeof patch.staffPickSectionsOnShift !== 'boolean') {
      return { ok: false, error: 'Choose whether staff may claim sections.' }
    }
    if (patch.requireShiftForOrders !== undefined &&
      typeof patch.requireShiftForOrders !== 'boolean') {
      return { ok: false, error: 'Choose whether staff need an open shift to take orders.' }
    }
    if (patch.automation && !validAutomationSettings(patch.automation)) {
      return { ok: false, error: 'Check the automation settings and allowed values.' }
    }
    if (patch.availability) {
      const availability = patch.availability
      if (typeof availability.enabled !== 'boolean' ||
        typeof availability.autoEightySixAtZero !== 'boolean' ||
        typeof availability.autoReturnOnRestock !== 'boolean' ||
        typeof availability.requireReason !== 'boolean' ||
        typeof availability.resetManualAtDayStart !== 'boolean' ||
        typeof availability.resetManualAtFirstShift !== 'boolean' ||
        typeof availability.showListButton !== 'boolean' ||
        typeof availability.notifyStaffAboutChanges !== 'boolean' ||
        typeof availability.showCountOnStationScreens !== 'boolean' ||
        !['manual', 'on_restock', 'at_time'].includes(availability.defaultReturnMode) ||
        !['big_red_x', 'dimmed_badge'].includes(availability.displayStyle) ||
        !Array.isArray(availability.reasons) || availability.reasons.length > 20 ||
        availability.reasons.some((reason) => !reason.trim() || reason.length > 120)) {
        return { ok: false, error: 'Check the availability settings and allowed values.' }
      }
    }
    if (patch.orderRules) {
      const rules = patch.orderRules
      if (!['block', 'warn', 'allow'].includes(rules.stockOverflowMode) ||
        typeof rules.deductIngredientsOnSale !== 'boolean' ||
        !['keep', 'current', 'ask'].includes(rules.openOrderPricePolicy) ||
        !['plain', 'daily', 'prefix'].includes(rules.orderNumberFormat) ||
        typeof rules.orderNumberPrefix !== 'string' || rules.orderNumberPrefix.trim().length > 8 ||
        typeof rules.showLowStockHints !== 'boolean' ||
        typeof rules.revalidationBanner !== 'boolean' ||
        !rules.stockOverrideRoles ||
        typeof rules.stockOverrideRoles.admin !== 'boolean' ||
        typeof rules.stockOverrideRoles.manager !== 'boolean' ||
        typeof rules.stockOverrideRoles.staff !== 'boolean') {
        return { ok: false, error: 'Check the order rule settings and allowed values.' }
      }
    }
    if (patch.ticketSendPolicy !== undefined &&
      !['done_or_idle', 'instant', 'delayed', 'done_only'].includes(patch.ticketSendPolicy)) {
      return { ok: false, error: 'Choose a valid station ticket send policy.' }
    }
    for (const [label, value] of [
      ['ticket delay', patch.ticketDelaySeconds],
      ['idle delay', patch.ticketIdleSeconds],
      ['station timer', patch.stationTimerMinutes],
    ] as const) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > 180)) {
        return { ok: false, error: `Enter a valid ${label} between 1 and 180.` }
      }
    }
    if (patch.features) {
      const featureValues = Object.values(patch.features)
      if (featureValues.length !== 5 || !featureValues.every((enabled) => typeof enabled === 'boolean')) {
        return { ok: false, error: 'Business feature settings must be enabled or disabled.' }
      }
    }
    if (patch.payroll) {
      const { workingDaysPerMonth, fullDayHours, halfDayHours, autoCloseHours } = patch.payroll
      if (
        !Number.isFinite(workingDaysPerMonth) || workingDaysPerMonth < 1 || workingDaysPerMonth > 31 ||
        !Number.isFinite(fullDayHours) || fullDayHours < 0.25 || fullDayHours > 24 ||
        !Number.isFinite(halfDayHours) || halfDayHours < 0.25 || halfDayHours > fullDayHours ||
        !Number.isFinite(autoCloseHours) || autoCloseHours < 0.25 || autoCloseHours > 168
      ) return { ok: false, error: 'Enter valid payroll day and hour settings.' }
    }
    const store = dbRef.current.stores.find((candidate) => candidate.id === storeId)
    if (!store) return { ok: false, error: 'Store not found.' }
    const coffeeTracking = patch.coffeeTracking
      ? normalizeCoffeeTracking(patch.coffeeTracking)
      : store.settings.coffeeTracking
    if (patch.coffeeTracking && coffeeTracking.enabled) {
      const beanItem = dbRef.current.inventoryItems.find((item) =>
        item.id === coffeeTracking.inventoryItemId && item.storeId === storeId && item.active && item.baseUnit === 'g',
      )
      if (!beanItem) return { ok: false, error: 'Choose an active coffee-bean inventory item measured in grams.' }
      if (coffeeTracking.servingsPerKgMin < 1 ||
        coffeeTracking.servingsPerKgMax < coffeeTracking.servingsPerKgMin) {
        return { ok: false, error: 'Enter a valid coffee yield range per kilogram.' }
      }
    }
    const staffConsumption = patch.staffConsumption
      ? normalizeStaffConsumption(patch.staffConsumption)
      : store.settings.staffConsumption
    if (patch.staffConsumption && staffConsumption.enabled) {
      if (!staffConsumption.allowances.length || staffConsumption.allowances.some((allowance) =>
        !dbRef.current.products.some((product) =>
          product.id === allowance.productId && product.storeId === storeId &&
          !product.modifiers?.some((group) => group.required),
        ),
      )) return { ok: false, error: 'Choose staff items from this store without required modifiers.' }
    }
    const updated = {
      ...store,
      settings: {
        ...store.settings,
        ...patch,
        coffeeTracking,
        staffConsumption,
      },
    }
    const changes = changedAuditFields(settingsSnapshot(store.settings), settingsSnapshot(updated.settings))
    commitDb((prev) => addLog({
      ...prev,
      stores: prev.stores.map((s) =>
        s.id === storeId ? updated : s,
      ),
    }, actorResult.actor, {
      storeId,
      action: 'settings_updated',
      entity: 'settings',
      entityId: storeId,
      summary: `Updated store settings${changes.fields.length ? ` (${changes.fields.join(', ')})` : ''}`,
      before: changes.before,
      after: changes.after,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const completeBusinessSetup = useCallback<AppContextValue['completeBusinessSetup']>((storeId, businessType) => {
    const actorResult = requireCapability(storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    if (!['cafe', 'restaurant', 'bakery', 'snack', 'retail', 'salon'].includes(businessType)) {
      return { ok: false, error: 'Choose a supported business type.' }
    }
    const store = dbRef.current.stores.find((candidate) => candidate.id === storeId)
    if (!store) return { ok: false, error: 'Store not found.' }
    const template = businessTemplate(businessType)
    commitDb((prev) => {
      const hasProducts = prev.products.some((product) => product.storeId === storeId)
      const storeStations = prev.stations.some((station) => station.storeId === storeId)
        ? prev.stations.filter((station) => station.storeId === storeId)
        : defaultStationsForStore(storeId)
      const stationIdByName = new Map(storeStations.map((station) => [station.name, station.id]))
      const createdCategories = hasProducts
        ? []
        : template.categories.map((category, sort): Category => ({
            name: category.name,
            icon: category.icon,
            iconColor: category.iconColor,
            id: uid('cat'),
            storeId,
            stationId: category.station ? stationIdByName.get(category.station) : undefined,
            sort,
          }))
      const categories = hasProducts
        ? prev.categories
        : [
            ...prev.categories.filter((category) => category.storeId !== storeId),
            ...createdCategories,
          ]
      const currentStore = prev.stores.find((candidate) => candidate.id === storeId)
      const updatedStore = currentStore ? {
        ...currentStore,
        businessType,
        setupComplete: true,
        settings: {
          ...currentStore.settings,
          posMode: template.posMode,
          requireShiftForOrders: template.posMode === 'cashier',
          receiptFooter: template.receiptFooter,
          features: template.features,
        },
      } : undefined
      const next: Database = {
        ...prev,
        stations: prev.stations.some((station) => station.storeId === storeId)
          ? prev.stations
          : [...prev.stations, ...storeStations],
        categories,
        stores: updatedStore
          ? prev.stores.map((candidate) => candidate.id === storeId ? updatedStore : candidate)
          : prev.stores,
      }
      if (!currentStore || !updatedStore) return next
      const changes = changedAuditFields(
        { businessType: currentStore.businessType, ...settingsSnapshot(currentStore.settings) },
        { businessType: updatedStore.businessType, ...settingsSnapshot(updatedStore.settings) },
      )
      let logged = addLog(next, actorResult.actor, {
        storeId,
        action: 'settings_updated',
        entity: 'settings',
        entityId: storeId,
        summary: `Completed ${businessType} business setup`,
        before: changes.before,
        after: changes.after,
      })
      for (const category of createdCategories) {
        logged = addLog(logged, actorResult.actor, {
          storeId,
          action: 'created',
          entity: 'category',
          entityId: category.id,
          summary: `Created category ${category.name}`,
          after: {
            name: category.name,
            icon: category.icon,
            iconColor: category.iconColor,
            sort: category.sort,
          },
        })
      }
      return logged
    })
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

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
    if (latest.users.some((user) => user.email?.toLowerCase() === adminEmail)) {
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
    if (dbRef.current.users.some((user) => user.email?.toLowerCase() === adminEmail)) {
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
      salaryType: 'none',
      salaryAmount: 0,
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
      icon: 'Store',
      iconColor: 'amber',
      plan: 'starter',
      status: 'trial',
      businessType: 'cafe',
      setupComplete: false,
      createdAt: new Date().toISOString(),
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      settings: {
        posMode: template.posMode,
        requireShiftForOrders: template.posMode === 'cashier',
        currency: 'TND',
        taxRate: 0,
        taxInclusive: true,
        serviceCharge: 0,
        allowCredit: true,
        requireCustomerForCredit: true,
        receiptFooter: template.receiptFooter,
        lowStockThreshold: 10,
        tableMode: 'sections_tables',
        guestRequirement: 'required',
        staffPickSectionsOnShift: false,
        accent: '7anouti',
        colorMode: 'system',
        printer: { ...DEFAULT_PRINTER },
        features: template.features,
        payroll: { ...DEFAULT_PAYROLL_SETTINGS },
        ticketSendPolicy: 'done_or_idle',
        ticketDelaySeconds: 10,
        ticketIdleSeconds: 20,
        stationTimerMinutes: 15,
        receiptPrintPolicy: 'ask',
        stationTicketPrintPolicy: 'automatic',
        reportPrintPolicy: 'manual',
        automation: { ...DEFAULT_AUTOMATION_SETTINGS },
        availability: { ...DEFAULT_AVAILABILITY_SETTINGS, reasons: [...DEFAULT_AVAILABILITY_SETTINGS.reasons] },
        orderRules: { ...DEFAULT_ORDER_RULES, stockOverrideRoles: { ...DEFAULT_ORDER_RULES.stockOverrideRoles } },
        coffeeTracking: { ...DEFAULT_COFFEE_TRACKING },
        staffConsumption: { ...DEFAULT_STAFF_CONSUMPTION, allowances: [] },
      },
    }
    const stations = defaultStationsForStore(storeId)
    commitDb((prev) => addLog({
      ...prev,
      stores: [...prev.stores, store],
      users: [...prev.users, admin],
      stations: [...prev.stations, ...stations],
    }, currentActor.actor, {
      storeId,
      action: 'created',
      entity: 'settings',
      entityId: storeId,
      summary: `Created store ${store.name}`,
      after: { name: store.name, slug: store.slug, plan: store.plan, status: store.status },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const updateStore = useCallback<AppContextValue['updateStore']>((storeId, patch) => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    if (actor.role !== 'super' && (actor.role !== 'admin' || actor.storeId !== storeId)) {
      return { ok: false, error: 'Only a store admin can edit this store profile.' }
    }
    const store = dbRef.current.stores.find((candidate) => candidate.id === storeId)
    if (!store) return { ok: false, error: 'Store not found.' }
    if (patch.logo !== undefined && patch.logo.length > 307200) {
      return { ok: false, error: 'Store logos must be no larger than 300 KB.' }
    }
    const safePatch: Partial<Store> = { ...patch }
    delete safePatch.id
    delete safePatch.settings
    delete safePatch.status
    delete safePatch.plan
    delete safePatch.createdAt
    delete safePatch.trialEndsAt
    const updated = { ...store, ...safePatch }
    const changes = changedAuditFields(storeProfileSnapshot(store), storeProfileSnapshot(updated))
    const logoChanged = safePatch.logo !== undefined && safePatch.logo !== store.logo
    const before = logoChanged ? { ...changes.before, logo: store.logo ? 'set' : 'not set' } : changes.before
    const after = logoChanged ? { ...changes.after, logo: safePatch.logo ? 'updated' : 'removed' } : changes.after
    const changedFields = [...changes.fields, ...(logoChanged ? ['logo'] : [])]
    commitDb((prev) => addLog({
      ...prev,
      stores: prev.stores.map((s) => (s.id === storeId ? updated : s)),
    }, actor, {
      storeId,
      action: 'settings_updated',
      entity: 'settings',
      entityId: storeId,
      summary: `Updated store profile${changedFields.length ? ` (${changedFields.join(', ')})` : ''}`,
      before,
      after,
    }))
    return { ok: true as const }
  }, [commitDb, dbRef, requireActor])

  const setStoreStatus = useCallback<AppContextValue['setStoreStatus']>((storeId, status) => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    if (actorResult.actor.role !== 'super') return { ok: false, error: 'Only the platform owner can change store status.' }
    const store = dbRef.current.stores.find((candidate) => candidate.id === storeId)
    if (!store) return { ok: false, error: 'Store not found.' }
    commitDb((prev) => addLog({
      ...prev,
      stores: prev.stores.map((s) => (s.id === storeId ? { ...s, status } : s)),
    }, actorResult.actor, {
      storeId,
      action: 'settings_updated',
      entity: 'settings',
      entityId: storeId,
      summary: `Changed store status to ${status}`,
      before: { status: store.status },
      after: { status },
    }))
    return { ok: true as const }
  }, [commitDb, dbRef, requireActor])

  const changePlan = useCallback<AppContextValue['changePlan']>((storeId, plan) => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    if (actorResult.actor.role !== 'super') return { ok: false, error: 'Only the platform owner can change a store plan.' }
    const store = dbRef.current.stores.find((candidate) => candidate.id === storeId)
    if (!store) return { ok: false, error: 'Store not found.' }
    commitDb((prev) => addLog({
      ...prev,
      stores: prev.stores.map((s) => (s.id === storeId ? { ...s, plan } : s)),
    }, actorResult.actor, {
      storeId,
      action: 'settings_updated',
      entity: 'settings',
      entityId: storeId,
      summary: `Changed store plan to ${plan}`,
      before: { plan: store.plan },
      after: { plan },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  const resetDemo = useCallback<AppContextValue['resetDemo']>(async (confirmation) => {
    if (confirmation !== 'RESET') return { ok: false, error: 'Type RESET to confirm demo data reset.' }
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    if (actorResult.actor.role !== 'admin' || !actorResult.actor.storeId) {
      return { ok: false, error: 'Only a store owner can reset demo data.' }
    }
    const storeId = actorResult.actor.storeId
    const fresh = buildSeed()
    let users: User[]
    try {
      users = await Promise.all(fresh.users.map(async (candidate) => ({
        ...candidate,
        password: await hashSecret(candidate.password),
        pin: await hashSecret(candidate.pin),
      })))
    } catch (error) {
      console.error('7anouti: could not securely rebuild demo credentials.', error)
      return { ok: false, error: 'Could not securely rebuild the demo credentials. Please try again.' }
    }
    const latestActor = requireAdmin(storeId)
    if (!latestActor.ok) return latestActor
    commitDb((prev) => {
      const initial = { ...fresh, users, auditLogs: prev.auditLogs }
      const reset = addLog(initial, latestActor.actor, {
        storeId,
        action: 'demo_reset',
        entity: 'settings',
        summary: 'Reset demo data',
      })
      return addLog(reset, latestActor.actor, {
        storeId,
        action: 'logout',
        entity: 'auth',
        summary: 'Logged out after demo reset',
      })
    })
    userIdRef.current = null
    setUserId(null)
    return { ok: true as const }
  }, [commitDb, requireActor, requireAdmin, userIdRef, setUserId])


  return {
    addExpense,
    updateExpense,
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

import { useCallback } from 'react'
import type { AuditJsonValue, Category, Product, Station } from '../types'
import { uid } from '../lib/utils'
import { addLog, changedAuditFields } from './audit'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'
import { can } from '../lib/permissions'

const validateOptions = (
  products: Product[],
  storeId: string,
  options: Pick<Product, 'barcode' | 'modifiers' | 'variants'>,
  excludeProductId?: string,
): string | null => {
  const barcodes = [options.barcode, ...(options.variants ?? []).map((variant) => variant.barcode ?? '')]
    .map((barcode) => (barcode ?? '').trim().toLowerCase())
    .filter(Boolean)
  if (new Set(barcodes).size !== barcodes.length) return 'Product and variant barcodes must be unique.'
  const otherBarcodes = products
    .filter((product) => product.storeId === storeId && product.id !== excludeProductId)
    .flatMap((product) => [
      product.barcode ?? '',
      ...(product.variants ?? []).map((variant) => variant.barcode ?? ''),
    ])
    .map((barcode) => barcode.trim().toLowerCase())
    .filter(Boolean)
  if (barcodes.some((barcode) => otherBarcodes.includes(barcode))) {
    return 'That barcode is already assigned to another product or variant in this store.'
  }
  const modifierIds = (options.modifiers ?? []).map((group) => group.id)
  if (modifierIds.some((id) => !id) || new Set(modifierIds).size !== modifierIds.length) {
    return 'Modifier groups need unique IDs.'
  }
  for (const group of options.modifiers ?? []) {
    const optionIds = group.options.map((option) => option.id)
    if (!group.name.trim() || !group.options.length || optionIds.some((id) => !id) ||
      new Set(optionIds).size !== optionIds.length ||
      group.options.some((option) => !option.name.trim() || !Number.isFinite(option.priceDelta))) {
      return 'Each modifier group needs a name and valid options.'
    }
  }
  const variantIds = (options.variants ?? []).map((variant) => variant.id)
  if (variantIds.some((id) => !id) || new Set(variantIds).size !== variantIds.length ||
    (options.variants ?? []).some((variant) =>
      !variant.name.trim() || !Number.isFinite(variant.price) || variant.price < 0 ||
      !Number.isFinite(variant.cost) || variant.cost < 0 ||
      !Number.isFinite(variant.stock) || variant.stock < 0,
    )) {
    return 'Each variant needs a name and valid price, cost and stock.'
  }
  return null
}

const categorySnapshot = (category: Category): Record<string, AuditJsonValue> => ({
  name: category.name,
  icon: category.icon,
  iconColor: category.iconColor,
  stationId: category.stationId ?? '',
  sort: category.sort,
})

const productSnapshot = (product: Product): Record<string, AuditJsonValue> => ({
  name: product.name,
  categoryId: product.categoryId,
  stationId: product.stationId ?? '',
  price: product.price,
  cost: product.cost,
  stock: product.stock,
  trackStock: product.trackStock,
  active: product.active,
  variants: (product.variants ?? []).map((variant) => ({
    name: variant.name,
    price: variant.price,
    stock: variant.stock,
    trackStock: variant.trackStock,
  })),
  eightySix: product.eightySix ? {
    active: product.eightySix.active,
    at: product.eightySix.at,
    byId: product.eightySix.byId,
    reason: product.eightySix.reason ?? '',
    returnMode: product.eightySix.returnMode,
    backAt: product.eightySix.backAt ?? '',
  } : null,
})

const stationSnapshot = (station: Station): Record<string, AuditJsonValue> => ({
  name: station.name,
  icon: station.icon,
  color: station.color,
  screen: station.screen,
  sort: station.sort,
})

export function useCatalogSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireCapability } = dependencies
  const addCategory = useCallback<AppContextValue['addCategory']>((storeId, data) => {
    const actorResult = requireCapability(storeId, 'manageProducts')
    if (!actorResult.ok) return actorResult
    if (!data.name.trim()) return { ok: false, error: 'Enter a category name.' }
    if (data.stationId && !dbRef.current.stations.some((station) => station.id === data.stationId && station.storeId === storeId)) {
      return { ok: false, error: 'Choose a station from this store.' }
    }
    const category: Category = {
      id: uid('cat'),
      storeId,
      name: data.name.trim(),
      icon: data.icon,
      iconColor: data.iconColor,
      stationId: data.stationId || undefined,
      sort: dbRef.current.categories.filter((c) => c.storeId === storeId).length,
    }
    commitDb((prev) => addLog({
      ...prev,
      categories: [...prev.categories, category],
    }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'category',
      entityId: category.id,
      summary: `Created category ${category.name}`,
      after: categorySnapshot(category),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const updateCategory = useCallback<AppContextValue['updateCategory']>((id, patch) => {
    const category = dbRef.current.categories.find((candidate) => candidate.id === id)
    if (!category) return { ok: false, error: 'Category not found.' }
    const actorResult = requireCapability(category.storeId, 'manageProducts')
    if (!actorResult.ok) return actorResult
    if (patch.storeId !== undefined && patch.storeId !== category.storeId) {
      return { ok: false, error: 'A category cannot be moved to another store.' }
    }
    if (patch.stationId !== undefined && patch.stationId && !dbRef.current.stations.some((station) => station.id === patch.stationId && station.storeId === category.storeId)) {
      return { ok: false, error: 'Choose a station from this store.' }
    }
    const safePatch: Partial<Category> = { ...patch }
    delete safePatch.id
    delete safePatch.storeId
    const updated = { ...category, ...safePatch }
    const changes = changedAuditFields(categorySnapshot(category), categorySnapshot(updated))
    commitDb((prev) => addLog({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? updated : c)),
    }, actorResult.actor, {
      storeId: category.storeId,
      action: 'edited',
      entity: 'category',
      entityId: id,
      summary: `Edited category ${category.name}${changes.fields.length ? ` (${changes.fields.join(', ')})` : ''}`,
      before: changes.before,
      after: changes.after,
    }))
    return { ok: true }
  }, [commitDb, requireCapability])

  const deleteCategory = useCallback<AppContextValue['deleteCategory']>(
    (id) => {
      const category = dbRef.current.categories.find((candidate) => candidate.id === id)
      if (!category) return { ok: false, error: 'Category not found.' }
      const actorResult = requireCapability(category.storeId, 'manageProducts')
      if (!actorResult.ok) return actorResult
      const products = dbRef.current.products.filter((p) => p.storeId === category.storeId && p.categoryId === id)
      if (products.length) {
        return { ok: false, error: `Move or delete the ${products.length} item(s) in this category first.` }
      }
      commitDb((prev) => addLog({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
      }, actorResult.actor, {
        storeId: category.storeId,
        action: 'deleted',
        entity: 'category',
        entityId: id,
        summary: `Deleted category ${category.name}`,
        before: categorySnapshot(category),
      }))
      return { ok: true }
    },
    [commitDb, requireCapability],
  )

  const addProduct = useCallback<AppContextValue['addProduct']>((storeId, data) => {
    const actorResult = requireCapability(storeId, 'manageProducts')
    if (!actorResult.ok) return actorResult
    const category = dbRef.current.categories.find((candidate) =>
      candidate.id === data.categoryId && candidate.storeId === storeId,
    )
    if (!category) return { ok: false, error: 'Choose a category from this store.' }
    if (data.stationId && !dbRef.current.stations.some((station) => station.id === data.stationId && station.storeId === storeId)) {
      return { ok: false, error: 'Choose a station from this store.' }
    }
    if (data.inventoryItemId && !dbRef.current.inventoryItems.some((item) =>
      item.id === data.inventoryItemId && item.storeId === storeId,
    )) return { ok: false, error: 'Choose an inventory item from this store.' }
    if (!Number.isFinite(data.price) || data.price < 0 || !Number.isFinite(data.stock) || data.stock < 0) {
      return { ok: false, error: 'Enter a valid product price and stock quantity.' }
    }
    const optionsError = validateOptions(dbRef.current.products, storeId, data)
    if (optionsError) return { ok: false, error: optionsError }
    const product: Product = { ...data, id: uid('prd'), storeId }
    commitDb((prev) => addLog({
      ...prev,
      products: [...prev.products, product],
    }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'product',
      entityId: product.id,
      summary: `Created product ${product.name}`,
      after: productSnapshot(product),
    }))
    return { ok: true }
  }, [commitDb, requireCapability])

  const updateProduct = useCallback<AppContextValue['updateProduct']>((id, patch) => {
    const product = dbRef.current.products.find((candidate) => candidate.id === id)
    if (!product) return { ok: false, error: 'Product not found.' }
    const stripVariantAvailability = (variants: Product['variants']) =>
      (variants ?? []).map((variant) => {
        const copy = { ...variant }
        delete copy.eightySix
        return copy
      })
    const topLevelAvailabilityChanged = Object.prototype.hasOwnProperty.call(patch, 'eightySix') &&
      JSON.stringify(patch.eightySix) !== JSON.stringify(product.eightySix)
    const nestedAvailabilityChanged = patch.variants !== undefined &&
      JSON.stringify(patch.variants) !== JSON.stringify(product.variants) &&
      JSON.stringify(stripVariantAvailability(patch.variants)) === JSON.stringify(stripVariantAvailability(product.variants))
    const changesEightySix = topLevelAvailabilityChanged || nestedAvailabilityChanged
    const actorResult = requireCapability(product.storeId, changesEightySix ? 'manage86' : 'manageProducts')
    if (!actorResult.ok) return actorResult
    if (changesEightySix && !can(actorResult.actor, 'manageProducts')) {
      const beforeVariants = stripVariantAvailability(product.variants)
      const afterVariants = stripVariantAvailability(patch.variants ?? product.variants)
      if (Object.keys(patch).some((key) => key !== 'eightySix' && key !== 'variants') ||
        JSON.stringify(beforeVariants) !== JSON.stringify(afterVariants)) {
        return { ok: false, error: '86 permission only allows changing availability.' }
      }
    }
    if (patch.storeId !== undefined && patch.storeId !== product.storeId) {
      return { ok: false, error: 'A product cannot be moved to another store.' }
    }
    if (patch.categoryId !== undefined && !dbRef.current.categories.some((category) =>
      category.id === patch.categoryId && category.storeId === product.storeId,
    )) {
      return { ok: false, error: 'Choose a category from this store.' }
    }
    if (patch.stationId !== undefined && patch.stationId && !dbRef.current.stations.some((station) => station.id === patch.stationId && station.storeId === product.storeId)) {
      return { ok: false, error: 'Choose a station from this store.' }
    }
    if (patch.inventoryItemId && !dbRef.current.inventoryItems.some((item) =>
      item.id === patch.inventoryItemId && item.storeId === product.storeId,
    )) return { ok: false, error: 'Choose an inventory item from this store.' }
    if (patch.price !== undefined && (!Number.isFinite(patch.price) || patch.price < 0)) {
      return { ok: false, error: 'Enter a valid product price.' }
    }
    if (patch.stock !== undefined && (!Number.isFinite(patch.stock) || patch.stock < 0)) {
      return { ok: false, error: 'Enter a valid stock quantity.' }
    }
    if (changesEightySix && patch.eightySix?.active) {
      const settings = dbRef.current.stores.find((store) => store.id === product.storeId)?.settings.availability
      if (!settings?.enabled) return { ok: false, error: '86 availability is disabled for this store.' }
      const reason = patch.eightySix.reason?.trim() ?? ''
      if ((settings.requireReason && !reason) || (reason && !settings.reasons.includes(reason))) {
        return { ok: false, error: 'Choose a configured reason for 86 availability.' }
      }
      if (patch.eightySix.returnMode === 'at_time' &&
        (!patch.eightySix.backAt || !Number.isFinite(Date.parse(patch.eightySix.backAt)))) {
        return { ok: false, error: 'Choose a valid return time.' }
      }
    }
    const optionsError = validateOptions(
      dbRef.current.products,
      product.storeId,
      { barcode: patch.barcode ?? product.barcode, modifiers: patch.modifiers ?? product.modifiers, variants: patch.variants ?? product.variants },
      product.id,
    )
    if (optionsError) return { ok: false, error: optionsError }
    const safePatch: Partial<Product> = { ...patch }
    delete safePatch.id
    delete safePatch.storeId
    if (changesEightySix && patch.eightySix?.active) {
      safePatch.eightySix = {
        ...patch.eightySix,
        at: new Date().toISOString(),
        byId: actorResult.actor.id,
        reason: patch.eightySix.reason?.trim() || 'Unavailable',
      }
    }
    const updated = { ...product, ...safePatch }
    const changes = changedAuditFields(productSnapshot(product), productSnapshot(updated))
    commitDb((prev) => addLog({
      ...prev,
      products: prev.products.map((p) => (p.id === id ? updated : p)),
    }, actorResult.actor, {
      storeId: product.storeId,
      action: changesEightySix ? (updated.eightySix?.active ? 'activated' : 'deactivated') : 'edited',
      entity: 'product',
      entityId: id,
      summary: changesEightySix
        ? `${updated.eightySix?.active ? '86d' : 'Returned'} ${product.name}${updated.eightySix?.reason ? `: ${updated.eightySix.reason}` : ''}`
        : `Edited product ${product.name}${changes.fields.length ? ` (${changes.fields.join(', ')})` : ''}`,
      before: changes.before,
      after: changes.after,
    }))
    return { ok: true }
  }, [commitDb, requireCapability])

  const deleteProduct = useCallback<AppContextValue['deleteProduct']>((id) => {
    const product = dbRef.current.products.find((candidate) => candidate.id === id)
    if (!product) return { ok: false, error: 'Product not found.' }
    const actorResult = requireCapability(product.storeId, 'manageProducts')
    if (!actorResult.ok) return actorResult
    commitDb((prev) => addLog({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }, actorResult.actor, {
      storeId: product.storeId,
      action: 'deleted',
      entity: 'product',
      entityId: id,
      summary: `Deleted product ${product.name}`,
      before: productSnapshot(product),
    }))
    return { ok: true }
  }, [commitDb, requireCapability])

  const addStation = useCallback<AppContextValue['addStation']>((storeId, data) => {
    const actorResult = requireCapability(storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    const name = data.name.trim()
    if (!name || name.length > 80) return { ok: false, error: 'Enter a station name up to 80 characters.' }
    if (dbRef.current.stations.some((station) => station.storeId === storeId && station.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: 'A station with that name already exists.' }
    }
    const station: Station = {
      id: uid('sta'),
      storeId,
      name,
      icon: data.icon,
      color: data.color,
      screen: data.screen,
      active: true,
      sort: dbRef.current.stations.filter((item) => item.storeId === storeId).length,
    }
    commitDb((prev) => addLog({
      ...prev,
      stations: [...prev.stations, station],
    }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'station',
      entityId: station.id,
      summary: `Created station ${station.name}`,
      after: stationSnapshot(station),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const updateStation = useCallback<AppContextValue['updateStation']>((id, patch) => {
    const station = dbRef.current.stations.find((item) => item.id === id)
    if (!station) return { ok: false, error: 'Station not found.' }
    const actorResult = requireCapability(station.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    if (patch.storeId !== undefined && patch.storeId !== station.storeId) {
      return { ok: false, error: 'A station cannot be moved to another store.' }
    }
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name || name.length > 80) return { ok: false, error: 'Enter a station name up to 80 characters.' }
      if (dbRef.current.stations.some((item) =>
        item.storeId === station.storeId && item.id !== id && item.name.toLowerCase() === name.toLowerCase(),
      )) return { ok: false, error: 'A station with that name already exists.' }
    }
    const safePatch: Partial<Station> = { ...patch }
    delete safePatch.id
    delete safePatch.storeId
    delete safePatch.sort
    const updated = { ...station, ...safePatch, name: safePatch.name?.trim() ?? station.name }
    const changes = changedAuditFields(stationSnapshot(station), stationSnapshot(updated))
    commitDb((prev) => addLog({
      ...prev,
      stations: prev.stations.map((item) => item.id === id ? updated : item),
    }, actorResult.actor, {
      storeId: station.storeId,
      action: 'edited',
      entity: 'station',
      entityId: id,
      summary: `Edited station ${station.name}${changes.fields.length ? ` (${changes.fields.join(', ')})` : ''}`,
      before: changes.before,
      after: changes.after,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const deleteStation = useCallback<AppContextValue['deleteStation']>((id) => {
    const station = dbRef.current.stations.find((item) => item.id === id)
    if (!station) return { ok: false, error: 'Station not found.' }
    const actorResult = requireCapability(station.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    if (dbRef.current.categories.some((category) => category.storeId === station.storeId && category.stationId === id) ||
      dbRef.current.products.some((product) => product.storeId === station.storeId && product.stationId === id)) {
      return { ok: false, error: 'Move categories and products to another station before deleting this station.' }
    }
    commitDb((prev) => addLog({
      ...prev,
      stations: prev.stations.filter((item) => item.id !== id),
    }, actorResult.actor, {
      storeId: station.storeId,
      action: 'deleted',
      entity: 'station',
      entityId: id,
      summary: `Deleted station ${station.name}`,
      before: stationSnapshot(station),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const reorderStations = useCallback<AppContextValue['reorderStations']>((storeId, ids) => {
    const actorResult = requireCapability(storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    const current = dbRef.current.stations.filter((station) => station.storeId === storeId)
    if (ids.length !== current.length || new Set(ids).size !== ids.length ||
      ids.some((id) => !current.some((station) => station.id === id))) {
      return { ok: false, error: 'The station order is invalid.' }
    }
    const sortById = new Map(ids.map((id, sort) => [id, sort]))
    commitDb((prev) => ({
      ...prev,
      stations: prev.stations.map((station) => station.storeId === storeId
        ? { ...station, sort: sortById.get(station.id) ?? station.sort }
        : station),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const bulkAssignProductStation = useCallback<AppContextValue['bulkAssignProductStation']>((storeId, productIds, stationId) => {
    const actorResult = requireCapability(storeId, 'manageProducts')
    if (!actorResult.ok) return actorResult
    if (!productIds.length || new Set(productIds).size !== productIds.length ||
      productIds.some((id) => !dbRef.current.products.some((product) => product.id === id && product.storeId === storeId))) {
      return { ok: false, error: 'Choose products from this store.' }
    }
    if (stationId && !dbRef.current.stations.some((station) => station.id === stationId && station.storeId === storeId)) {
      return { ok: false, error: 'Choose a station from this store.' }
    }
    const selected = new Set(productIds)
    commitDb((prev) => ({
      ...prev,
      products: prev.products.map((product) => selected.has(product.id)
        ? { ...product, stationId: stationId || null }
        : product),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const bulkAssignCategoryStation = useCallback<AppContextValue['bulkAssignCategoryStation']>((storeId, categoryIds, stationId) => {
    const actorResult = requireCapability(storeId, 'manageProducts')
    if (!actorResult.ok) return actorResult
    if (!categoryIds.length || new Set(categoryIds).size !== categoryIds.length ||
      categoryIds.some((id) => !dbRef.current.categories.some((category) => category.id === id && category.storeId === storeId))) {
      return { ok: false, error: 'Choose categories from this store.' }
    }
    if (stationId && !dbRef.current.stations.some((station) => station.id === stationId && station.storeId === storeId)) {
      return { ok: false, error: 'Choose a station from this store.' }
    }
    const selected = new Set(categoryIds)
    commitDb((prev) => ({
      ...prev,
      categories: prev.categories.map((category) => selected.has(category.id)
        ? { ...category, stationId: stationId || undefined }
        : category),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  return {
    addCategory, updateCategory, deleteCategory, addProduct, updateProduct, deleteProduct,
    addStation, updateStation, deleteStation, reorderStations,
    bulkAssignProductStation, bulkAssignCategoryStation,
  }
}

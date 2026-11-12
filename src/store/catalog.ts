import { useCallback } from 'react'
import type { AuditJsonValue, Category, Product } from '../types'
import { uid } from '../lib/utils'
import { addLog, changedAuditFields } from './audit'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

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
  sort: category.sort,
})

const productSnapshot = (product: Product): Record<string, AuditJsonValue> => ({
  name: product.name,
  categoryId: product.categoryId,
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
})

export function useCatalogSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireAdmin } = dependencies
  const addCategory = useCallback<AppContextValue['addCategory']>((storeId, data) => {
    const actorResult = requireAdmin(storeId)
    if (!actorResult.ok) return actorResult
    if (!data.name.trim()) return { ok: false, error: 'Enter a category name.' }
    const category: Category = {
      id: uid('cat'),
      storeId,
      name: data.name.trim(),
      icon: data.icon,
      iconColor: data.iconColor,
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
  }, [commitDb, dbRef, requireAdmin])

  const updateCategory = useCallback<AppContextValue['updateCategory']>((id, patch) => {
    const category = dbRef.current.categories.find((candidate) => candidate.id === id)
    if (!category) return { ok: false, error: 'Category not found.' }
    const actorResult = requireAdmin(category.storeId)
    if (!actorResult.ok) return actorResult
    if (patch.storeId !== undefined && patch.storeId !== category.storeId) {
      return { ok: false, error: 'A category cannot be moved to another store.' }
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
  }, [commitDb, requireAdmin])

  const deleteCategory = useCallback<AppContextValue['deleteCategory']>(
    (id) => {
      const category = dbRef.current.categories.find((candidate) => candidate.id === id)
      if (!category) return { ok: false, error: 'Category not found.' }
      const actorResult = requireAdmin(category.storeId)
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
    [commitDb, requireAdmin],
  )

  const addProduct = useCallback<AppContextValue['addProduct']>((storeId, data) => {
    const actorResult = requireAdmin(storeId)
    if (!actorResult.ok) return actorResult
    const category = dbRef.current.categories.find((candidate) =>
      candidate.id === data.categoryId && candidate.storeId === storeId,
    )
    if (!category) return { ok: false, error: 'Choose a category from this store.' }
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
  }, [commitDb, requireAdmin])

  const updateProduct = useCallback<AppContextValue['updateProduct']>((id, patch) => {
    const product = dbRef.current.products.find((candidate) => candidate.id === id)
    if (!product) return { ok: false, error: 'Product not found.' }
    const actorResult = requireAdmin(product.storeId)
    if (!actorResult.ok) return actorResult
    if (patch.storeId !== undefined && patch.storeId !== product.storeId) {
      return { ok: false, error: 'A product cannot be moved to another store.' }
    }
    if (patch.categoryId !== undefined && !dbRef.current.categories.some((category) =>
      category.id === patch.categoryId && category.storeId === product.storeId,
    )) {
      return { ok: false, error: 'Choose a category from this store.' }
    }
    if (patch.price !== undefined && (!Number.isFinite(patch.price) || patch.price < 0)) {
      return { ok: false, error: 'Enter a valid product price.' }
    }
    if (patch.stock !== undefined && (!Number.isFinite(patch.stock) || patch.stock < 0)) {
      return { ok: false, error: 'Enter a valid stock quantity.' }
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
    const updated = { ...product, ...safePatch }
    const changes = changedAuditFields(productSnapshot(product), productSnapshot(updated))
    commitDb((prev) => addLog({
      ...prev,
      products: prev.products.map((p) => (p.id === id ? updated : p)),
    }, actorResult.actor, {
      storeId: product.storeId,
      action: 'edited',
      entity: 'product',
      entityId: id,
      summary: `Edited product ${product.name}${changes.fields.length ? ` (${changes.fields.join(', ')})` : ''}`,
      before: changes.before,
      after: changes.after,
    }))
    return { ok: true }
  }, [commitDb, requireAdmin])

  const deleteProduct = useCallback<AppContextValue['deleteProduct']>((id) => {
    const product = dbRef.current.products.find((candidate) => candidate.id === id)
    if (!product) return { ok: false, error: 'Product not found.' }
    const actorResult = requireAdmin(product.storeId)
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
  }, [commitDb, requireAdmin])


  return { addCategory, updateCategory, deleteCategory, addProduct, updateProduct, deleteProduct }
}

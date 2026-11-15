import { useCallback } from 'react'
import type { AuditJsonValue, InventoryItem, StockMovement } from '../types'
import { roundCost, roundQuantity } from '../lib/inventory'
import { uid } from '../lib/utils'
import { addLog, changedAuditFields } from './audit'
import { maintainAvailabilityAfterStockChange } from './availabilityMaintenance'
import type { AppContextValue, InventoryItemInput, Result } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

const itemSnapshot = (item: InventoryItem): Record<string, AuditJsonValue> => ({
  name: item.name,
  category: item.category,
  baseUnit: item.baseUnit,
  packages: item.packages.map(({ label, baseQtyPerPackage }) => ({ label, baseQtyPerPackage })),
  onHand: item.onHand,
  reorderLevel: item.reorderLevel,
  active: item.active,
})

const validPackages = (packages: InventoryItemInput['packages']): boolean =>
  Array.isArray(packages) && packages.length <= 30 && packages.every((pkg) =>
    typeof pkg.label === 'string' && pkg.label.trim().length > 0 &&
    pkg.label.trim().length <= 100 &&
    Number.isFinite(pkg.baseQtyPerPackage) && roundQuantity(pkg.baseQtyPerPackage) > 0,
  )

const isInventoryUnit = (unit: unknown): unit is InventoryItem['baseUnit'] =>
  unit === 'g' || unit === 'ml' || unit === 'piece'

export function useInventorySlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireCapability } = dependencies

  const addInventoryItem = useCallback<AppContextValue['addInventoryItem']>((storeId, data) => {
    const actorResult = requireCapability(storeId, 'manageInventory')
    if (!actorResult.ok) return actorResult
    const name = data.name.trim()
    const category = data.category.trim()
    if (!name || name.length > 100 || !category || category.length > 60) {
      return { ok: false, error: 'Enter an item name and category.' }
    }
    if (!isInventoryUnit(data.baseUnit) || !validPackages(data.packages) ||
      !Number.isFinite(data.reorderLevel) || data.reorderLevel < 0) {
      return { ok: false, error: 'Enter valid package sizes and a non-negative reorder level.' }
    }
    if (dbRef.current.inventoryItems.some((item) =>
      item.storeId === storeId && item.name.toLowerCase() === name.toLowerCase(),
    )) {
      return { ok: false, error: 'An inventory item with that name already exists in this store.' }
    }
    const item: InventoryItem = {
      id: uid('inv'),
      storeId,
      name,
      category,
      baseUnit: data.baseUnit,
      packages: data.packages.map((pkg) => ({
        id: uid('pkg'),
        label: pkg.label.trim(),
        baseQtyPerPackage: roundQuantity(pkg.baseQtyPerPackage),
      })),
      onHand: 0,
      reorderLevel: roundQuantity(data.reorderLevel),
      avgCostPerBaseUnit: 0,
      lastCostPerBaseUnit: 0,
      active: true,
    }
    commitDb((prev) => addLog({
      ...prev,
      inventoryItems: [...prev.inventoryItems, item],
    }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'inventory',
      entityId: item.id,
      summary: `Created inventory item ${item.name}`,
      after: itemSnapshot(item),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const updateInventoryItem = useCallback<AppContextValue['updateInventoryItem']>((id, patch) => {
    const item = dbRef.current.inventoryItems.find((candidate) => candidate.id === id)
    if (!item) return { ok: false, error: 'Inventory item not found.' }
    const actorResult = requireCapability(item.storeId, 'manageInventory')
    if (!actorResult.ok) return actorResult
    const nextName = patch.name === undefined ? item.name : patch.name.trim()
    const nextCategory = patch.category === undefined ? item.category : patch.category.trim()
    if (!nextName || nextName.length > 100 || !nextCategory || nextCategory.length > 60) {
      return { ok: false, error: 'Enter an item name and category.' }
    }
    if (dbRef.current.inventoryItems.some((other) =>
      other.id !== id && other.storeId === item.storeId &&
      other.name.toLowerCase() === nextName.toLowerCase(),
    )) {
      return { ok: false, error: 'An inventory item with that name already exists in this store.' }
    }
    if (patch.reorderLevel !== undefined &&
      (!Number.isFinite(patch.reorderLevel) || patch.reorderLevel < 0)) {
      return { ok: false, error: 'Enter a non-negative reorder level.' }
    }
    if (patch.packages !== undefined && !validPackages(patch.packages)) {
      return { ok: false, error: 'Enter valid package sizes.' }
    }
    if (patch.baseUnit !== undefined && !isInventoryUnit(patch.baseUnit)) {
      return { ok: false, error: 'Choose a valid base unit.' }
    }
    if (patch.baseUnit !== undefined && patch.baseUnit !== item.baseUnit &&
      (item.onHand !== 0 || dbRef.current.stockMovements.some((movement) => movement.itemId === id))) {
      return { ok: false, error: 'The base unit cannot change after stock activity has been recorded.' }
    }
    if (patch.active !== undefined && typeof patch.active !== 'boolean') {
      return { ok: false, error: 'Choose a valid active status.' }
    }
    const updated: InventoryItem = {
      ...item,
      name: nextName,
      category: nextCategory,
      baseUnit: patch.baseUnit ?? item.baseUnit,
      packages: patch.packages === undefined ? item.packages : patch.packages.map((pkg) => ({
        id: uid('pkg'),
        label: pkg.label.trim(),
        baseQtyPerPackage: roundQuantity(pkg.baseQtyPerPackage),
      })),
      reorderLevel: patch.reorderLevel === undefined ? item.reorderLevel : roundQuantity(patch.reorderLevel),
      active: patch.active ?? item.active,
    }
    const changes = changedAuditFields(itemSnapshot(item), itemSnapshot(updated))
    commitDb((prev) => addLog({
      ...prev,
      inventoryItems: prev.inventoryItems.map((candidate) => candidate.id === id ? updated : candidate),
    }, actorResult.actor, {
      storeId: item.storeId,
      action: 'edited',
      entity: 'inventory',
      entityId: id,
      summary: `Edited inventory item ${item.name}`,
      before: changes.before,
      after: changes.after,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const applyMovement = useCallback((
    itemId: string,
    quantityDelta: number,
    type: StockMovement['type'],
    reason: string | undefined,
    action: 'inventory_opening' | 'stock_adjusted' | 'waste_recorded' | 'stock_counted',
  ): Result => {
    const item = dbRef.current.inventoryItems.find((candidate) => candidate.id === itemId)
    if (!item) return { ok: false as const, error: 'Inventory item not found.' }
    const actorResult = requireCapability(item.storeId, 'manageInventory')
    if (!actorResult.ok) return actorResult
    if (!item.active) return { ok: false as const, error: 'Activate this inventory item before changing its stock.' }
    const delta = roundQuantity(quantityDelta)
    if (!Number.isFinite(delta) || (delta === 0 && type !== 'count_correction') || item.onHand + delta < 0) {
      return { ok: false as const, error: 'The quantity must be valid and cannot reduce stock below zero.' }
    }
    const movement: StockMovement = {
      id: uid('mov'),
      storeId: item.storeId,
      itemId: item.id,
      type,
      qtyDelta: delta,
      unitCostSnapshot: roundCost(item.avgCostPerBaseUnit),
      reason: typeof reason === 'string' ? reason.trim().slice(0, 240) || undefined : undefined,
      userId: actorResult.actor.id,
      userName: actorResult.actor.name,
      createdAt: new Date().toISOString(),
    }
    const updated = { ...item, onHand: roundQuantity(item.onHand + delta) }
    commitDb((prev) => {
      const maintained = maintainAvailabilityAfterStockChange(
        prev,
        prev.products,
        prev.inventoryItems.map((candidate) => candidate.id === item.id ? updated : candidate),
        actorResult.actor,
      )
      return addLog(maintained, actorResult.actor, {
        storeId: item.storeId,
        action,
        entity: 'inventory',
        entityId: item.id,
        summary: `${type === 'opening' ? 'Recorded opening stock for' : type === 'waste' ? 'Recorded waste for' : type === 'count_correction' ? 'Counted stock for' : 'Adjusted stock for'} ${item.name}`,
        before: { onHand: item.onHand },
        after: { onHand: updated.onHand, qtyDelta: delta, reason: movement.reason ?? '' },
      })
    })
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const recordOpeningStock = useCallback<AppContextValue['recordOpeningStock']>((itemId, quantity, reason) => {
    const item = dbRef.current.inventoryItems.find((candidate) => candidate.id === itemId)
    if (!item) return { ok: false, error: 'Inventory item not found.' }
    const actorResult = requireCapability(item.storeId, 'manageInventory')
    if (!actorResult.ok) return actorResult
    if (item.onHand !== 0 || dbRef.current.stockMovements.some((movement) => movement.itemId === itemId)) {
      return { ok: false, error: 'Opening stock can only be recorded once, before stock activity.' }
    }
    if (reason !== undefined && typeof reason !== 'string') {
      return { ok: false, error: 'Enter a valid reason for the opening stock.' }
    }
    if (!Number.isFinite(quantity) || roundQuantity(quantity) <= 0) {
      return { ok: false, error: 'Enter an opening quantity greater than zero.' }
    }
    return applyMovement(itemId, quantity, 'opening', reason, 'inventory_opening')
  }, [applyMovement, dbRef, requireCapability])

  const recordWaste = useCallback<AppContextValue['recordWaste']>((itemId, quantity, reason) => {
    if (typeof reason !== 'string' || !reason.trim()) return { ok: false, error: 'Enter a reason for the waste.' }
    if (!Number.isFinite(quantity) || roundQuantity(quantity) <= 0) {
      return { ok: false, error: 'Enter a waste quantity greater than zero.' }
    }
    return applyMovement(itemId, -quantity, 'waste', reason, 'waste_recorded')
  }, [applyMovement])

  const adjustStock = useCallback<AppContextValue['adjustStock']>((itemId, quantityDelta, reason) => {
    if (typeof reason !== 'string' || !reason.trim()) return { ok: false, error: 'Enter a reason for the adjustment.' }
    if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
      return { ok: false, error: 'Enter a non-zero stock adjustment.' }
    }
    return applyMovement(itemId, quantityDelta, 'adjustment', reason, 'stock_adjusted')
  }, [applyMovement])

  const recordStockCount = useCallback<AppContextValue['recordStockCount']>((itemId, actualQuantity, reason) => {
    const item = dbRef.current.inventoryItems.find((candidate) => candidate.id === itemId)
    if (!item) return { ok: false, error: 'Inventory item not found.' }
    if (typeof reason !== 'string' || !reason.trim()) return { ok: false, error: 'Enter a reason for the stock count.' }
    if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
      return { ok: false, error: 'Enter a valid counted quantity.' }
    }
    return applyMovement(itemId, actualQuantity - item.onHand, 'count_correction', reason, 'stock_counted')
  }, [applyMovement, dbRef])

  return {
    addInventoryItem,
    updateInventoryItem,
    recordOpeningStock,
    recordWaste,
    adjustStock,
    recordStockCount,
  }
}

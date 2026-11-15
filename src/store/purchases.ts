import { useCallback } from 'react'
import type { Purchase, StockMovement, Supplier } from '../types'
import { round } from '../lib/pricing-utils'
import { uid } from '../lib/utils'
import { addLog } from './audit'
import { maintainAvailabilityAfterStockChange } from './availabilityMaintenance'
import { openShiftForStaff } from '../lib/registerShifts'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'
import {
  applyPurchaseLines,
  preparePurchase,
  purchaseSnapshot,
  reversePurchaseLines,
} from './purchaseHelpers'

export function usePurchasesSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireCapability } = dependencies

  const addSupplier = useCallback<AppContextValue['addSupplier']>((storeId, data) => {
    const actorResult = requireCapability(storeId, 'recordPurchases')
    if (!actorResult.ok) return actorResult
    if (!data || typeof data !== 'object' ||
      typeof data.name !== 'string' || typeof data.phone !== 'string' ||
      typeof data.email !== 'string' || typeof data.address !== 'string' ||
      typeof data.notes !== 'string') {
      return { ok: false, error: 'Enter valid supplier details.' }
    }
    const name = data.name.trim()
    if (!name || name.length > 100) return { ok: false, error: 'Enter a supplier name.' }
    if (dbRef.current.suppliers.some((supplier) =>
      supplier.storeId === storeId && supplier.name.toLowerCase() === name.toLowerCase(),
    )) return { ok: false, error: 'A supplier with that name already exists.' }
    const supplier: Supplier = {
      id: uid('sup'),
      storeId,
      name,
      phone: data.phone.trim().slice(0, 40),
      email: data.email.trim().slice(0, 120),
      address: data.address.trim().slice(0, 240),
      notes: data.notes.trim().slice(0, 500),
      active: true,
      createdAt: new Date().toISOString(),
    }
    commitDb((prev) => addLog({ ...prev, suppliers: [...prev.suppliers, supplier] }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'supplier',
      entityId: supplier.id,
      summary: `Added supplier ${supplier.name}`,
      after: { name: supplier.name },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const updateSupplier = useCallback<AppContextValue['updateSupplier']>((id, patch) => {
    const supplier = dbRef.current.suppliers.find((item) => item.id === id)
    if (!supplier) return { ok: false, error: 'Supplier not found.' }
    const actorResult = requireCapability(supplier.storeId, 'recordPurchases')
    if (!actorResult.ok) return actorResult
    if (!patch || typeof patch !== 'object' ||
      Object.entries(patch).some(([key, value]) =>
        key === 'active' ? typeof value !== 'boolean' : typeof value !== 'string',
      )) return { ok: false, error: 'Enter valid supplier details.' }
    const name = patch.name === undefined ? supplier.name : patch.name.trim()
    if (!name || name.length > 100) return { ok: false, error: 'Enter a supplier name.' }
    if (dbRef.current.suppliers.some((item) =>
      item.id !== id && item.storeId === supplier.storeId && item.name.toLowerCase() === name.toLowerCase(),
    )) return { ok: false, error: 'A supplier with that name already exists.' }
    const updated = {
      ...supplier,
      ...patch,
      name,
      phone: (patch.phone ?? supplier.phone).trim().slice(0, 40),
      email: (patch.email ?? supplier.email).trim().slice(0, 120),
      address: (patch.address ?? supplier.address).trim().slice(0, 240),
      notes: (patch.notes ?? supplier.notes).trim().slice(0, 500),
    }
    commitDb((prev) => addLog({
      ...prev,
      suppliers: prev.suppliers.map((item) => item.id === id ? updated : item),
    }, actorResult.actor, {
      storeId: supplier.storeId,
      action: 'edited',
      entity: 'supplier',
      entityId: id,
      summary: `Updated supplier ${supplier.name}`,
      before: { name: supplier.name, active: supplier.active },
      after: { name: updated.name, active: updated.active },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const addPurchase = useCallback<AppContextValue['addPurchase']>((storeId, data) => {
    const actorResult = requireCapability(storeId, 'recordPurchases')
    if (!actorResult.ok) return actorResult
    const prepared = preparePurchase(
      storeId, data, dbRef.current.suppliers,
      dbRef.current.inventoryItems, dbRef.current.purchases,
    )
    if ('error' in prepared) return { ok: false, error: prepared.error }
    const applied = applyPurchaseLines(dbRef.current.inventoryItems, prepared.lines)
    if (!applied.ok) return applied
    const actor = actorResult.actor
    const now = new Date().toISOString()
    const purchase: Purchase = {
      id: uid('purchase'),
      storeId,
      supplierId: prepared.supplier.id,
      supplierName: prepared.supplier.name,
      invoiceNumber: prepared.invoiceNumber,
      receivedAt: data.receivedAt,
      lines: prepared.lines.map(({ unitCostPerBaseUnit: _cost, ...line }) => line),
      subtotal: prepared.subtotal,
      paidAmount: 0,
      status: 'received',
      note: data.note.trim().slice(0, 500),
      receiptImage: data.receiptImage,
      createdById: actor.id,
      createdByName: actor.name,
      createdAt: now,
    }
    const movements = prepared.lines.map((line): StockMovement => ({
      id: uid('mov'),
      storeId,
      itemId: line.inventoryItemId,
      type: 'purchase',
      qtyDelta: line.baseQuantity,
      unitCostSnapshot: line.unitCostPerBaseUnit,
      reason: `Purchase ${purchase.invoiceNumber || purchase.id}`,
      userId: actor.id,
      userName: actor.name,
      refType: 'purchase',
      refId: purchase.id,
      createdAt: now,
    }))
    commitDb((prev) => {
      const maintained = maintainAvailabilityAfterStockChange(
        prev,
        prev.products,
        applied.items,
        actor,
      )
      return addLog({
        ...maintained,
        purchases: [purchase, ...prev.purchases],
        stockMovements: [...prev.stockMovements, ...movements],
      }, actor, {
        storeId,
        action: 'created',
        entity: 'purchase',
        entityId: purchase.id,
        summary: `Received purchase from ${purchase.supplierName}`,
        after: purchaseSnapshot(purchase),
      })
    })
    return { ok: true, purchase }
  }, [commitDb, dbRef, requireCapability])

  const updatePurchase = useCallback<AppContextValue['updatePurchase']>((id, data) => {
    const purchase = dbRef.current.purchases.find((item) => item.id === id)
    if (!purchase || purchase.status !== 'received') return { ok: false, error: 'Active purchase not found.' }
    const actorResult = requireCapability(purchase.storeId, 'recordPurchases')
    if (!actorResult.ok) return actorResult
    if (purchase.paidAmount > 0 || dbRef.current.purchasePayments.some((payment) => payment.purchaseId === id)) {
      return { ok: false, error: 'Purchases with recorded payments cannot be edited.' }
    }
    const prepared = preparePurchase(
      purchase.storeId, data, dbRef.current.suppliers,
      dbRef.current.inventoryItems, dbRef.current.purchases, id,
    )
    if ('error' in prepared) return { ok: false, error: prepared.error }
    const reversed = reversePurchaseLines(
      dbRef.current.inventoryItems, purchase, dbRef.current.stockMovements,
      actorResult.actor, 'Reversed purchase before edit',
    )
    if (!reversed.ok) return reversed
    const applied = applyPurchaseLines(reversed.items, prepared.lines)
    if (!applied.ok) return applied
    const now = new Date().toISOString()
    const updated: Purchase = {
      ...purchase,
      supplierId: prepared.supplier.id,
      supplierName: prepared.supplier.name,
      invoiceNumber: prepared.invoiceNumber,
      receivedAt: data.receivedAt,
      lines: prepared.lines.map(({ unitCostPerBaseUnit: _cost, ...line }) => line),
      subtotal: prepared.subtotal,
      note: data.note.trim().slice(0, 500),
      receiptImage: data.receiptImage,
    }
    const movements = prepared.lines.map((line): StockMovement => ({
      id: uid('mov'),
      storeId: purchase.storeId,
      itemId: line.inventoryItemId,
      type: 'purchase',
      qtyDelta: line.baseQuantity,
      unitCostSnapshot: line.unitCostPerBaseUnit,
      reason: `Edited purchase ${updated.invoiceNumber || updated.id}`,
      userId: actorResult.actor.id,
      userName: actorResult.actor.name,
      refType: 'purchase',
      refId: purchase.id,
      createdAt: now,
    }))
    commitDb((prev) => {
      const maintained = maintainAvailabilityAfterStockChange(
        prev,
        prev.products,
        applied.items,
        actorResult.actor,
      )
      return addLog({
        ...maintained,
        purchases: prev.purchases.map((item) => item.id === id ? updated : item),
        stockMovements: [...prev.stockMovements, ...reversed.movements, ...movements],
      }, actorResult.actor, {
        storeId: purchase.storeId,
        action: 'edited',
        entity: 'purchase',
        entityId: id,
        summary: `Edited purchase from ${purchase.supplierName}`,
        before: purchaseSnapshot(purchase),
        after: purchaseSnapshot(updated),
      })
    })
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const recordPurchasePayment = useCallback<AppContextValue['recordPurchasePayment']>((purchaseId, data) => {
    const purchase = dbRef.current.purchases.find((item) => item.id === purchaseId)
    if (!purchase || purchase.status !== 'received') return { ok: false, error: 'Active purchase not found.' }
    const actorResult = requireCapability(purchase.storeId, 'recordPurchases')
    if (!actorResult.ok) return actorResult
    if (!data || typeof data !== 'object' || typeof data.note !== 'string') {
      return { ok: false, error: 'Enter valid payment details.' }
    }
    if (!Number.isFinite(data.amount) || data.amount <= 0 ||
      round(data.amount) > round(purchase.subtotal - purchase.paidAmount)) {
      return { ok: false, error: 'Payment must be greater than zero and cannot exceed the remaining balance.' }
    }
    if (!['cash', 'card', 'bank_transfer', 'other'].includes(data.method)) {
      return { ok: false, error: 'Choose a valid payment method.' }
    }
    const payment = {
      id: uid('ppay'),
      storeId: purchase.storeId,
      purchaseId,
      amount: round(data.amount),
      method: data.method,
      note: data.note.trim().slice(0, 240),
      userId: actorResult.actor.id,
      userName: actorResult.actor.name,
      createdAt: new Date().toISOString(),
      shiftId: openShiftForStaff(dbRef.current, purchase.storeId, actorResult.actor.id)?.id,
    }
    const paidAmount = round(purchase.paidAmount + payment.amount)
    commitDb((prev) => addLog({
      ...prev,
      purchases: prev.purchases.map((item) => item.id === purchaseId ? { ...item, paidAmount } : item),
      purchasePayments: [...prev.purchasePayments, payment],
    }, actorResult.actor, {
      storeId: purchase.storeId,
      action: 'debt_payment',
      entity: 'purchase',
      entityId: purchaseId,
      summary: `Recorded supplier payment for ${purchase.supplierName}`,
      before: { paidAmount: purchase.paidAmount },
      after: { paidAmount },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const voidPurchase = useCallback<AppContextValue['voidPurchase']>((id, reason) => {
    const purchase = dbRef.current.purchases.find((item) => item.id === id)
    if (!purchase || purchase.status !== 'received') return { ok: false, error: 'Active purchase not found.' }
    const actorResult = requireCapability(purchase.storeId, 'recordPurchases')
    if (!actorResult.ok) return actorResult
    if (purchase.paidAmount > 0 || dbRef.current.purchasePayments.some((payment) => payment.purchaseId === id)) {
      return { ok: false, error: 'A purchase with payments cannot be voided. Settle the supplier separately.' }
    }
    if (typeof reason !== 'string' || !reason.trim()) return { ok: false, error: 'Enter a reason for voiding this purchase.' }
    const reversed = reversePurchaseLines(
      dbRef.current.inventoryItems, purchase, dbRef.current.stockMovements,
      actorResult.actor, `Voided purchase: ${reason.trim().slice(0, 200)}`,
    )
    if (!reversed.ok) return reversed
    const updated = {
      ...purchase,
      status: 'void' as const,
      voidedAt: new Date().toISOString(),
      voidedById: actorResult.actor.id,
      voidedByName: actorResult.actor.name,
    }
    commitDb((prev) => addLog({
      ...prev,
      purchases: prev.purchases.map((item) => item.id === id ? updated : item),
      inventoryItems: reversed.items,
      stockMovements: [...prev.stockMovements, ...reversed.movements],
    }, actorResult.actor, {
      storeId: purchase.storeId,
      action: 'voided',
      entity: 'purchase',
      entityId: id,
      summary: `Voided purchase from ${purchase.supplierName}`,
      before: purchaseSnapshot(purchase),
      after: { ...purchaseSnapshot(updated), reason: reason.trim().slice(0, 200) },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  return { addSupplier, updateSupplier, addPurchase, updatePurchase, recordPurchasePayment, voidPurchase }
}

import type {
  Database,
  Order,
  RegisterItemRow,
  RegisterItemsReport,
  RegisterSession,
  RegisterVoidedItemRow,
} from '../types'
import { round } from './pricing-utils.ts'
import { orderPaidBy } from './shiftCash.ts'

type ItemSource = Pick<Database, 'orders' | 'products' | 'categories'>
type ItemSort = 'name' | 'quantity'
type AggregatedItemRow = RegisterItemRow & { voidedByName?: string }

const isInWindow = (value: string | undefined, start: number, end: number) => {
  if (!value) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end
}

export const ordersCreatedInWindow = (
  db: Pick<Database, 'orders'>,
  storeId: string,
  start: number,
  end: number,
) => db.orders.filter((order) =>
  order.storeId === storeId &&
  (order.status === 'completed' || order.status === 'recorded' || order.status === 'void') &&
  isInWindow(order.createdAt, start, end),
)

export const completedOrdersAt = (orders: Order[], end: number) => orders.filter((order) =>
  order.status === 'completed' ||
  (order.status === 'void' && order.paymentMethod !== 'unpaid' && isAfter(order.voidedAt, end)),
)

export const ordersForRegisterSession = (
  db: Pick<Database, 'orders'>,
  session: Pick<RegisterSession, 'id' | 'storeId' | 'openedAt'> & Partial<Pick<RegisterSession, 'staffId' | 'openedById'>>,
  endISO: string,
) => {
  const end = Date.parse(endISO)
  const start = Date.parse(session.openedAt)
  const staffId = session.staffId ?? session.openedById
  const ownerScoped = Boolean(staffId)
  return db.orders.filter((order) =>
    order.storeId === session.storeId &&
    isInWindow(order.createdAt, start, end) &&
    (ownerScoped ? orderPaidBy(order) === staffId : order.shiftId === session.id || order.shiftId === undefined) &&
    (order.status === 'completed' || order.status === 'recorded' || order.status === 'void'),
  )
}

export const voidedOrdersForRegisterSession = (
  db: Pick<Database, 'orders'>,
  session: Pick<RegisterSession, 'id' | 'storeId' | 'openedAt'> & Partial<Pick<RegisterSession, 'staffId' | 'openedById'>>,
  endISO: string,
) => {
  const end = Date.parse(endISO)
  const start = Date.parse(session.openedAt)
  return db.orders.filter((order) =>
    order.storeId === session.storeId &&
    order.status === 'void' &&
    isInWindow(order.voidedAt, start, end) &&
    (session.staffId || session.openedById
      ? !order.voidedById || order.voidedById === (session.staffId ?? session.openedById)
      : order.voidShiftId === session.id || order.voidShiftId === undefined),
  )
}

export const recordedOrdersAt = (orders: Order[], end: number) => orders.filter((order) =>
  order.status === 'recorded' ||
  (order.status === 'void' && order.paymentMethod === 'unpaid' && isAfter(order.voidedAt, end)),
)

const isAfter = (value: string | undefined, timestamp: number) => {
  if (!value) return false
  const date = Date.parse(value)
  return Number.isFinite(date) && date > timestamp
}

const pricedModifiers = (item: Order['items'][number]) =>
  item.modifiers
    ?.filter((modifier) => round(modifier.priceDelta) !== 0)
    .sort((a, b) => a.groupId.localeCompare(b.groupId) || a.optionId.localeCompare(b.optionId)) ?? []

const aggregateOrderItems = (
  orders: Order[],
  db: Pick<Database, 'products' | 'categories'>,
  groupByVoider = false,
): AggregatedItemRow[] => {
  const products = new Map(db.products.map((product) => [product.id, product]))
  const categories = new Map(db.categories.map((category) => [category.id, category.name]))
  const rows = new Map<string, AggregatedItemRow>()

  for (const order of orders) {
    order.items.forEach((item) => {
      const modifiers = pricedModifiers(item)
      const modifierKey = modifiers.map((modifier) => [
        modifier.groupId,
        modifier.optionId,
        round(modifier.priceDelta),
      ])
      const key = JSON.stringify([
        item.productId,
        item.variantId ?? '',
        modifierKey,
        item.soldByWeight === true,
        item.saleUnit ?? '',
        groupByVoider ? order.voidedById ?? order.voidedByName ?? '' : '',
      ])
      const name = [
        item.name,
        item.variantName,
        ...modifiers.map((modifier) => modifier.optionName),
      ].filter(Boolean).join(' - ')
      const product = products.get(item.productId)
      const category = product ? categories.get(product.categoryId) : undefined
      const current = rows.get(key)
      const lineTotal = round(item.price * item.qty)

      if (current) {
        current.qty = round(current.qty + item.qty)
        current.total = round(current.total + lineTotal)
        if (current.unitPrice !== null && round(current.unitPrice) !== round(item.price)) {
          current.unitPrice = null
        }
      } else {
        rows.set(key, {
          key,
          productId: item.productId,
          variantId: item.variantId,
          category: category ?? 'Other',
          name,
          qty: round(item.qty),
          soldByWeight: item.soldByWeight === true,
          saleUnit: item.saleUnit,
          unitPrice: round(item.price),
          total: lineTotal,
          voidedByName: groupByVoider ? order.voidedByName ?? 'Unknown' : undefined,
        })
      }
    })
  }

  return [...rows.values()].sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key),
  )
}

const aggregateItems = (orders: Order[], db: Pick<Database, 'products' | 'categories'>) =>
  aggregateOrderItems(orders, db).map(({ voidedByName: _voidedByName, ...item }) => item)

const aggregateVoidedItems = (
  orders: Order[],
  db: Pick<Database, 'products' | 'categories'>,
): RegisterVoidedItemRow[] =>
  aggregateOrderItems(orders, db, true).map(({ voidedByName, ...item }) => ({
    ...item,
    voidedByName: voidedByName ?? 'Unknown',
  }))

const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0))

export const registerSessionItems = (
  db: ItemSource,
  session: Pick<RegisterSession, 'id' | 'storeId' | 'openedAt'> & Partial<Pick<RegisterSession, 'staffId' | 'openedById'>>,
  endISO: string,
  staffId?: string,
): RegisterItemsReport => {
  const start = Date.parse(session.openedAt)
  const end = Date.parse(endISO)
  const inWindow = ordersForRegisterSession(db, session, endISO)
  const completed = completedOrdersAt(inWindow, end)
  const recorded = recordedOrdersAt(inWindow, end)
  const voided = db.orders.filter((order) =>
    order.storeId === session.storeId &&
    order.status === 'void' &&
    (order.voidShiftId === session.id || (order.voidShiftId === undefined && isInWindow(order.voidedAt, start, end))) &&
    (!session.staffId && !session.openedById || !order.voidedById ||
      order.voidedById === (session.staffId ?? session.openedById)),
  )
  const inScopeSales = (orders: Order[]) => staffId ? orders.filter((order) => orderPaidBy(order) === staffId) : orders
  const inScopeVoids = (orders: Order[]) => staffId
    ? orders.filter((order) => (order.voidedById ?? orderPaidBy(order)) === staffId)
    : orders

  return {
    itemsSold: aggregateItems(inScopeSales(completed), db),
    recordedItems: aggregateItems(inScopeSales(recorded), db),
    voidedItems: aggregateVoidedItems(inScopeVoids(voided), db),
  }
}

export const groupRegisterItemRows = (items: RegisterItemRow[], sort: ItemSort = 'name') => {
  const categories = new Map<string, RegisterItemRow[]>()
  for (const item of items) {
    const category = categories.get(item.category) ?? []
    category.push(item)
    categories.set(item.category, category)
  }
  return [...categories.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, rows]) => {
      const sorted = rows.sort((a, b) =>
        sort === 'quantity'
          ? b.qty - a.qty || a.name.localeCompare(b.name)
          : a.name.localeCompare(b.name),
      )
      return {
        category,
        items: sorted,
        qty: sum(sorted.map((item) => item.qty)),
        total: sum(sorted.map((item) => item.total)),
      }
    })
}

export const summarizeRegisterItems = (sections: RegisterItemRow[][]) => {
  const items = sections.flat()
  return {
    qty: sum(items.map((item) => item.qty)),
    distinctItems: new Set(items.map((item) => item.key)).size,
    total: sum(items.map((item) => item.total)),
  }
}

export const formatRegisterItemQuantity = (item: Pick<RegisterItemRow, 'qty' | 'soldByWeight'>) =>
  item.soldByWeight ? item.qty.toFixed(3) : String(Math.round(item.qty))

export type RegisterItemSort = ItemSort

import type { Database, OpenOrder, Order, TableOrderEvent } from '../types'

export const completeOpenOrderPayment = (
  db: Database,
  openOrder: OpenOrder,
  paidOrder: Order,
  tableHistory: TableOrderEvent[],
): { database: Database; order: Order } => {
  const order: Order = {
    ...paidOrder,
    ownerStaffId: openOrder.staffId,
    ownerStaffName: openOrder.staffName,
    tableHistory,
  }
  return {
    database: {
      ...db,
      openOrders: db.openOrders.filter((item) => item.id !== openOrder.id),
      orders: [
        ...db.orders.filter((item) =>
          item.id !== openOrder.recordedOrderId && item.id !== order.id,
        ),
        order,
      ],
    },
    order,
  }
}

import type { OpenOrder, Order, OrderChannel, OrderItem, PaymentMethod, Store } from '../../types'
import type { AppContextValue } from '../../store/types'
import { money, uid } from '../../lib/utils.ts'
import { orderNumberLabel } from '../../lib/orderNumber.ts'
import { unassignedStationItems } from '../../lib/tickets.ts'
import { modeFeatures } from '../../lib/posMode.ts'

/** Guard against double taps while a checkout is being applied. */
let checkoutInFlight = false
/** Stable idempotency key for the current checkout attempt. */
let checkoutKey: string | null = null

type Props = {
  store: Store
  channel: OrderChannel
  tableId?: string
  tableName?: string
  guests?: number
  openOrder?: OpenOrder
  quick: boolean
  cart: OrderItem[]
  customerId?: string
  discount: number
  note: string
  activeDiscount: number
  activeNote: string
  canSaveOpenOrder: boolean
  count: number
  canUseCredit: boolean
  createOrder: AppContextValue['createOrder']
  addItemsToOpenOrder: AppContextValue['addItemsToOpenOrder']
  sendToStations: AppContextValue['sendToStations']
  dispatchStationTickets: (order: OpenOrder, items: OrderItem[], kind: 'NEW' | 'ADDITION') => void
  payOpenOrder: AppContextValue['payOpenOrder']
  recordOpenOrder: AppContextValue['recordOpenOrder']
  push: (message: string, type: 'success' | 'error') => void
  focusTablePicker: () => void
  setCart: (items: OrderItem[]) => void
  setDiscount: (discount: number) => void
  setOpenDiscount: (discount: number | undefined) => void
  setOpenNote: (note: string | undefined) => void
  setChannel: (channel: OrderChannel) => void
  setTableId: (tableId: string | undefined) => void
  setTableName: (tableName: string) => void
  setGuests: (guests: number | undefined) => void
  setCustomerId: (customerId: string | undefined) => void
  setCustomerOpen: (open: boolean) => void
  setPaymentOpen: (open: boolean) => void
  setMobileCartOpen: (open: boolean) => void
  setReceipt: (order: Order | null) => void
  navigateToFloor: () => void
}

export const createPOSActions = (props: Props) => {
  const resetSale = () => {
    props.setCart([])
    props.setDiscount(0)
    props.setOpenDiscount(undefined)
    props.setOpenNote(undefined)
    props.setCustomerId(undefined)
    props.setChannel('takeaway')
    props.setTableId(undefined)
    props.setTableName('')
    props.setGuests(undefined)
    props.setPaymentOpen(false)
    props.setMobileCartOpen(false)
  }

  const clearCart = () => {
    props.setCart([])
    if (!props.openOrder) props.setDiscount(0)
  }

  const sendPendingItems = (orderId: string, hadPreviouslySentItems: boolean): string | null => {
    if (!modeFeatures(props.store).kitchenStations) return null
    const result = props.sendToStations(orderId)
    if (!result.ok) {
      props.push(result.error, 'error')
      return result.error
    }
    const kind = hadPreviouslySentItems ? 'ADDITION' : 'NEW'
    const unassigned = unassignedStationItems(result.order.items)
    if (unassigned.length) {
      props.push(
        `No station assigned to these items, nothing was sent to the kitchen: ${unassigned.map((item) => item.name).join(', ')}`,
        'error',
      )
    }
    if (result.items.length) props.dispatchStationTickets(result.order, result.items, kind)
    return null
  }

  const completeSale = (method: PaymentMethod): string | null => {
    if (checkoutInFlight) {
      const message = 'Payment is already being processed.'
      props.push(message, 'error')
      return message
    }
    checkoutInFlight = true
    const fail = (message: string) => {
      props.push(message, 'error')
      return message
    }
    try {
      if (!props.openOrder && props.channel === 'dine-in' &&
        props.store.settings.features.tables &&
        (props.store.settings.tableMode === 'manual'
          ? !props.tableName?.trim()
          : !props.tableId)) {
        const message = props.store.settings.tableMode === 'manual' ? 'Enter a table name.' : 'Choose a table before checking out.'
        fail(message)
        props.focusTablePicker()
        return message
      }
      if (props.openOrder) {
        if (props.quick) {
          if (props.canSaveOpenOrder) {
            const saved = props.addItemsToOpenOrder(
              props.openOrder.id,
              props.cart,
              props.activeDiscount,
              props.activeNote,
            )
            if (!saved.ok) {
              return fail(saved.error)
            }
            props.setCart([])
            props.setOpenDiscount(undefined)
            props.setOpenNote(undefined)
          }
          const recorded = props.recordOpenOrder(props.openOrder.id)
          if (!recorded.ok) {
            return fail(recorded.error)
          }
          props.push(`Table order #${orderNumberLabel(recorded.order, props.store.settings)} recorded · no payment taken`, 'success')
          props.setPaymentOpen(false)
          props.setMobileCartOpen(false)
          resetSale()
          props.navigateToFloor()
          return null
        }
        if (props.canSaveOpenOrder) {
          const saved = props.addItemsToOpenOrder(
            props.openOrder.id,
            props.cart,
            props.activeDiscount,
            props.activeNote,
          )
          if (!saved.ok) {
            return fail(saved.error)
          }
          props.setCart([])
          props.setOpenDiscount(undefined)
          props.setOpenNote(undefined)
        }
        const hadPreviouslySentItems = props.openOrder.items.some((item) =>
          item.sentAt || (item.status !== 'draft' && item.status !== 'void'),
        )
        const sendError = sendPendingItems(props.openOrder.id, hadPreviouslySentItems)
        if (sendError) return sendError
        const paid = props.payOpenOrder(props.openOrder.id, method, props.customerId)
        if (!paid.ok) {
          return fail(paid.error)
        }
        props.push(
          paid.alreadyPaid
            ? `Already paid by ${paid.order.paidByName ?? paid.order.staffName} · ${money(paid.order.total)}`
            : `Table order · ${money(paid.order.total)} paid`,
          'success',
        )
        props.setPaymentOpen(false)
        props.setMobileCartOpen(false)
        resetSale()
        props.setReceipt(paid.order)
        return null
      }
      checkoutKey ??= uid('checkout')
      const result = props.createOrder({
        items: props.cart,
        channel: props.channel,
        tableId: props.tableId,
        tableName: props.tableName,
        guests: props.guests,
        paymentMethod: method,
        customerId: props.customerId,
        discount: props.discount,
        note: props.note,
        clientOrderId: checkoutKey,
      })
      if (!result.ok) {
        return fail(result.error)
      }
      checkoutKey = null
      props.push(
        props.quick
          ? `Order #${orderNumberLabel(result.order, props.store.settings)} completed`
          : `Order #${orderNumberLabel(result.order, props.store.settings)} · ${money(result.order.total)} completed`,
        'success',
      )
      props.setPaymentOpen(false)
      props.setMobileCartOpen(false)
      resetSale()
      if (!props.quick) props.setReceipt(result.order)
      return null
    } finally {
      checkoutInFlight = false
    }
  }

  const checkout = () => {
    if (!props.count) return
    if (!props.openOrder && props.channel === 'dine-in' &&
      props.store.settings.features.tables &&
      (props.store.settings.tableMode === 'manual'
        ? !props.tableName?.trim()
        : !props.tableId)) {
      props.push(props.store.settings.tableMode === 'manual' ? 'Enter a table name.' : 'Choose a table before checking out.', 'error')
      props.focusTablePicker()
      return
    }
    if (props.openOrder && props.quick) {
      completeSale('unpaid')
      return
    }
    if (props.quick) {
      completeSale('unpaid')
      return
    }
    props.setPaymentOpen(true)
  }

  const addToTab = () => {
    if (!props.canUseCredit) {
      props.push('You do not have permission to add orders to tabs.', 'error')
      return
    }
    if (!props.customerId) {
      props.push('Select a customer first.', 'error')
      props.setCustomerOpen(true)
      return
    }
    completeSale('credit')
  }

  const doneOpenOrder = () => {
    if (!props.openOrder) return
    if (checkoutInFlight) return
    checkoutInFlight = true
    try {
      if (!props.count) {
        resetSale()
        props.navigateToFloor()
        return
      }
      if (props.canSaveOpenOrder) {
        const saved = props.addItemsToOpenOrder(
          props.openOrder.id,
          props.cart,
          props.activeDiscount,
          props.activeNote,
        )
        if (!saved.ok) {
          props.push(saved.error, 'error')
          return
        }
        props.setCart([])
        props.setOpenDiscount(undefined)
        props.setOpenNote(undefined)
      }
      const hadPreviouslySentItems = props.openOrder.items.some((item) =>
        item.sentAt || (item.status !== 'draft' && item.status !== 'void'),
      )
      if (sendPendingItems(props.openOrder.id, hadPreviouslySentItems)) return
      if (props.quick) {
        const recorded = props.recordOpenOrder(props.openOrder.id)
        if (!recorded.ok) {
          props.push(recorded.error, 'error')
          return
        }
        props.push(`Table order #${orderNumberLabel(recorded.order, props.store.settings)} recorded · no payment taken`, 'success')
      } else {
        props.push('Table order saved.', 'success')
      }
      resetSale()
      props.navigateToFloor()
    } finally {
      checkoutInFlight = false
    }
  }

  return { clearCart, completeSale, checkout, addToTab, doneOpenOrder }
}

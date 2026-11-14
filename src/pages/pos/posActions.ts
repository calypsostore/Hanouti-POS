import type { OpenOrder, Order, OrderChannel, OrderItem, PaymentMethod, Store } from '../../types'
import type { AppContextValue } from '../../store/types'
import type { PrintJob } from '../../components/PrintPreview'
import { buildOpenKitchenLines, linesToEscpos } from '../../lib/escpos'
import { money } from '../../lib/utils'

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
  sendToKitchen: AppContextValue['sendToKitchen']
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
  setKitchenJob: (job: PrintJob | null) => void
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

  const completeSale = (method: PaymentMethod) => {
    if (!props.openOrder && props.channel === 'dine-in' &&
      props.store.settings.features.tables &&
      (props.store.settings.tableMode === 'manual'
        ? !props.tableName?.trim()
        : !props.tableId)) {
      props.push(props.store.settings.tableMode === 'manual' ? 'Enter a table name.' : 'Choose a table before checking out.', 'error')
      props.focusTablePicker()
      return
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
            props.push(saved.error, 'error')
            return
          }
          props.setCart([])
          props.setOpenDiscount(undefined)
          props.setOpenNote(undefined)
        }
        const recorded = props.recordOpenOrder(props.openOrder.id)
        if (!recorded.ok) {
          props.push(recorded.error, 'error')
          return
        }
        props.push(`Table order #${recorded.order.number} recorded · no payment taken`, 'success')
        props.setPaymentOpen(false)
        props.setMobileCartOpen(false)
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
      const paid = props.payOpenOrder(props.openOrder.id, method, props.customerId)
      if (!paid.ok) {
        props.push(paid.error, 'error')
        return
      }
      props.push(`Table order · ${money(paid.order.total)} paid`, 'success')
      props.setPaymentOpen(false)
      props.setMobileCartOpen(false)
      resetSale()
      props.setReceipt(paid.order)
      return
    }
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
    })
    if (!result.ok) {
      props.push(result.error, 'error')
      return
    }
    props.push(`Order #${result.order.number} · ${money(result.order.total)} completed`, 'success')
    props.setPaymentOpen(false)
    props.setMobileCartOpen(false)
    resetSale()
    props.setReceipt(result.order)
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

  const saveOpenChanges = () => {
    if (!props.openOrder || !props.canSaveOpenOrder) return
    const result = props.addItemsToOpenOrder(
      props.openOrder.id,
      props.cart,
      props.activeDiscount,
      props.activeNote,
    )
    if (!result.ok) {
      props.push(result.error, 'error')
      return
    }
    props.setCart([])
    props.setOpenDiscount(undefined)
    props.setOpenNote(undefined)
    props.push('Table order saved.', 'success')
  }

  const sendKitchenItems = () => {
    if (!props.openOrder) return
    const result = props.sendToKitchen(
      props.openOrder.id,
      props.cart,
      props.activeDiscount,
      props.activeNote,
    )
    if (!result.ok) {
      props.push(result.error, 'error')
      return
    }
    props.setCart([])
    props.setOpenDiscount(undefined)
    props.setOpenNote(undefined)
    const lines = buildOpenKitchenLines(result.order, result.items, props.store)
    props.setKitchenJob({
      title: 'Kitchen ticket',
      subtitle: `${result.items.length} new item${result.items.length === 1 ? '' : 's'} · ${result.order.tableName}`,
      lines,
      bytes: linesToEscpos(lines, props.store.settings.printer.width),
      kind: 'kitchen',
    })
    props.push(`${result.items.length} new item${result.items.length === 1 ? '' : 's'} sent to the kitchen.`, 'success')
  }

  return { clearCart, completeSale, checkout, addToTab, saveOpenChanges, sendKitchenItems }
}

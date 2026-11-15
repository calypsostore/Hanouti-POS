import { ChevronRight, ShoppingBag, Trash2, UserRound, X } from 'lucide-react'
import type { GuestRequirement, OrderChannel, OrderItem, OpenOrder, TableMode, TableSection } from '../../types'
import { Avatar } from '../../components/ui'
import { cn, money } from '../../lib/utils'
import { ChannelSwitch } from './ChannelSwitch'
import { TablePicker } from './TablePicker'
import type { DiningTable } from '../../types'
import { CartItemsList } from './CartItemsList'
import { CartFooter } from './CartFooter'

export function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition',
        active
        ? 'border-brand-amber/70 bg-[var(--semantic-amber-soft)] text-[var(--semantic-amber-text)] shadow-sm'
        : 'border-line/70 bg-transparent text-muted hover:border-brand-amber/50 hover:text-ink dark:bg-white/[0.04]',
      )}
    >
      {children}
    </button>
  )
}
export function CartPanel({
  embedded,
  cart,
  channel,
  setChannel,
  deliveryEnabled,
  tablesEnabled,
  tables,
  sections,
  openTables,
  tableMode,
  guestRequirement,
  tableId,
  setTableId,
  tableNameInput,
  setTableNameInput,
  guests,
  setGuests,
  focusTablePicker,
  customer,
  customerId,
  balance,
  onPickCustomer,
  onClearCustomer,
  onClear,
  changeQty,
  setLineQty,
  totals,
  discount,
  setDiscount,
  canDiscount,
  note,
  setNote,
  quick,
  allowCredit,
  onCheckout,
  onAddToTab,
  onDone,
  count,
  isOpenOrder,
  tableName,
  sectionName,
  ownerStaffName,
  pendingCount,
  persistedLineIds,
  canVoidSentItems,
  onVoidSentItem,
  onOpenFloor,
  unavailableLineIds = [],
  hasUnavailableDraft = false,
  issueByLine = {},
  issueCount = 0,
  onReview,
}: {
  embedded?: boolean
  cart: OrderItem[]
  channel: OrderChannel
  setChannel: (c: OrderChannel) => void
  deliveryEnabled: boolean
  tablesEnabled: boolean
  tables: DiningTable[]
  sections: TableSection[]
  openTables: OpenOrder[]
  tableMode: TableMode
  guestRequirement: GuestRequirement
  tableId?: string
  setTableId: (id: string | undefined) => void
  tableNameInput: string
  setTableNameInput: (name: string) => void
  guests?: number
  setGuests: (guests: number | undefined) => void
  focusTablePicker?: boolean
  customer?: { name: string; id: string; phone: string }
  customerId?: string
  balance: number
  onPickCustomer: () => void
  onClearCustomer: () => void
  onClear: () => void
  changeQty: (id: string, delta: number) => void
  setLineQty: (id: string, qty: number) => void
  totals: { subtotal: number; tax: number; service: number; total: number }
  discount: number
  setDiscount: (n: number) => void
  canDiscount: boolean
  note: string
  setNote: (s: string) => void
  quick: boolean
  allowCredit: boolean
  onCheckout: () => void
  onAddToTab: () => void
  onDone: () => void
  count: number
  isOpenOrder?: boolean
  tableName?: string
  sectionName?: string
  ownerStaffName?: string
  pendingCount?: number
  persistedLineIds?: string[]
  canVoidSentItems: boolean
  onVoidSentItem: (lineId: string) => void
  onOpenFloor?: () => void
  unavailableLineIds?: string[]
  hasUnavailableDraft?: boolean
  issueByLine?: Record<string, string>
  issueCount?: number
  onReview?: () => void
}) {
  const newItemCount = pendingCount ?? cart.length
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', embedded && 'min-h-[50vh]')}>
      <div className="glass-sidebar flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2 text-white">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-brand-amber" />
          <span className="text-[13.5px] font-bold">{isOpenOrder ? `${tableName ?? 'Table'} order` : 'Current order'}</span>
          {count > 0 && (
            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </div>
        {newItemCount > 0 && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> {isOpenOrder ? 'Clear new' : 'Clear'}
          </button>
        )}
        {tablesEnabled && !isOpenOrder && (
          <button
            onClick={onOpenFloor}
            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-muted transition hover:bg-white/10 hover:text-white"
          >
            Floor
          </button>
        )}
      </div>

      {!isOpenOrder && <div className="shrink-0 border-b border-line/70 px-3 py-1.5">
        <ChannelSwitch channel={channel} setChannel={setChannel} allowDelivery={deliveryEnabled} />
      </div>}
      {(isOpenOrder || channel === 'dine-in') && (
        <div className="shrink-0 border-b border-line/70 px-3 py-2 text-[10.5px] text-muted">
          <span className="font-semibold text-ink">{tableName || tableNameInput || 'Dine-in'}</span>
          {guests !== undefined && <> · {guests} guests</>}
          {sectionName && <> · {sectionName}</>}
          {(ownerStaffName || !isOpenOrder) && <> · {ownerStaffName ?? 'Current staff'}</>}
        </div>
      )}

      <div className={cn('min-h-0 flex-1 overflow-y-auto px-3 py-2 thin-scrollbar', embedded && 'max-h-[36vh]')}>
        {!isOpenOrder && channel === 'dine-in' && tablesEnabled && (
          <TablePicker
            tables={tables}
            sections={sections}
            openTables={openTables}
            tableMode={tableMode}
            guestRequirement={guestRequirement}
            selectedId={tableId}
            onSelect={setTableId}
            tableName={tableNameInput}
            onTableNameChange={setTableNameInput}
            guests={guests}
            onGuestsChange={setGuests}
            autoFocus={focusTablePicker}
          />
        )}
        {customer ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-accent-foreground/25 bg-accent-50 px-2.5 py-2">
            <Avatar name={customer.name} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-ink">{customer.name}</div>
              <div className="text-[10.5px] text-accent-foreground">
                Tab balance · {money(balance)}
              </div>
            </div>
            <button
              onClick={onClearCustomer}
              className="rounded-md p-1 text-accent-foreground/60 hover:bg-white/60 hover:text-accent-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onPickCustomer}
            className="mb-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-2 py-1 text-left transition hover:border-accent-foreground/50 hover:bg-white"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-200 text-muted">
              <UserRound className="h-3.5 w-3.5" />
            </div>
            <span className="flex-1 text-[12px] font-semibold text-ink">Attach a customer</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted/50" />
          </button>
        )}

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-4 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-200 text-muted/70">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <p className="text-[13px] font-semibold text-ink">Nothing here yet</p>
            <p className="mt-1 max-w-[200px] text-[11.5px] leading-relaxed text-muted">
              Tap items on the menu to build the order.
            </p>
          </div>
        ) : (
          <CartItemsList
            items={cart}
            persistedLineIds={persistedLineIds}
            changeQty={changeQty}
            setLineQty={setLineQty}
            canVoidSentItems={canVoidSentItems}
            onVoidSentItem={onVoidSentItem}
            unavailableLineIds={unavailableLineIds}
            issueByLine={issueByLine}
          />
        )}
      </div>

      <CartFooter
        totals={totals}
        discount={discount}
        setDiscount={setDiscount}
        canDiscount={canDiscount}
        note={note}
        setNote={setNote}
        quick={quick}
        allowCredit={allowCredit}
        customerId={customerId}
        onCheckout={onCheckout}
        onAddToTab={onAddToTab}
        onDone={onDone}
        count={count}
        isOpenOrder={isOpenOrder}
        onOpenFloor={onOpenFloor}
        hasUnavailableDraft={hasUnavailableDraft}
        issueCount={issueCount}
        onReview={onReview}
      />
    </div>
  )
}

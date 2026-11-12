import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  LayoutGrid,
  LogOut,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import { useApp } from '../store/AppStore'
import { computeTotals } from '../lib/pricing'
import { balanceFor } from '../lib/selectors'
import { cn, fmtTime, money } from '../lib/utils'
import type { Order, OrderChannel, OrderItem, PaymentMethod } from '../types'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Segmented,
  Select,
  Textarea,
} from '../components/ui'
import { useToast } from '../components/toast'
import { ReceiptView } from '../components/ReceiptView'

export default function POS() {
  const { user, store, db, logout, createOrder } = useApp()
  const navigate = useNavigate()
  const { push } = useToast()
  const [searchParams] = useSearchParams()
  const linkedCustomerId = searchParams.get('customer') ?? undefined

  const [categoryId, setCategoryId] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<OrderItem[]>([])
  const [channel, setChannel] = useState<OrderChannel>('takeaway')
  const [customerId, setCustomerId] = useState<string | undefined>(linkedCustomerId)
  const [discount, setDiscount] = useState(0)
  const [note, setNote] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (linkedCustomerId) setCustomerId(linkedCustomerId)
  }, [linkedCustomerId])

  if (!user || !store) return null

  const categories = db.categories
    .filter((c) => c.storeId === store.id)
    .sort((a, b) => a.sort - b.sort)
  const products = db.products.filter(
    (p) => p.storeId === store.id && p.active && (categoryId === 'all' || p.categoryId === categoryId),
  )
  const customers = db.customers.filter((c) => c.storeId === store.id)
  const customer = customers.find((c) => c.id === customerId)
  const totals = computeTotals(cart, store.settings, discount, channel)
  const count = cart.reduce((a, i) => a + i.qty, 0)
  const quick = store.settings.posMode === 'quick'
  const canUseCredit = store.settings.allowCredit && (user.role === 'admin' || user.permissions.credit)
  const balance = customerId ? balanceFor(db.ledger, customerId) : 0

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const qtyInCart = (productId: string) =>
    cart.find((i) => i.productId === productId)?.qty ?? 0

  const addItem = (productId: string) => {
    const product = db.products.find((p) => p.id === productId)
    if (!product) return
    const existing = qtyInCart(productId)
    if (product.trackStock && existing >= product.stock) {
      push(`${product.name} is out of stock.`, 'error')
      return
    }
    setCart((prev) => {
      const found = prev.find((i) => i.productId === productId)
      if (found) {
        return prev.map((i) => (i.productId === productId ? { ...i, qty: i.qty + 1 } : i))
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          emoji: product.emoji,
          price: product.price,
          qty: 1,
        },
      ]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    )
  }

  const resetSale = () => {
    setCart([])
    setDiscount(0)
    setNote('')
    setCustomerId(undefined)
    setChannel('takeaway')
    setPaymentOpen(false)
    setMobileCartOpen(false)
  }

  const completeSale = (method: PaymentMethod) => {
    const res = createOrder({
      items: cart,
      channel,
      paymentMethod: method,
      customerId,
      discount,
      note,
    })
    if (!res.ok) {
      push(res.error, 'error')
      return
    }
    const order = res.order
    push(`Order #${order.number} · ${money(order.total)} completed`, 'success')
    setPaymentOpen(false)
    setMobileCartOpen(false)
    if (quick) {
      resetSale()
      setReceipt(order)
    } else {
      resetSale()
      setReceipt(order)
    }
  }

  const checkout = () => {
    if (!cart.length) return
    if (quick) {
      completeSale('cash')
      return
    }
    setPaymentOpen(true)
  }

  const addToTab = () => {
    if (!canUseCredit) {
      push('You do not have permission to add orders to tabs.', 'error')
      return
    }
    if (!customerId) {
      push('Select a customer first.', 'error')
      setCustomerOpen(true)
      return
    }
    completeSale('credit')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-cream-100">
      {/* Header */}
      <header className="z-20 flex h-[64px] shrink-0 items-center gap-3 border-b border-line bg-white px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-espresso-900 text-lg">
            {store.emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-bold tracking-tight text-ink">{store.name}</span>
              <Badge tone={quick ? 'info' : 'accent'} className="hidden sm:inline-flex">
                {quick ? <Zap className="h-3 w-3" /> : <ReceiptText className="h-3 w-3" />}
                {quick ? 'Quick' : 'Cashier'}
              </Badge>
            </div>
            <div className="text-[11px] text-muted">
              {store.city} · {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {user.name}
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user.role === 'admin' && (
            <Link
              to="/admin"
              className="hidden h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 sm:inline-flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
          )}
          {user.role === 'staff' && (
            <>
              <Link
                to="/admin/customers"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 sm:px-3"
                title="Regulars & tabs"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Regulars</span>
              </Link>
              <Link
                to="/admin/orders"
                className="hidden h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink transition hover:bg-cream-100 sm:inline-flex"
              >
                <ReceiptText className="h-3.5 w-3.5" /> Orders
              </Link>
            </>
          )}
          <div className="hidden items-center gap-2 rounded-xl border border-line px-2 py-1 sm:flex">
            <Avatar name={user.name} size="xs" />
            <span className="pr-1 text-[12px] font-semibold text-ink">{user.name.split(' ')[0]}</span>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="rounded-xl border border-line p-2 text-muted transition hover:bg-cream-100 hover:text-ink"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Catalogue */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 space-y-3 border-b border-line/70 px-4 pb-3 pt-4 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search the menu…"
                  className="pl-9"
                />
              </div>
              <Segmented
                value={channel}
                onChange={setChannel}
                size="sm"
                options={[
                  { value: 'takeaway', label: 'Takeaway' },
                  { value: 'dine-in', label: 'Dine-in' },
                ]}
                className="hidden sm:inline-flex"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
              <CategoryChip active={categoryId === 'all'} onClick={() => setCategoryId('all')}>
                <LayoutGrid className="h-3.5 w-3.5" /> All items
              </CategoryChip>
              {categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  active={categoryId === c.id}
                  onClick={() => setCategoryId(c.id)}
                >
                  <span>{c.emoji}</span> {c.name}
                </CategoryChip>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-28 sm:px-5 lg:pb-6 thin-scrollbar">
            {filteredProducts.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="h-5 w-5" />}
                title="No items found"
                description="Try a different category or search term."
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredProducts.map((p) => {
                  const qty = qtyInCart(p.id)
                  const out = p.trackStock && p.stock <= 0
                  const low = p.trackStock && p.stock > 0 && p.stock <= store.settings.lowStockThreshold
                  return (
                    <button
                      key={p.id}
                      onClick={() => addItem(p.id)}
                      disabled={out}
                      className={cn(
                        'group relative flex flex-col rounded-2xl border bg-white p-3 text-left transition-all duration-150',
                        'hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-[0_6px_20px_rgba(36,30,25,0.07)]',
                        qty > 0 ? 'border-accent-500/60 ring-2 ring-accent-500/10' : 'border-line/80',
                        out && 'cursor-not-allowed opacity-50 hover:translate-y-0',
                      )}
                    >
                      <div className="mb-2 flex w-full items-start justify-between">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream-100 text-[24px]">
                          {p.emoji}
                        </span>
                        {qty > 0 && (
                          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[11px] font-bold text-white">
                            {qty}
                          </span>
                        )}
                        {low && !out && (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                            {p.stock} left
                          </span>
                        )}
                      </div>
                      <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">
                        {p.name}
                      </span>
                      <span className="mt-1.5 text-[13px] font-bold text-accent-700 tabular">
                        {money(p.price)}
                      </span>
                      <span className="pointer-events-none absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-cream-100 text-muted opacity-0 transition group-hover:opacity-100">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mobile cart bar */}
          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white p-3 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[11px] text-muted">{count} item{count === 1 ? '' : 's'}</div>
                <div className="text-[16px] font-bold tabular">{money(totals.total)}</div>
              </div>
              <Button onClick={() => setMobileCartOpen(true)} disabled={!cart.length}>
                View cart <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Cart */}
        <aside className="hidden w-[380px] shrink-0 border-l border-line bg-cream-50 lg:flex lg:flex-col">
          <CartPanel
            cart={cart}
            channel={channel}
            setChannel={setChannel}
            customer={customer}
            customerId={customerId}
            balance={balance}
            onPickCustomer={() => setCustomerOpen(true)}
            onClearCustomer={() => setCustomerId(undefined)}
            onClear={() => {
              setCart([])
              setDiscount(0)
            }}
            changeQty={changeQty}
            totals={totals}
            discount={discount}
            setDiscount={setDiscount}
            canDiscount={user.permissions.discount}
            note={note}
            setNote={setNote}
            quick={quick}
            allowCredit={canUseCredit}
            onCheckout={checkout}
            onAddToTab={addToTab}
            count={count}
          />
        </aside>
      </div>

      {/* Mobile cart modal */}
      <Modal
        open={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        title="Current order"
        subtitle={`${count} item${count === 1 ? '' : 's'} · ${store.name}`}
      >
        <CartPanel
          embedded
          cart={cart}
          channel={channel}
          setChannel={setChannel}
          customer={customer}
          customerId={customerId}
          balance={balance}
          onPickCustomer={() => setCustomerOpen(true)}
          onClearCustomer={() => setCustomerId(undefined)}
          onClear={() => {
            setCart([])
            setDiscount(0)
          }}
          changeQty={changeQty}
          totals={totals}
          discount={discount}
          setDiscount={setDiscount}
          canDiscount={user.permissions.discount}
          note={note}
          setNote={setNote}
          quick={quick}
          allowCredit={canUseCredit}
          onCheckout={checkout}
          onAddToTab={addToTab}
          count={count}
        />
      </Modal>

      {/* Customer picker */}
      <CustomerPicker
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        customers={customers}
        ledger={db.ledger}
        selectedId={customerId}
        onSelect={(id) => {
          setCustomerId(id)
          setCustomerOpen(false)
        }}
        allowCredit={canUseCredit}
        isAdmin={user.role === 'admin'}
      />

      {/* Payment */}
      {!quick && (
        <PaymentModal
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          total={totals.total}
          customers={customers}
          customerId={customerId}
          setCustomerId={setCustomerId}
          ledger={db.ledger}
          allowCredit={canUseCredit}
          onConfirm={completeSale}
          orderNo={null}
        />
      )}

      {/* Receipt */}
      <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}

/* ------------------------------- Cart panel -------------------------------- */

function CategoryChip({
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
          ? 'border-espresso-900 bg-espresso-900 text-cream-50'
          : 'border-line bg-white text-muted hover:border-accent-500/40 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function CartPanel({
  embedded,
  cart,
  channel,
  setChannel,
  customer,
  customerId,
  balance,
  onPickCustomer,
  onClearCustomer,
  onClear,
  changeQty,
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
  count,
}: {
  embedded?: boolean
  cart: OrderItem[]
  channel: OrderChannel
  setChannel: (c: OrderChannel) => void
  customer?: { name: string; id: string; phone: string }
  customerId?: string
  balance: number
  onPickCustomer: () => void
  onClearCustomer: () => void
  onClear: () => void
  changeQty: (id: string, delta: number) => void
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
  count: number
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', embedded && 'min-h-[50vh]')}>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-accent-600" />
          <span className="text-[13.5px] font-bold">Current order</span>
          {count > 0 && (
            <span className="rounded-full bg-cream-200 px-1.5 py-0.5 text-[10px] font-bold text-muted">
              {count}
            </span>
          )}
        </div>
        {cart.length > 0 && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="shrink-0 border-b border-line/70 px-4 py-2.5">
        <Segmented
          value={channel}
          onChange={setChannel}
          size="sm"
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'takeaway', label: 'Takeaway' },
            { value: 'dine-in', label: 'Dine-in' },
          ]}
        />
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-3 thin-scrollbar', embedded && 'max-h-[36vh]')}>
        {customer ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-accent-500/25 bg-accent-50 px-2.5 py-2">
            <Avatar name={customer.name} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-ink">{customer.name}</div>
              <div className="text-[10.5px] text-accent-700">
                Tab balance · {money(balance)}
              </div>
            </div>
            <button
              onClick={onClearCustomer}
              className="rounded-md p-1 text-accent-700/60 hover:bg-white/60 hover:text-accent-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onPickCustomer}
            className="mb-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-2.5 py-2.5 text-left transition hover:border-accent-500/50 hover:bg-white"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cream-200 text-muted">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-ink">Attach a customer</div>
              <div className="text-[10.5px] text-muted">Charge to a tab or keep as guest</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted/50" />
          </button>
        )}

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-200 text-muted/70">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <p className="text-[13px] font-semibold text-ink">Nothing here yet</p>
            <p className="mt-1 max-w-[200px] text-[11.5px] leading-relaxed text-muted">
              Tap items on the menu to build the order.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {cart.map((item) => (
              <li
                key={item.productId}
                className="group flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition hover:bg-white"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream-100 text-base">
                  {item.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-ink">{item.name}</div>
                  <div className="text-[10.5px] text-muted tabular">{money(item.price)} each</div>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-0.5">
                  <button
                    onClick={() => changeQty(item.productId, -1)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-cream-100 hover:text-ink"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-4 text-center text-[11.5px] font-bold tabular">{item.qty}</span>
                  <button
                    onClick={() => changeQty(item.productId, 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-cream-100 hover:text-ink"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="w-[62px] text-right text-[12px] font-bold tabular">
                  {money(item.price * item.qty)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-white px-4 py-3">
        <details className="group mb-2 rounded-lg">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold text-muted transition hover:text-ink">
            <span>Add note{note ? ' · added' : ''}</span>
            <ChevronRight className="h-3.5 w-3.5 transition group-open:rotate-90" />
          </summary>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. no sugar, extra shot…"
            className="mt-2 min-h-[56px] text-[12px]"
          />
        </details>

        <div className="space-y-1.5 text-[12px]">
          <Row label="Subtotal" value={money(totals.subtotal)} />
          {totals.service > 0 && (
            <Row label="Service charge" value={money(totals.service)} />
          )}
          {totals.tax > 0 && (
            <Row label="Tax (included)" value={money(totals.tax)} muted />
          )}
          {canDiscount && (
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-muted">Discount</span>
              <div className="relative w-[88px]">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={discount || ''}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  placeholder="0.000"
                  className="h-7 pr-1 text-right text-[11.5px] tabular"
                />
              </div>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-dashed border-line pt-2">
            <span className="text-[13px] font-bold text-ink">Total</span>
            <span className="text-[20px] font-extrabold tracking-tight text-ink tabular">
              {money(totals.total)}
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <Button size="lg" className="w-full" disabled={!cart.length} onClick={onCheckout}>
            {quick ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Complete order · {money(totals.total)}
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" /> Checkout · {money(totals.total)}
              </>
            )}
          </Button>
          {allowCredit && (
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              disabled={!cart.length || !customerId}
              onClick={onAddToTab}
              title={!customerId ? 'Attach a customer to use a tab' : undefined}
            >
              <UserRound className="h-4 w-4" /> Add to tab
            </Button>
          )}
          {quick && (
            <p className="text-center text-[10.5px] leading-relaxed text-muted">
              Quick mode · orders are recorded without payment handling.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-muted/70' : 'text-muted'}>{label}</span>
      <span className={cn('tabular', muted ? 'text-muted/80' : 'font-semibold text-ink')}>{value}</span>
    </div>
  )
}

/* ------------------------------ Customer picker ---------------------------- */

function CustomerPicker({
  open,
  onClose,
  customers,
  ledger,
  selectedId,
  onSelect,
  allowCredit,
  isAdmin,
}: {
  open: boolean
  onClose: () => void
  customers: Array<{ id: string; name: string; phone: string; limit: number }>
  ledger: Parameters<typeof balanceFor>[0]
  selectedId?: string
  onSelect: (id: string) => void
  allowCredit: boolean
  isAdmin: boolean
}) {
  const [query, setQuery] = useState('')
  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.includes(query.trim()),
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attach a customer"
      subtitle="Find the customer to charge or add to their tab."
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone…"
          className="pl-9"
        />
      </div>
      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto thin-scrollbar">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
            <p className="text-[13px] font-semibold text-ink">No customer found</p>
            <p className="mt-1 text-[11.5px] text-muted">
              {isAdmin
                ? 'Create the customer profile from Regulars & tabs.'
                : 'Ask your manager to create the customer profile.'}
            </p>
          </div>
        )}
        {filtered.map((c) => {
          const bal = balanceFor(ledger, c.id)
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                selectedId === c.id
                  ? 'border-accent-500/50 bg-accent-50'
                  : 'border-line bg-white hover:border-accent-500/40',
              )}
            >
              <Avatar name={c.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-ink">{c.name}</div>
                <div className="text-[11px] text-muted">{c.phone || 'No phone'}</div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    'text-[12.5px] font-bold tabular',
                    bal > 0 ? 'text-accent-700' : 'text-muted',
                  )}
                >
                  {money(bal)}
                </div>
                <div className="text-[9.5px] uppercase tracking-wide text-muted/70">tab</div>
              </div>
            </button>
          )
        })}
      </div>
      {!allowCredit && (
        <p className="mt-4 rounded-lg bg-cream-100 px-3 py-2 text-[11.5px] text-muted">
          Credit tabs are disabled for this store. The customer can still be attached to the order.
        </p>
      )}
    </Modal>
  )
}

/* ------------------------------- Payment modal ----------------------------- */

function PaymentModal({
  open,
  onClose,
  total,
  customers,
  customerId,
  setCustomerId,
  ledger,
  allowCredit,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  total: number
  customers: Array<{ id: string; name: string; phone: string; limit: number }>
  customerId?: string
  setCustomerId: (id: string | undefined) => void
  ledger: Parameters<typeof balanceFor>[0]
  allowCredit: boolean
  onConfirm: (method: PaymentMethod) => void
  orderNo: number | null
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [received, setReceived] = useState('')

  useEffect(() => {
    if (open) {
      setMethod('cash')
      setReceived('')
    }
  }, [open])

  const customer = customers.find((c) => c.id === customerId)
  const balance = customerId ? balanceFor(ledger, customerId) : 0
  const receivedNum = Number(received) || 0
  const change = receivedNum - total
  const cashOk = receivedNum >= total - 0.0001
  const creditBlocked = method === 'credit' && !customerId
  const overLimit = customer && balance + total > customer.limit

  const quickAmounts = useMemo(() => {
    const opts = new Set<number>()
    opts.add(Math.ceil(total))
    ;[5, 10, 20, 50].forEach((v) => {
      if (v >= total) opts.add(v)
    })
    return Array.from(opts).sort((a, b) => a - b).slice(0, 5)
  }, [total])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Take payment"
      subtitle="Choose how the customer is paying."
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11.5px] text-muted">
            {method === 'cash' && !cashOk && receivedNum > 0
              ? `Short by ${money(total - receivedNum)}`
              : method === 'credit' && customer
                ? `New tab balance · ${money(balance + total)}`
                : 'Amount due'}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Back
            </Button>
            <Button
              size="md"
              disabled={(method === 'cash' && !cashOk) || creditBlocked}
              onClick={() => onConfirm(method)}
            >
              <CheckCircle2 className="h-4 w-4" /> Complete · {money(total)}
            </Button>
          </div>
        </div>
      }
    >
      <div className="rounded-2xl bg-espresso-900 px-5 py-4 text-cream-50">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">
          Amount due
        </div>
        <div className="mt-1 text-[30px] font-extrabold tracking-tight tabular">{money(total)}</div>
      </div>

      <div className="mt-4">
        <Segmented
          value={method}
          onChange={setMethod}
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card' },
            { value: 'credit', label: allowCredit ? 'On tab' : 'Tab off' },
          ]}
        />
      </div>

      {method === 'cash' && (
        <div className="mt-4">
          <Field label="Cash received" hint="Tap a note or type an amount">
            <Input
              type="number"
              inputMode="decimal"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              placeholder={total.toFixed(3)}
              className="h-12 text-lg font-bold tabular"
              autoFocus
            />
          </Field>
          <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {quickAmounts.map((v) => (
              <button
                key={v}
                onClick={() => setReceived(String(v))}
                className="h-9 rounded-lg border border-line bg-white text-[12px] font-semibold tabular transition hover:border-accent-500/50 hover:bg-cream-100"
              >
                {v === Math.ceil(total) ? 'Exact' : v}
              </button>
            ))}
          </div>
          <div
            className={cn(
              'mt-3 flex items-center justify-between rounded-xl px-3.5 py-3',
              change >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-cream-100 text-muted',
            )}
          >
            <span className="text-[12px] font-semibold">Change due</span>
            <span className="text-[18px] font-extrabold tabular">
              {change >= 0 ? money(change) : '—'}
            </span>
          </div>
        </div>
      )}

      {method === 'card' && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-cream-50 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-accent-600 ring-1 ring-line">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-ink">Card / bank payment</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
              Confirm once the terminal or bank transfer has gone through. No card integration is
              connected — the payment is recorded manually.
            </p>
          </div>
        </div>
      )}

      {method === 'credit' && (
        <div className="mt-4 space-y-3">
          <Field label="Customer">
            <Select
              value={customerId ?? ''}
              onChange={(e) => setCustomerId(e.target.value || undefined)}
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {money(balanceFor(ledger, c.id))} outstanding
                </option>
              ))}
            </Select>
          </Field>
          {customer ? (
            <div className="rounded-xl border border-line bg-white p-3.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted">Current balance</span>
                <span className="font-semibold tabular">{money(balance)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px]">
                <span className="text-muted">This order</span>
                <span className="font-semibold tabular">+ {money(total)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-dashed border-line pt-2 text-[13px]">
                <span className="font-bold">New balance</span>
                <span className="font-extrabold text-accent-700 tabular">
                  {money(balance + total)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted">
                <span>Credit limit</span>
                <span className="tabular">{money(customer.limit)}</span>
              </div>
              {overLimit && (
                <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-800">
                  This exceeds the customer&apos;s credit limit by {money(balance + total - customer.limit)}.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-4 text-center text-[11.5px] text-muted">
              {customers.length
                ? 'Select a customer to continue.'
                : 'No customers yet. Ask your manager to create one.'}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 rounded-lg px-1 text-[10.5px] text-muted">
        <Banknote className="h-3.5 w-3.5" />
        Payment is recorded instantly and appears in today&apos;s reports.
      </div>
    </Modal>
  )
}

/* ------------------------------- Receipt modal ----------------------------- */

function ReceiptModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { store } = useApp()
  if (!order || !store) return null

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title="Sale completed"
      subtitle={`Order #${order.number} · ${fmtTime(order.createdAt)}`}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            New sale
          </Button>
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print receipt
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 text-[12.5px] font-semibold text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        {order.paymentMethod === 'credit'
          ? `Charged to ${'customer' in order ? 'customer tab' : 'tab'}`
          : order.paymentMethod === 'cash'
            ? 'Paid in cash'
            : 'Paid by card'}
      </div>

      <div className="receipt-print">
        <ReceiptView order={order} store={store} />
      </div>
    </Modal>
  )
}

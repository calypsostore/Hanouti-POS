import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { Customer, SettlementCycle } from '../../../types'
import { useApp } from '../../../store/AppStore'
import { useToast } from '../../../components/toast'
import { balanceFor, customerActivity } from '../../../lib/selectors'
import { dateKey, money } from '../../../lib/utils'
import {
  canManageCustomerProfiles,
  canSettleCustomerTabs,
  canViewCustomerTabs,
} from '../../../lib/customerTabs'
import CustomerList from './components/CustomerList'
import CustomerDetailsDrawer from './components/CustomerDetailsDrawer'
import CustomerEditor from './components/CustomerEditor'
import SettleModal from './components/SettleModal'
import DeleteCustomerModal from './components/DeleteCustomerModal'

export default function CustomersPage() {
  const { db, store, user, addCustomer, updateCustomer, deleteCustomer, settleCredit } = useApp()
  const { push } = useToast()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'all' | 'open' | 'settled'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ open: boolean; customer?: Customer }>({ open: false })
  const [settleCustomerId, setSettleCustomerId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [detailTab, setDetailTab] = useState<'ledger' | 'orders'>('ledger')

  if (!store || !user) return null

  const canManageCustomers = canManageCustomerProfiles(store, user)
  const canSettle = canSettleCustomerTabs(store, user)
  if (!canViewCustomerTabs(store, user)) return <Navigate to={user.role === 'manager' ? '/pos' : '/admin'} replace />
  const customers = db.customers.filter((customer) => customer.storeId === store.id)
  const selected = customers.find((customer) => customer.id === selectedId) ?? null
  const settleTarget = customers.find((customer) => customer.id === settleCustomerId) ?? null
  const balance = selected ? balanceFor(db.ledger, selected.id) : 0
  const settleBalance = settleTarget ? balanceFor(db.ledger, settleTarget.id) : 0
  const activity = selected ? customerActivity(db.ledger, selected.id) : []
  const orders = selected
    ? db.orders
        .filter((order) => order.customerId === selected.id && order.storeId === store.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    : []
  const filtered = customers
    .filter((customer) => {
      const matchesQuery =
        customer.name.toLowerCase().includes(query.toLowerCase()) ||
        customer.phone.includes(query.trim())
      const customerBalance = balanceFor(db.ledger, customer.id)
      const matchesView =
        view === 'all' || (view === 'open' ? customerBalance > 0 : customerBalance <= 0)
      return matchesQuery && matchesView
    })
    .sort((a, b) => balanceFor(db.ledger, b.id) - balanceFor(db.ledger, a.id))

  const totalOutstanding = customers.reduce(
    (total, customer) => total + Math.max(0, balanceFor(db.ledger, customer.id)),
    0,
  )
  const debtors = customers.filter((customer) => balanceFor(db.ledger, customer.id) > 0).length
  const monthPrefix = dateKey(new Date()).slice(0, 7)
  const collectedThisMonth = db.ledger
    .filter(
      (entry) =>
        entry.storeId === store.id &&
        entry.type === 'payment' &&
        !entry.creditAdjustment &&
        dateKey(entry.createdAt).startsWith(monthPrefix),
    )
    .reduce((total, entry) => total + entry.amount, 0)

  const startOrder = (customerId: string) => navigate(`/pos?customer=${customerId}`)

  const saveCustomer = (data: {
    name: string
    phone: string
    limit: number
    notes: string
    cycle: SettlementCycle
  }) => {
    const result = editor.customer
      ? updateCustomer(editor.customer.id, data)
      : addCustomer(store.id, data)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(editor.customer ? 'Customer profile updated' : 'Customer created')
    setEditor({ open: false })
  }

  const settleCustomer = (
    amount: number,
    method: 'cash' | 'card',
    note: string,
  ) => {
    if (!settleTarget) return
    const result = settleCredit(settleTarget.id, amount, method, note)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push(`${money(amount)} received from ${settleTarget.name}`)
    setSettleCustomerId(null)
  }

  const removeCustomer = () => {
    if (!deleteTarget) return
    const result = deleteCustomer(deleteTarget.id)
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    push('Customer removed', 'info')
    setDeleteTarget(null)
    setSelectedId(null)
  }

  return (
    <div className="space-y-5">
      <CustomerList
        customers={customers}
        filtered={filtered}
        ledger={db.ledger}
        totalOutstanding={totalOutstanding}
        debtors={debtors}
        collectedThisMonth={collectedThisMonth}
        query={query}
        onQueryChange={setQuery}
        view={view}
        onViewChange={setView}
        canManageCustomers={canManageCustomers}
        canSettle={canSettle}
        onAdd={() => setEditor({ open: true })}
        onSelect={(customer) => {
          setSelectedId(customer.id)
          setDetailTab('ledger')
        }}
        onStartOrder={startOrder}
        onSettle={setSettleCustomerId}
        onEdit={(customer) => setEditor({ open: true, customer })}
      />

      <CustomerDetailsDrawer
        customer={selected}
        balance={balance}
        activity={activity}
        orders={orders}
        detailTab={detailTab}
        onDetailTabChange={setDetailTab}
        canManageCustomers={canManageCustomers}
        canSettle={canSettle}
        onClose={() => setSelectedId(null)}
        onEdit={() => selected && setEditor({ open: true, customer: selected })}
        onDelete={() => selected && setDeleteTarget(selected)}
        onStartOrder={startOrder}
        onSettle={setSettleCustomerId}
      />

      <CustomerEditor
        open={editor.open}
        customer={editor.customer}
        onClose={() => setEditor({ open: false })}
        onSave={saveCustomer}
      />

      {settleTarget && (
        <SettleModal
          key={settleTarget.id}
          open
          onClose={() => setSettleCustomerId(null)}
          customer={settleTarget}
          balance={settleBalance}
          onSettle={settleCustomer}
        />
      )}

      <DeleteCustomerModal
        customer={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeCustomer}
      />
    </div>
  )
}

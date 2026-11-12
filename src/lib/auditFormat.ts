import type { AuditJsonValue, AuditLog, Database } from '../types'
import { fmtDate, money } from './utils'

export type AuditIdLabels = ReadonlyMap<string, string>

export type AuditChangeRow = {
  field: string
  before: string
  after: string
}

const FIELD_LABELS: Record<string, string> = {
  active: 'Active',
  amount: 'Amount',
  categoryId: 'Category',
  clockIn: 'Clock in',
  clockOut: 'Clock out',
  createdBy: 'Created by',
  createdAt: 'Created at',
  customerId: 'Customer',
  date: 'Date',
  endTime: 'End time',
  hours: 'Hours',
  month: 'Month',
  name: 'Name',
  note: 'Note',
  paidBy: 'Paid by',
  payrollId: 'Payroll',
  price: 'Price',
  productId: 'Product',
  permissions: 'Permissions',
  registerSessionId: 'Register session',
  salaryAmount: 'Salary amount',
  salaryType: 'Salary type',
  startTime: 'Start time',
  status: 'Status',
  stock: 'Stock',
  source: 'Source',
  tableId: 'Table',
  tableName: 'Table name',
  guests: 'Guests',
  storeId: 'Store',
  staffId: 'Staff member',
  userId: 'Staff member',
  username: 'Username',
}

const isMoneyField = (field: string) =>
  /(amount|price|cost|earned|paid|advance|salary|balance|total|tax|discount|cash|revenue|net)/i.test(field)

const formatDateValue = (value: string) => {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return value.includes('T')
    ? parsed.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : fmtDate(`${value}T12:00:00`)
}

export function auditFieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase())
}

export function createAuditIdLabels(db: Database): Map<string, string> {
  const labels = new Map<string, string>()
  const add = (items: Array<{ id: string; label: string }>) =>
    items.forEach((item) => labels.set(item.id, item.label))
  add(db.stores.map((item) => ({ id: item.id, label: item.name })))
  add(db.users.map((item) => ({ id: item.id, label: item.name })))
  add(db.categories.map((item) => ({ id: item.id, label: item.name })))
  add(db.products.map((item) => ({ id: item.id, label: item.name })))
  add(db.customers.map((item) => ({ id: item.id, label: item.name })))
  add(db.orders.map((item) => ({ id: item.id, label: `Order #${item.number}` })))
  add(db.attendance.map((item) => ({ id: item.id, label: `Attendance · ${item.date}` })))
  add(db.shifts.map((item) => ({ id: item.id, label: `Shift · ${item.date}` })))
  add(db.advances.map((item) => ({ id: item.id, label: `Advance · ${item.date.slice(0, 10)}` })))
  add(db.payrolls.map((item) => ({ id: item.id, label: `Payroll · ${item.month}` })))
  add(db.expenses.map((item) => ({ id: item.id, label: `${item.category} expense` })))
  add(db.registerSessions.map((item) => ({ id: item.id, label: 'Register session' })))
  return labels
}

export function formatAuditValue(
  value: AuditJsonValue | undefined,
  field = '',
  depth = 0,
  idLabels?: AuditIdLabels,
): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    if (isMoneyField(field)) return money(value)
    return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 }).format(value)
  }
  if (typeof value === 'string') {
    if (/(?:Id|By)$/.test(field)) return idLabels?.get(value) ?? 'Unknown record'
    if (/^\d{4}-\d{2}$/.test(value)) {
      return new Date(`${value}-01T12:00:00`).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      })
    }
    if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return formatDateValue(value)
    return value.trim() || '—'
  }
  if (depth >= 2) return Array.isArray(value) ? `${value.length} items` : 'Details'
  if (Array.isArray(value)) {
    const items = value.slice(0, 4).map((item) => formatAuditValue(item, field, depth + 1, idLabels))
    return `${items.join(', ')}${value.length > 4 ? `, +${value.length - 4} more` : ''}` || '—'
  }
  const entries = Object.entries(value).slice(0, 4)
  const formatted = entries.map(([key, item]) =>
    `${auditFieldLabel(key)}: ${formatAuditValue(item, key, depth + 1, idLabels)}`,
  )
  return `${formatted.join(' · ')}${Object.keys(value).length > 4 ? ' · …' : ''}` || '—'
}

export function getAuditChanges(log: AuditLog, idLabels?: AuditIdLabels): AuditChangeRow[] {
  const before = log.before ?? {}
  const after = log.after ?? {}
  const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
  return fields.map((field) => ({
    field: auditFieldLabel(field),
    before: formatAuditValue(before[field], field, 0, idLabels),
    after: formatAuditValue(after[field], field, 0, idLabels),
  })).filter((change) => change.before !== change.after)
}

export function formatAuditDateTime(value: string) {
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : value
}

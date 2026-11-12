import type { AuditAction, AuditEntity } from '../../../types'

export const AUDIT_ENTITIES: AuditEntity[] = [
  'order', 'product', 'category', 'customer', 'staff', 'expense',
  'register', 'settings', 'auth', 'payroll', 'shift', 'table',
]

export const auditEntityLabel = (entity: AuditEntity) =>
  entity === 'auth' ? 'Authentication' : entity.charAt(0).toUpperCase() + entity.slice(1)

export const auditActionLabel = (action: AuditAction) => action.replace(/_/g, ' ')

export const auditActionTone = (action: AuditAction): 'success' | 'danger' | 'warning' | 'info' => {
  if (['created', 'login_success', 'register_opened', 'activated'].includes(action)) return 'success'
  if (['deleted', 'voided', 'refund_applied', 'login_failure', 'deactivated'].includes(action)) return 'danger'
  if (['discount_applied', 'debt_payment', 'register_closed', 'pin_reset'].includes(action)) return 'warning'
  return 'info'
}

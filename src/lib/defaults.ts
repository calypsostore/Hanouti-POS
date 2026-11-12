import type { PrinterSettings, Role, User } from '../types'

export const DEFAULT_PRINTER: PrinterSettings = {
  enabled: true,
  width: 80,
  mode: 'manual',
  connection: 'webserial',
  baudRate: 9600,
  kitchenTicket: false,
}

export const defaultPermissions = (role: Role): User['permissions'] => ({
  discount: role !== 'staff',
  credit: true,
  settle: role !== 'staff',
  reports: role !== 'staff',
  register: role !== 'staff',
})

/** Fill in fields that were added after a database version was released. */
export const normalizeUser = (u: User): User => {
  const base = defaultPermissions(u.role)
  const p = u.permissions ?? base
  return {
    ...u,
    permissions: {
      discount: p.discount ?? base.discount,
      credit: p.credit ?? base.credit,
      settle: p.settle ?? base.settle,
      reports: p.reports ?? base.reports,
      register: p.register ?? base.register,
    },
  }
}

export const normalizePrinter = (p?: Partial<PrinterSettings>): PrinterSettings => ({
  ...DEFAULT_PRINTER,
  ...p,
  width: p?.width === 58 ? 58 : 80,
  mode: p?.mode === 'auto' ? 'auto' : 'manual',
  connection: p?.connection === 'browser' ? 'browser' : 'webserial',
})

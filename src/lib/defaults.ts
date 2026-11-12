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
  supervisor: role !== 'staff',
})

/** Fill in fields that were added after a database version was released. */
export const normalizeUser = (u: User): User => {
  const base = defaultPermissions(u.role)
  const p = u.permissions ?? base
  return {
    ...u,
    photo: typeof u.photo === 'string' && u.photo.startsWith('data:image/') && u.photo.length <= 307200
      ? u.photo
      : undefined,
    permissions: {
      discount: typeof p.discount === 'boolean' ? p.discount : base.discount,
      credit: typeof p.credit === 'boolean' ? p.credit : base.credit,
      settle: typeof p.settle === 'boolean' ? p.settle : base.settle,
      reports: typeof p.reports === 'boolean' ? p.reports : base.reports,
      register: typeof p.register === 'boolean' ? p.register : base.register,
      supervisor: typeof p.supervisor === 'boolean' ? p.supervisor : base.supervisor,
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

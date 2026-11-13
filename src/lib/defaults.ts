import type { Capability, PayrollSettings, PrinterSettings, Role, User } from '../types'
import { MANAGER_DEFAULT_PERMISSIONS } from './permissions'
import { round } from './pricing-utils'
import { isValidUsername, normalizeUsername } from './staff'

export const DEFAULT_PRINTER: PrinterSettings = {
  enabled: true,
  width: 80,
  mode: 'manual',
  connection: 'webserial',
  baudRate: 9600,
  kitchenTicket: false,
}

export const DEFAULT_PAYROLL_SETTINGS = {
  workingDaysPerMonth: 26,
  fullDayHours: 6,
  halfDayHours: 3,
  autoCloseHours: 14,
}

export const normalizePayrollSettings = (value?: Partial<PayrollSettings>): PayrollSettings => {
  const workingDaysPerMonth = value?.workingDaysPerMonth
  const fullDayHours = value?.fullDayHours
  const halfDayHours = value?.halfDayHours
  const autoCloseHours = value?.autoCloseHours
  const validNumber = (n: unknown, min: number, max: number): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max
  const normalizedFullDay = validNumber(fullDayHours, 0.25, 24)
    ? fullDayHours
    : DEFAULT_PAYROLL_SETTINGS.fullDayHours
  const normalizedHalfDay = validNumber(halfDayHours, 0.25, normalizedFullDay)
    ? halfDayHours
    : Math.min(DEFAULT_PAYROLL_SETTINGS.halfDayHours, normalizedFullDay)
  return {
    workingDaysPerMonth: validNumber(workingDaysPerMonth, 1, 31)
      ? workingDaysPerMonth
      : DEFAULT_PAYROLL_SETTINGS.workingDaysPerMonth,
    fullDayHours: normalizedFullDay,
    halfDayHours: normalizedHalfDay,
    autoCloseHours: validNumber(autoCloseHours, 0.25, 168)
      ? autoCloseHours
      : DEFAULT_PAYROLL_SETTINGS.autoCloseHours,
  }
}

export const defaultPermissions = (role: Role): User['permissions'] => ({
  discount: role !== 'staff',
  credit: true,
  settle: role !== 'staff',
  reports: role !== 'staff',
  register: role !== 'staff',
  supervisor: role !== 'staff',
  ...(role === 'manager' ? MANAGER_DEFAULT_PERMISSIONS : {}),
})

/** Fill in fields that were added after a database version was released. */
export const normalizeUser = (u: User): User => {
  const base = defaultPermissions(u.role)
  const p = u.permissions ?? base
  const capability = (name: Capability) => name === 'recordPurchases'
    ? p[name] === true
    : u.role === 'manager'
      ? typeof p[name] === 'boolean' ? p[name] : MANAGER_DEFAULT_PERMISSIONS[name]
      : false
  const enteredUsername = typeof u.username === 'string' ? normalizeUsername(u.username) : ''
  const emailName = u.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '-') ?? ''
  const fallbackName = `user-${u.id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 19)}`
  const username = isValidUsername(enteredUsername)
    ? enteredUsername
    : isValidUsername(emailName.slice(0, 24))
      ? emailName.slice(0, 24)
      : fallbackName
  return {
    ...u,
    email: u.role === 'staff' || u.role === 'manager' ? '' : u.email ?? '',
    username,
    salaryType: u.salaryType === 'daily' || u.salaryType === 'monthly' ? u.salaryType : 'none',
    salaryAmount: typeof u.salaryAmount === 'number' && Number.isFinite(u.salaryAmount)
      ? round(Math.max(0, u.salaryAmount))
      : 0,
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
      manageInventory: capability('manageInventory'),
      recordPurchases: capability('recordPurchases'),
      viewCosts: capability('viewCosts'),
      manageStaffAllowances: capability('manageStaffAllowances'),
      approveOverrides: capability('approveOverrides'),
      viewReports: capability('viewReports'),
      manageProducts: capability('manageProducts'),
      voidOrders: capability('voidOrders'),
      manageStaff: capability('manageStaff'),
      manageSettings: capability('manageSettings'),
      managePayroll: capability('managePayroll'),
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

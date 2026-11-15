import { Toggle } from '../../../components/ui'
import type { Capability, User } from '../../../types'

const managerCapabilities: Array<{ key: Capability; label: string; description: string }> = [
  { key: 'manageInventory', label: 'Manage inventory', description: 'Edit items, counts, waste, and stock adjustments.' },
  { key: 'recordPurchases', label: 'Record purchases', description: 'Manage suppliers, receive stock, and record supplier payments.' },
  { key: 'viewCosts', label: 'View costs', description: 'See unit costs, margins, and cost-based reports.' },
  { key: 'manageStaffAllowances', label: 'Manage staff allowances', description: 'Record and review staff consumption allowances.' },
  { key: 'approveOverrides', label: 'Approve overrides', description: 'Authorize manager-PIN protected actions.' },
  { key: 'viewReports', label: 'Open reports and activity log', description: 'Access store reports, dashboard, and audit history.' },
  { key: 'manageProducts', label: 'Manage products', description: 'Create and edit products and categories.' },
  { key: 'voidOrders', label: 'Void orders', description: 'Approve order voids with a manager PIN.' },
  { key: 'manageStaff', label: 'Manage staff', description: 'Edit staff access, details, and permissions.' },
  { key: 'manageSettings', label: 'Manage store settings', description: 'Edit store settings and dining tables.' },
  { key: 'viewStation', label: 'View station screens', description: 'Access kitchen and bar station boards after PIN sign-in.' },
  { key: 'managePayroll', label: 'Manage payroll', description: 'Edit attendance, advances, and payroll.' },
  { key: 'openShift', label: 'Open shifts', description: 'Start a personal cash-register shift.' },
  { key: 'closeShift', label: 'Close shifts', description: 'Close personal shifts and print Z reports.' },
]

export default function StaffPermissionsEditor({
  role,
  permissions,
  onChange,
}: {
  role: 'staff' | 'manager'
  permissions: User['permissions']
  onChange: (permissions: User['permissions']) => void
}) {
  const toggle = (key: keyof User['permissions'], enabled: boolean) =>
    onChange({ ...permissions, [key]: enabled })

  return (
    <div className="rounded-xl border border-line bg-white p-3.5">
      <div className="mb-2 text-[12.5px] font-semibold text-ink">
        {role === 'manager' ? 'Manager capabilities' : 'Staff permissions'}
      </div>
      <div className="space-y-3">
        <Toggle checked={permissions.discount} onChange={(value) => toggle('discount', value)} label="Apply discounts" description="Can reduce the total at checkout." />
        <Toggle checked={permissions.credit} onChange={(value) => toggle('credit', value)} label="Charge orders to tabs" description="Can attach an order to a customer account." />
        <Toggle checked={permissions.settle} onChange={(value) => toggle('settle', value)} label="Take customer payments" description="Can settle tab balances." />
        <Toggle checked={permissions.reports} onChange={(value) => toggle('reports', value)} label="Show financial summaries" description="Displays financial totals; it does not grant access to the Reports page." />
        <Toggle checked={permissions.register} onChange={(value) => toggle('register', value)} label="Open and close the register" description="Can open sessions, print X reports, and close with a Z report." />
        {role === 'staff' && (
          <>
            <Toggle checked={permissions.openShift === true} onChange={(value) => toggle('openShift', value)} label="Open own shift" description="Start a personal shift before taking orders." />
            <Toggle checked={permissions.closeShift === true} onChange={(value) => toggle('closeShift', value)} label="Close own shift" description="Close personal shifts and print a Z report." />
          </>
        )}
        <Toggle checked={permissions.supervisor} onChange={(value) => toggle('supervisor', value)} label="Shift supervisor" description="Can view team sales and register sessions and close another user's session." />
        {role === 'staff' && (
          <Toggle checked={permissions.viewStation === true} onChange={(value) => toggle('viewStation', value)} label="View station screens" description="Access kitchen and bar station boards after PIN sign-in." />
        )}
        {role === 'staff' && (
          <Toggle
            checked={permissions.recordPurchases === true}
            onChange={(value) => toggle('recordPurchases', value)}
            label="Record purchases"
            description="Manage suppliers, receive stock, and record supplier payments."
          />
        )}
        {role === 'manager' && managerCapabilities.map(({ key, label, description }) => (
          <Toggle
            key={key}
            checked={permissions[key] === true}
            onChange={(value) => toggle(key, value)}
            label={label}
            description={description}
          />
        ))}
      </div>
    </div>
  )
}

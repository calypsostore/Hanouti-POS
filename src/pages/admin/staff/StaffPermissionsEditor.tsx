import { Toggle } from '../../../components/ui'
import type { Capability, User } from '../../../types'
import { isQuickStaffPermissionVisible } from '../../../lib/staffPermissionVisibility'

const managerCapabilities: Array<{ key: Capability; label: string; description: string }> = [
  { key: 'manageInventory', label: 'Manage inventory', description: 'Edit items, counts, waste, and stock adjustments.' },
  { key: 'recordPurchases', label: 'Record purchases', description: 'Manage suppliers, receive stock, and record supplier payments.' },
  { key: 'viewCosts', label: 'View costs', description: 'See unit costs, margins, and cost-based reports.' },
  { key: 'manageStaffAllowances', label: 'Manage staff allowances', description: 'Record and review staff consumption allowances.' },
  { key: 'useStaffAllowances', label: 'Use staff items', description: 'Record allowed staff items during an open shift.' },
  { key: 'approveOverrides', label: 'Approve overrides', description: 'Authorize manager-PIN protected actions.' },
  { key: 'viewOrders', label: 'View orders', description: 'Open the Orders page and review order history.' },
  { key: 'viewReports', label: 'Open reports and activity log', description: 'Access store reports, dashboard, and audit history.' },
  { key: 'viewExpenses', label: 'View expenses', description: 'Open Quick-mode expenses and view expense descriptions.' },
  { key: 'addExpenses', label: 'Add expenses', description: 'Record new Quick-mode expenses and view their amounts.' },
  { key: 'editExpenses', label: 'Edit expenses', description: 'Edit or delete Quick-mode expenses and view their amounts.' },
  { key: 'manageProducts', label: 'Manage products', description: 'Create and edit products and categories.' },
  { key: 'voidOrders', label: 'Void orders', description: 'Approve order voids with a manager PIN.' },
  { key: 'manageStaff', label: 'Manage staff', description: 'Edit staff access, details, and permissions.' },
  { key: 'manageSettings', label: 'Manage store settings', description: 'Edit store settings and dining tables.' },
  { key: 'viewStation', label: 'View station screens', description: 'Access kitchen and bar station boards after PIN sign-in.' },
  { key: 'managePayroll', label: 'Manage payroll', description: 'Edit attendance, advances, and payroll.' },
  { key: 'openShift', label: 'Open shifts', description: 'Start a personal cash-register shift.' },
  { key: 'closeShift', label: 'Close shifts', description: 'Close personal shifts and print frozen X reports. Store-day Z close remains owner-only.' },
  { key: 'takeOverTables', label: 'Take over tables', description: 'Accept unassigned tables from a staff handover.' },
  { key: 'forceCloseShift', label: 'Force-close shifts', description: 'Close another staff shift after entering a reason.' },
  { key: 'manageCashDifferences', label: 'Manage cash differences', description: 'Settle, void, and archive shift cash differences.' },
  { key: 'viewStaffAnalytics', label: 'View staff analytics', description: 'View staff performance and cash accuracy metrics.' },
  { key: 'manage86', label: 'Manage 86 availability', description: '86 and return menu items from POS.' },
  { key: 'overrideStock', label: 'Override stock warnings', description: 'Confirm warned over-stock sales when allowed by Order rules settings.' },
  { key: 'manageCustomers', label: 'Manage customer profiles', description: 'Create, edit, and remove customer profiles.' },
  { key: 'viewTabs', label: 'View customer tabs', description: 'Open regular customer profiles and review tab activity.' },
  { key: 'settleTabs', label: 'Settle customer tabs', description: 'Record customer payments with staff attribution.' },
  { key: 'addToTabs', label: 'Add orders to tabs', description: 'Charge new orders to an existing customer tab within the assigned limit.' },
]

export default function StaffPermissionsEditor({
  role,
  stationOnly = false,
  quick = false,
  stationsEnabled,
  permissions,
  onChange,
}: {
  role: 'staff' | 'manager'
  stationOnly?: boolean
  quick?: boolean
  stationsEnabled: boolean
  permissions: User['permissions']
  onChange: (permissions: User['permissions']) => void
}) {
  const toggle = (key: keyof User['permissions'], enabled: boolean) =>
    onChange({ ...permissions, [key]: enabled })

  return (
    <div className="rounded-xl border border-line bg-white p-3.5">
      <div className="mb-2 text-[12.5px] font-semibold text-ink">
        {stationOnly ? 'Cook / Barista permissions' : role === 'manager' ? 'Manager capabilities' : 'Staff permissions'}
      </div>
      {stationOnly ? (
        <p className="text-xs leading-relaxed text-muted">
          This account can open its assigned station screen and move tickets through Preparing, Ready, and Served.
          It cannot access POS, sales, management, or register actions.
        </p>
      ) : (
      <div className="space-y-3">
        {!quick && <Toggle checked={permissions.discount} onChange={(value) => toggle('discount', value)} label="Apply discounts" description="Can reduce the total at checkout." />}
        {!quick && (
          <>
            <Toggle checked={permissions.credit} onChange={(value) => toggle('credit', value)} label="Charge orders to tabs" description="Can attach an order to a customer account." />
            <Toggle checked={permissions.settle} onChange={(value) => toggle('settle', value)} label="Take customer payments" description="Can settle tab balances." />
          </>
        )}
        {quick && (
          <>
            <Toggle checked={permissions.viewOrders === true} onChange={(value) => toggle('viewOrders', value)} label="View orders" description="Open the Orders page and review your order history." />
            <Toggle checked={permissions.viewExpenses === true} onChange={(value) => toggle('viewExpenses', value)} label="View expenses" description="Open expenses and view descriptions; amounts stay hidden without add or edit access." />
            <Toggle checked={permissions.addExpenses === true} onChange={(value) => toggle('addExpenses', value)} label="Add expenses" description="Record new expenses and view expense amounts." />
            <Toggle checked={permissions.editExpenses === true} onChange={(value) => toggle('editExpenses', value)} label="Edit expenses" description="Edit or delete expenses and view expense amounts." />
            <Toggle checked={permissions.manageCustomers === true} onChange={(value) => toggle('manageCustomers', value)} label="Manage customer profiles" description="Create, edit, and remove customer profiles." />
            <Toggle checked={permissions.viewTabs === true} onChange={(value) => toggle('viewTabs', value)} label="View customer tabs" description="Open regular customer profiles and review tab activity." />
            <Toggle checked={permissions.settleTabs === true} onChange={(value) => toggle('settleTabs', value)} label="Settle customer tabs" description="Record customer payments with staff attribution." />
            <Toggle checked={permissions.addToTabs === true} onChange={(value) => toggle('addToTabs', value)} label="Add orders to tabs" description="Charge orders to existing tabs within the assigned limit." />
          </>
        )}
        <Toggle checked={permissions.reports} onChange={(value) => toggle('reports', value)} label="Show financial summaries" description="Displays financial totals; it does not grant access to the Reports page." />
        <Toggle checked={permissions.register} onChange={(value) => toggle('register', value)} label="Use the register" description="Can open shifts, print X reports, and close personal shifts. Only the owner closes the store-day Z." />
        {role === 'staff' && (
          <>
            <Toggle checked={permissions.useStaffAllowances === true} onChange={(value) => toggle('useStaffAllowances', value)} label="Use staff items" description="Record allowed staff items during an open shift." />
            <Toggle checked={permissions.openShift === true} onChange={(value) => toggle('openShift', value)} label="Open own shift" description="Start a personal shift before taking orders." />
            <Toggle checked={permissions.closeShift === true} onChange={(value) => toggle('closeShift', value)} label="Close own shift" description="End a personal shift and save its X report; the owner closes the store-day Z." />
            {!quick && <Toggle checked={permissions.takeOverTables === true} onChange={(value) => toggle('takeOverTables', value)} label="Take over tables" description="Accept unassigned tables from a staff handover." />}
          </>
        )}
        <Toggle checked={permissions.supervisor} onChange={(value) => toggle('supervisor', value)} label="Shift supervisor" description="Can view team sales and register sessions and close another user's session." />
        {role === 'staff' && (!quick || stationsEnabled) && (
          <Toggle checked={permissions.viewStation === true} onChange={(value) => toggle('viewStation', value)} label="View station screens" description="Access kitchen and bar station boards after PIN sign-in." />
        )}
        {role === 'staff' && !quick && (
          <Toggle
            checked={permissions.recordPurchases === true}
            onChange={(value) => toggle('recordPurchases', value)}
            label="Record purchases"
            description="Manage suppliers, receive stock, and record supplier payments."
          />
        )}
        {role === 'staff' && (
          <Toggle checked={permissions.manage86 === true} onChange={(value) => toggle('manage86', value)} label="Manage 86 availability" description="86 and return menu items from POS." />
        )}
        {role === 'staff' && (
          <Toggle
            checked={permissions.overrideStock === true}
            onChange={(value) => toggle('overrideStock', value)}
            label="Override stock warnings"
            description="Confirm over-stock sales when allowed by Order rules settings."
          />
        )}
        {role === 'manager' && managerCapabilities
          .filter(({ key }) => quick
            ? isQuickStaffPermissionVisible(key, stationsEnabled)
            : !['manageCustomers', 'viewTabs', 'settleTabs', 'addToTabs', 'viewOrders', 'viewExpenses', 'addExpenses', 'editExpenses'].includes(key))
          .map(({ key, label, description }) => (
          <Toggle
            key={key}
            checked={permissions[key] === true}
            onChange={(value) => toggle(key, value)}
            label={label}
            description={description}
          />
        ))}
      </div>
      )}
    </div>
  )
}

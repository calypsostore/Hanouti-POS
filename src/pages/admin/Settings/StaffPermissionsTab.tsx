import { useApp } from '../../../store/AppStore'
import { Card } from '../../../components/ui'
import StaffPermissionsEditor from '../staff/StaffPermissionsEditor'
import { useToast } from '../../../components/toast'
import type { User } from '../../../types'
import { isQuick } from '../../../lib/posMode'

export function StaffPermissionsTab() {
  const { db, store, updateStaff } = useApp()
  const { push } = useToast()
  if (!store) return null
  const members = db.users.filter((member): member is User & { role: 'manager' | 'staff' } =>
    member.storeId === store.id && (member.role === 'manager' || member.role === 'staff'),
  )

  const savePermissions = async (memberId: string, permissions: User['permissions']) => {
    try {
      const result = await updateStaff(memberId, { permissions })
      if (!result.ok) {
        push(result.error, 'error')
        return
      }
      push('Staff permissions saved', 'success')
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not save staff permissions.', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted">Configure the actions each manager and staff member can use.</p>
      {members.map((member) => (
        <Card key={member.id} className="p-4">
          <h3 className="mb-3 text-sm font-bold">{member.name} <span className="font-normal capitalize text-muted">· {member.role}</span></h3>
          <StaffPermissionsEditor
            role={member.role}
            stationOnly={member.stationOnly}
            quick={isQuick(store)}
            permissions={member.permissions}
            onChange={(permissions) => { void savePermissions(member.id, permissions) }}
          />
        </Card>
      ))}
      {!members.length && <Card className="p-5 text-center text-xs text-muted">No team members to configure.</Card>}
    </div>
  )
}

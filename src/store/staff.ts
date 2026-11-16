import { useCallback } from 'react'
import type { AuditJsonValue, User } from '../types'
import { uid } from '../lib/utils'
import { hashRandomSecret, hashSecret } from '../lib/hash'
import { isValidUsername, normalizeUsername } from '../lib/staff'
import { round } from '../lib/pricing-utils'
import { defaultPermissions } from '../lib/defaults'
import type { Capability } from '../types'

const CAPABILITIES: Capability[] = [
  'manageInventory', 'recordPurchases', 'viewCosts', 'manageStaffAllowances',
  'approveOverrides', 'viewReports', 'manageProducts', 'voidOrders',
  'manageStaff', 'manageSettings', 'managePayroll', 'manageTables', 'manageSections',
  'viewStation', 'openShift', 'closeShift', 'takeOverTables', 'forceCloseShift',
  'manageCashDifferences', 'viewStaffAnalytics', 'manage86', 'overrideStock',
]
const LEGACY_PERMISSION_KEYS = ['discount', 'credit', 'settle', 'reports', 'register', 'supervisor'] as const

const validPermissions = (permissions: User['permissions']) =>
  LEGACY_PERMISSION_KEYS.every((key) => typeof permissions[key] === 'boolean') &&
  CAPABILITIES.every((key) => permissions[key] === undefined || typeof permissions[key] === 'boolean')

const permissionsForRole = (
  role: User['role'],
  existing: User['permissions'],
  patch?: User['permissions'],
  stationOnly = false,
): User['permissions'] => {
  const permissions = { ...defaultPermissions(role), ...existing, ...patch }
  if (stationOnly) {
    for (const key of LEGACY_PERMISSION_KEYS) permissions[key] = false
    for (const capability of CAPABILITIES) permissions[capability] = false
    permissions.viewStation = true
    permissions.openShift = false
    permissions.closeShift = false
    return permissions
  }
  if (role !== 'manager') {
    for (const capability of CAPABILITIES) {
      if (capability !== 'recordPurchases' && capability !== 'viewStation' &&
          capability !== 'openShift' && capability !== 'closeShift' &&
          capability !== 'takeOverTables' && capability !== 'forceCloseShift' &&
          capability !== 'manageCashDifferences' && capability !== 'viewStaffAnalytics' &&
          capability !== 'manage86' && capability !== 'overrideStock') {
        permissions[capability] = false
      }
    }
  }
  return permissions
}
import { addLog, changedAuditFields } from './audit'
import type { AppContextValue } from './types'
import type { StoreSliceDependencies } from './sliceTypes'

const isValidPhoto = (photo: string | undefined) =>
  photo === undefined || (photo.startsWith('data:image/') && photo.length <= 307200)

const staffSnapshot = (user: User): Record<string, AuditJsonValue> => ({
  name: user.name,
  username: user.username ?? '',
  active: user.active,
  salaryType: user.salaryType,
  salaryAmount: user.salaryAmount,
  permissions: { ...user.permissions },
})

export function useStaffSlice(dependencies: StoreSliceDependencies) {
  const { dbRef, commitDb, requireActor, requireCapability } = dependencies
  const addStaff = useCallback<AppContextValue['addStaff']>(
    async (storeId, data) => {
      const actorResult = requireCapability(storeId, 'manageStaff')
      if (!actorResult.ok) return actorResult
      if (data.stationOnly && actorResult.actor.role !== 'admin') {
        return { ok: false, error: 'Only the owner can assign the Cook / Barista preset.' }
      }
      if (data.stationOnly && data.attendanceEnabled && actorResult.actor.role !== 'admin') {
        return { ok: false, error: 'Only the owner can enable attendance for a station-only account.' }
      }
      if (data.role !== undefined && data.role !== 'staff' && data.role !== 'manager') {
        return { ok: false, error: 'Choose a valid team member role.' }
      }
      if (data.role === 'manager' && actorResult.actor.role !== 'admin') {
        return { ok: false, error: 'Only the owner can assign the manager role.' }
      }
      if (!validPermissions(data.permissions)) return { ok: false, error: 'Choose valid team permissions.' }
      const current = dbRef.current
      const username = normalizeUsername(data.username)
      if (!data.name.trim()) return { ok: false, error: 'Enter the team member’s full name.' }
      if (!isValidUsername(username)) {
        return { ok: false, error: 'Username must be 3–24 lowercase letters, digits, dots, underscores or hyphens.' }
      }
      if (current.users.some((user) => normalizeUsername(user.username ?? '') === username)) {
        return { ok: false, error: 'That username is already in use.' }
      }
      if (!/^\d{4,6}$/.test(data.pin)) return { ok: false, error: 'PIN must contain 4 to 6 digits.' }
      if (!isValidPhoto(data.photo)) return { ok: false, error: 'Profile photos must be images no larger than 300 KB.' }
      if (!['daily', 'monthly', 'none'].includes(data.salaryType) ||
          !Number.isFinite(data.salaryAmount) || data.salaryAmount < 0 ||
          (data.salaryType !== 'none' && data.salaryAmount <= 0)) {
        return { ok: false, error: 'Enter a valid salary type and non-negative amount.' }
      }
      let password: string
      let pin: string
      try {
        ;[password, pin] = await Promise.all([hashRandomSecret(), hashSecret(data.pin)])
      } catch {
        return { ok: false, error: 'Could not securely save the credentials. Please try again.' }
      }
      const latestActor = requireCapability(storeId, 'manageStaff')
      if (!latestActor.ok) return latestActor
      if (data.role === 'manager' && latestActor.actor.role !== 'admin') {
        return { ok: false, error: 'Only the owner can assign the manager role.' }
      }
      if (dbRef.current.users.some((user) => normalizeUsername(user.username ?? '') === username)) {
        return { ok: false, error: 'That username is already in use.' }
      }
      const member: User = {
        ...data,
        name: data.name.trim(),
        salaryType: data.role === 'manager' ? 'none' : data.salaryType,
        salaryAmount: data.role === 'manager' || data.salaryType === 'none' ? 0 : round(data.salaryAmount),
        username,
        email: '',
        password,
        pin,
        role: data.role ?? 'staff',
        stationOnly: data.stationOnly === true && data.role !== 'manager',
        attendanceEnabled: data.stationOnly && data.role !== 'manager' ? data.attendanceEnabled === true : true,
        permissions: permissionsForRole(data.role ?? 'staff', data.permissions, undefined, data.stationOnly),
        id: uid('usr'),
        storeId,
        createdAt: new Date().toISOString(),
      }
      commitDb((prev) => addLog({
        ...prev,
        users: [...prev.users, member],
      }, actorResult.actor, {
        storeId,
        action: 'created',
        entity: 'staff',
        entityId: member.id,
        summary: `Added staff member ${member.name} (${username})`,
        after: staffSnapshot(member),
      }))
      return { ok: true }
    },
    [commitDb, requireCapability],
  )

  const updateStaff = useCallback<AppContextValue['updateStaff']>(async (id, patch) => {
    const current = dbRef.current
    const member = current.users.find((candidate) => candidate.id === id)
    if (!member?.storeId) return { ok: false, error: 'Team member not found.' }
    const storeId = member.storeId
    const actorResult = requireCapability(storeId, 'manageStaff')
    if (!actorResult.ok) return actorResult
    if (patch.storeId !== undefined && patch.storeId !== member.storeId) {
      return { ok: false, error: 'A team member cannot be moved to another store.' }
    }
    if (patch.permissions !== undefined && !validPermissions(patch.permissions)) {
      return { ok: false, error: 'Choose valid team permissions.' }
    }
    if (patch.role !== undefined && patch.role !== member.role && actorResult.actor.role !== 'admin') {
      return { ok: false, error: 'Only the owner can change team member roles.' }
    }
    if (patch.stationOnly !== undefined && patch.stationOnly !== member.stationOnly &&
        actorResult.actor.role !== 'admin') {
      return { ok: false, error: 'Only the owner can assign the Cook / Barista preset.' }
    }
    if (patch.attendanceEnabled !== undefined && patch.attendanceEnabled !== member.attendanceEnabled &&
        actorResult.actor.role !== 'admin') {
      return { ok: false, error: 'Only the owner can change attendance tracking for this account.' }
    }
    if (member.role === 'manager' && actorResult.actor.role !== 'admin') {
      return { ok: false, error: 'Only the owner can edit a manager account.' }
    }
    if (member.role === 'admin' && patch.role !== undefined && patch.role !== member.role) {
      return { ok: false, error: 'Store owner accounts cannot be changed from the team editor.' }
    }
    if (patch.role !== undefined && !['staff', 'manager'].includes(patch.role)) {
      return { ok: false, error: 'Choose a valid team member role.' }
    }
    const nextRole = patch.role ?? member.role
    const stationOnly = patch.stationOnly ?? member.stationOnly ?? false
    const username = patch.username === undefined ? undefined : normalizeUsername(patch.username)
    if (username !== undefined) {
      if (!isValidUsername(username)) {
        return { ok: false, error: 'Username must be 3–24 lowercase letters, digits, dots, underscores or hyphens.' }
      }
      if (current.users.some((user) =>
        user.id !== id && normalizeUsername(user.username ?? '') === username,
      )) return { ok: false, error: 'That username is already in use.' }
    }
    if (patch.pin && !/^\d{4,6}$/.test(patch.pin)) {
      return { ok: false, error: 'PIN must contain 4 to 6 digits.' }
    }
    if ((member.role === 'staff' || member.role === 'manager') && patch.password) {
      return { ok: false, error: 'Staff accounts use a PIN, not a password.' }
    }
    if (nextRole !== 'staff' &&
        ((patch.salaryType !== undefined && patch.salaryType !== 'none') ||
          (patch.salaryAmount !== undefined && patch.salaryAmount !== 0))) {
      return { ok: false, error: 'Salary settings are only available for staff accounts.' }
    }
    if ((patch.salaryType !== undefined || patch.salaryAmount !== undefined) &&
        !requireCapability(storeId, 'managePayroll').ok) {
      return { ok: false, error: 'You do not have permission to manage payroll.' }
    }
    if (patch.salaryType !== undefined && !['daily', 'monthly', 'none'].includes(patch.salaryType)) {
      return { ok: false, error: 'Choose a valid salary type.' }
    }
    if (patch.salaryAmount !== undefined &&
        (!Number.isFinite(patch.salaryAmount) || patch.salaryAmount < 0 ||
          ((patch.salaryType ?? member.salaryType) !== 'none' && patch.salaryAmount <= 0))) {
      return { ok: false, error: 'Salary amount must be a non-negative number.' }
    }
    if (nextRole === 'staff' && (patch.salaryType ?? member.salaryType) !== 'none' &&
        (patch.salaryAmount ?? member.salaryAmount) <= 0) {
      return { ok: false, error: 'Enter a salary amount greater than zero.' }
    }
    if (patch.password && patch.password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters.' }
    }
    if (!isValidPhoto(patch.photo)) {
      return { ok: false, error: 'Profile photos must be images no larger than 300 KB.' }
    }
    const nextActive = patch.active ?? member.active
    const activeChanged = nextActive !== member.active
    const pinReset = Boolean(patch.pin)
    const activeAdmins = current.users.filter((u) => u.storeId === member.storeId && u.role === 'admin' && u.active)
    if (member.role === 'admin' && member.active && (nextRole !== 'admin' || !nextActive) && activeAdmins.length <= 1) {
      return { ok: false, error: 'You cannot demote or deactivate the last active store admin.' }
    }
    const safePatch: Partial<User> = { ...patch }
    if (patch.permissions !== undefined || patch.role !== undefined || patch.stationOnly !== undefined) {
      safePatch.permissions = permissionsForRole(nextRole, member.permissions, patch.permissions, stationOnly)
    }
    if (patch.stationOnly !== undefined || patch.role !== undefined) {
      safePatch.stationOnly = stationOnly && nextRole === 'staff'
      safePatch.attendanceEnabled = safePatch.stationOnly
        ? patch.attendanceEnabled === true || (patch.attendanceEnabled === undefined && member.attendanceEnabled === true)
        : patch.attendanceEnabled !== false
    }
    if (username !== undefined) safePatch.username = username
    if (patch.salaryAmount !== undefined) safePatch.salaryAmount = round(patch.salaryAmount)
    if (patch.salaryType === 'none') safePatch.salaryAmount = 0
    delete safePatch.id
    delete safePatch.storeId
    delete safePatch.createdAt
    if (nextRole === 'staff' || nextRole === 'manager') {
      safePatch.email = ''
      delete safePatch.password
    }
    try {
      if (patch.pin) safePatch.pin = await hashSecret(patch.pin)
      else delete safePatch.pin
      if (patch.password && member.role !== 'staff' && member.role !== 'manager') safePatch.password = await hashSecret(patch.password)
      else delete safePatch.password
    } catch {
      return { ok: false, error: 'Could not securely save the credentials. Please try again.' }
    }
    const latestActor = requireCapability(member.storeId, 'manageStaff')
    if (!latestActor.ok) return latestActor
    if (patch.role !== undefined && latestActor.actor.role !== 'admin') {
      return { ok: false, error: 'Only the owner can change team member roles.' }
    }
    if (username !== undefined && dbRef.current.users.some((user) =>
      user.id !== id && normalizeUsername(user.username ?? '') === username,
    )) return { ok: false, error: 'That username is already in use.' }
    const updated = { ...member, ...safePatch }
    const changes = changedAuditFields(staffSnapshot(member), staffSnapshot(updated))
    commitDb((prev) => {
      let next = { ...prev, users: prev.users.map((u) => (u.id === id ? updated : u)) }
      if (changes.fields.some((field) => field !== 'active')) {
        next = addLog(next, latestActor.actor, {
          storeId,
          action: 'edited',
          entity: 'staff',
          entityId: id,
          summary: `Edited staff member ${member.name} (${changes.fields.filter((field) => field !== 'active').join(', ')})`,
          before: Object.fromEntries(changes.fields.filter((field) => field !== 'active').map((field) => [field, changes.before[field]])),
          after: Object.fromEntries(changes.fields.filter((field) => field !== 'active').map((field) => [field, changes.after[field]])),
        })
      }
      if (activeChanged) {
        next = addLog(next, latestActor.actor, {
          storeId,
          action: nextActive ? 'activated' : 'deactivated',
          entity: 'staff',
          entityId: id,
          summary: `${nextActive ? 'Activated' : 'Deactivated'} staff member ${member.name}`,
          before: { active: member.active },
          after: { active: nextActive },
        })
      }
      if (pinReset) {
        next = addLog(next, latestActor.actor, {
          storeId,
          action: 'pin_reset',
          entity: 'staff',
          entityId: id,
          summary: `Reset PIN for staff member ${member.name}`,
          after: { pinReset: true },
        })
      }
      return next
    })
    return { ok: true }
  }, [commitDb, requireCapability])

  const deleteStaff = useCallback<AppContextValue['deleteStaff']>(
    (id) => {
      const member = dbRef.current.users.find((candidate) => candidate.id === id)
      if (!member?.storeId) return { ok: false, error: 'Team member not found.' }
      const storeId = member.storeId
      const actorResult = requireCapability(storeId, 'manageStaff')
      if (!actorResult.ok) return actorResult
      if (actorResult.actor.id === id) return { ok: false, error: 'You cannot delete your own account.' }
      if (actorResult.actor.role !== 'admin' && member.role !== 'staff') {
        return { ok: false, error: 'Only the owner can remove an admin or manager account.' }
      }
      const remainingAdmins = dbRef.current.users.filter(
        (u) => u.storeId === member.storeId && u.role === 'admin' && u.active,
      )
      if (member.role === 'admin' && member.active && remainingAdmins.length <= 1) {
        return { ok: false, error: 'You cannot remove the only active store admin.' }
      }
      commitDb((prev) => addLog({
        ...prev,
        users: prev.users.filter((u) => u.id !== id),
      }, actorResult.actor, {
        storeId,
        action: 'deleted',
        entity: 'staff',
        entityId: id,
        summary: `Deleted team member ${member.name}`,
        before: staffSnapshot(member),
      }))
      return { ok: true }
    },
    [commitDb, requireCapability],
  )


  const setOwnAdminPin = useCallback<AppContextValue['setOwnAdminPin']>(async (pin) => {
    if (!/^\d{4,12}$/.test(pin)) return { ok: false, error: 'Authorization PIN must contain 4 to 12 digits.' }
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    const actor = actorResult.actor
    if (actor.role !== 'admin' || !actor.storeId) {
      return { ok: false, error: 'Only an active store admin can set this authorization PIN.' }
    }
    const storeId = actor.storeId

    let hashedPin: string
    try {
      hashedPin = await hashSecret(pin)
    } catch {
      return { ok: false, error: 'Could not securely save the authorization PIN. Please try again.' }
    }

    const latestActor = requireActor(storeId)
    if (!latestActor.ok) return latestActor
    if (latestActor.actor.id !== actor.id || latestActor.actor.role !== 'admin') {
      return { ok: false, error: 'Only an active store admin can set this authorization PIN.' }
    }
    const admin = dbRef.current.users.find((candidate) =>
      candidate.id === actor.id && candidate.storeId === storeId &&
      candidate.role === 'admin' && candidate.active,
    )
    if (!admin) return { ok: false, error: 'The active admin account could not be verified.' }
    commitDb((prev) => addLog({
      ...prev,
      users: prev.users.map((candidate) => candidate.id === admin.id
        ? { ...candidate, pin: hashedPin }
        : candidate),
    }, latestActor.actor, {
      storeId,
      action: 'pin_reset',
      entity: 'staff',
      entityId: admin.id,
      summary: 'Set or reset the admin authorization PIN',
      after: { authorizationPinSet: true },
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireActor])

  return { addStaff, updateStaff, deleteStaff, setOwnAdminPin }
}

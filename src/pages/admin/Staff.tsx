import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  AtSign,
  BadgeCheck,
  Copy,
  Crown,
  KeyRound,
  Pencil,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { User } from '../../types'
import { isValidPin, normalizePin, PIN_MAX_LENGTH, PIN_RANGE_HINT } from '../../shared/pin'
import { can, MANAGER_DEFAULT_PERMISSIONS } from '../../lib/permissions'
import { defaultPermissions } from '../../lib/defaults'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Toggle,
} from '../../components/ui'
import { ImageUpload } from '../../components/ImageUpload'
import { useToast } from '../../components/toast'
import { money } from '../../lib/utils'
import { isUsernameForStore, isValidUsername, normalizeUsername, suggestStaffUsername } from '../../lib/staff'
import { getStaffSalesThisMonth } from '../../lib/staffDetails'
import { isQuick, modeFeatures } from '../../lib/posMode'
import StaffPermissionsEditor from './staff/StaffPermissionsEditor'
import type { Result } from '../../store/types'

type StaffForm = {
  role: 'staff' | 'manager'
  stationOnly: boolean
  attendanceEnabled: boolean
  name: string
  username: string
  pin: string
  photo?: string
  active: boolean
  salaryType: User['salaryType']
  salaryAmount: number
  tabCreditLimit?: number
  permissions: User['permissions']
}

const stationOnlyPermissions = (): User['permissions'] => ({
  discount: false,
  credit: false,
  settle: false,
  reports: false,
  register: false,
  supervisor: false,
  manageInventory: false,
  recordPurchases: false,
  viewCosts: false,
  manageStaffAllowances: false,
  useStaffAllowances: false,
  approveOverrides: false,
  viewReports: false,
  manageProducts: false,
  voidOrders: false,
  manageStaff: false,
  manageSettings: false,
  managePayroll: false,
  manageTables: false,
  manageSections: false,
  viewStation: true,
  openShift: false,
  closeShift: false,
  manageCustomers: false,
  viewTabs: false,
  settleTabs: false,
  addToTabs: false,
})

export default function Staff() {
  const { db, store, user, addStaff, updateStaff, deleteStaff, setOwnAdminPin } = useApp()
  const { push } = useToast()
  const navigate = useNavigate()
  const [editor, setEditor] = useState<{ open: boolean; member?: User }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [loginDetails, setLoginDetails] = useState<{ name: string; username: string; pin: string } | null>(null)
  const [adminPin, setAdminPin] = useState('')
  const [adminPinConfirmation, setAdminPinConfirmation] = useState('')
  const [savingAdminPin, setSavingAdminPin] = useState(false)
  const [staffSearch, setStaffSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'manager' | 'staff'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  if (!user) return null
  const canManageStaff = can(user, 'manageStaff')
  const canManagePayroll = can(user, 'managePayroll')
  const canChangeRoles = user.role === 'admin'
  const canManageTabLimits = user.role === 'admin'
  const quick = store ? isQuick(store) : false
  const stationsEnabled = store ? modeFeatures(store).kitchenStations : false
  const canOpenStaffDetails = canManageStaff || (user.role === 'staff' && user.permissions.supervisor)
  if (!canOpenStaffDetails) return <Navigate to="/staff" replace />
  if (!store) return null

  const team = db.users.filter((u) => u.storeId === store.id)
  const filteredTeam = team.filter((member) => {
    const query = staffSearch.trim().toLocaleLowerCase()
    const matchesSearch = !query || [member.name, member.username, member.email]
      .some((value) => value?.toLocaleLowerCase().includes(query))
    const matchesRole = roleFilter === 'all' || member.role === roleFilter
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' ? member.active : !member.active)
    return matchesSearch && matchesRole && matchesStatus
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Team</h2>
          <p className="mt-1 text-[13px] text-muted">
            Give your staff a scoped login — they only ever see this store.
          </p>
        </div>
        {canManageStaff && (
          <Button onClick={() => setEditor({ open: true })}>
            <UserPlus className="h-4 w-4" /> Add team member
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-100 text-muted">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Team size</div>
            <div className="text-[16px] font-extrabold tabular">{team.length}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <BadgeCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Active</div>
            <div className="text-[16px] font-extrabold tabular">{team.filter((u) => u.active).length}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50 text-accent-foreground">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Staff sign-in</div>
            <div className="text-[14px] font-extrabold">Username + PIN</div>
          </div>
        </Card>
      </div>

      {user.role === 'admin' && (
        <Card className="space-y-3 p-4">
          <div>
            <h3 className="text-[14px] font-bold text-ink">Admin authorization PIN</h3>
            <p className="mt-1 text-[12px] text-muted">
              Used to authorize restricted actions. Store owners sign in with email and password.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New PIN" hint={`${PIN_RANGE_HINT}; stored as a secure hash`}>
              <Input
                type="text"
                maxLength={PIN_MAX_LENGTH}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="new-password"
                value={adminPin}
                onChange={(event) => setAdminPin(event.target.value.slice(0, PIN_MAX_LENGTH))}
              />
            </Field>
            <Field label="Confirm PIN">
              <Input
                type="text"
                maxLength={PIN_MAX_LENGTH}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="new-password"
                value={adminPinConfirmation}
                onChange={(event) => setAdminPinConfirmation(event.target.value.slice(0, PIN_MAX_LENGTH))}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted">
              Active accounts with the required permission are the only accounts that can authorize an action.
            </p>
            <Button
              disabled={savingAdminPin || !isValidPin(adminPin) || normalizePin(adminPin) !== normalizePin(adminPinConfirmation)}
              onClick={async () => {
                setSavingAdminPin(true)
                try {
                  const result = await setOwnAdminPin(adminPin)
                  if (!result.ok) {
                    push(result.error, 'error')
                    return
                  }
                  setAdminPin('')
                  setAdminPinConfirmation('')
                  push('Admin authorization PIN saved')
                } catch (error) {
                  push(error instanceof Error ? error.message : 'Could not save the admin PIN.', 'error')
                } finally {
                  setSavingAdminPin(false)
                }
              }}
            >
              {savingAdminPin ? 'Saving…' : 'Save PIN'}
            </Button>
          </div>
        </Card>
      )}

      {loginDetails && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent-foreground/30 bg-accent-50/60 p-4">
          <div>
            <div className="text-[13px] font-bold text-ink">Login details</div>
            <div className="mt-1 text-[12px] text-muted">{loginDetails.name}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px]">
              <span>Username: <strong>{loginDetails.username}</strong></span>
              <span>PIN: <strong>{loginDetails.pin}</strong></span>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `Username: ${loginDetails.username}\nPIN: ${loginDetails.pin}`,
                )
                push('Login details copied')
              } catch {
                push('Could not copy login details. Copy them manually instead.', 'error')
              }
            }}
          >
            <Copy className="h-4 w-4" /> Copy
          </Button>
        </Card>
      )}

      {team.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="h-5 w-5" />} title="No team members yet" />
        </Card>
      ) : (
        <>
        <div className="grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} placeholder="Search name, username, or email" className="pl-9" />
          </div>
          <Select aria-label="Filter team by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </Select>
          <Select aria-label="Filter team by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        {filteredTeam.length === 0 ? (
          <Card><EmptyState icon={<Search className="h-5 w-5" />} title="No matching team members" description="Change or clear the search and filters." /></Card>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTeam.map((m) => {
            const detailsAvailable = m.role === 'staff'
            return (
              <Card
                key={m.id}
                role={detailsAvailable ? 'button' : undefined}
                tabIndex={detailsAvailable ? 0 : undefined}
                aria-label={detailsAvailable ? `View ${m.name} details` : undefined}
                onClick={(event) => {
                  if (event.target instanceof Element && event.target.closest('button,input,select,a')) return
                  if (detailsAvailable) navigate(`/admin/staff/${encodeURIComponent(m.id)}`)
                }}
                onKeyDown={(event) => {
                  if (!detailsAvailable || event.target !== event.currentTarget ||
                      (event.key !== 'Enter' && event.key !== ' ')) return
                  event.preventDefault()
                  navigate(`/admin/staff/${encodeURIComponent(m.id)}`)
                }}
                className={`group p-4 ${detailsAvailable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber-focus' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={m.name} photo={m.photo} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-bold text-ink">{m.name}</span>
                      {m.role === 'admin' ? (
                        <Badge tone="dark">
                          <Crown className="h-2.5 w-2.5" /> Admin
                        </Badge>
                      ) : m.role === 'manager' ? (
                        <Badge tone="accent">Manager (gérant)</Badge>
                      ) : m.stationOnly ? (
                        <Badge tone="neutral">Cook / Barista</Badge>
                      ) : (
                        <Badge tone="neutral">Staff</Badge>
                      )}
                      {!m.active && <Badge tone="danger">Inactive</Badge>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted">
                      <AtSign className="h-3 w-3" /> {m.role === 'staff' ? m.username : m.email}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-cream-50 p-2.5">
                  <div>
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">
                      PIN
                    </div>
                    <div className="font-mono text-[12px] font-semibold">Set/reset in edit</div>
                  </div>
                  <div>
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted">
                      Salary
                    </div>
                    <div className="text-[13px] font-bold tabular">
                      {m.role !== 'staff' || (user.role === 'manager' && !canManagePayroll)
                        ? user.role === 'manager' && m.role === 'staff' ? 'Restricted' : 'Not set'
                        : m.salaryType === 'none'
                        ? 'Not set'
                        : `${m.salaryType} · ${money(m.salaryAmount)}`}
                    </div>
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  Sales this month: {money(getStaffSalesThisMonth(db, store.id, m.id))}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1">
                  {m.permissions.discount && <Badge tone="neutral">Discounts</Badge>}
                  {m.permissions.credit && <Badge tone="neutral">Tabs</Badge>}
                  {m.permissions.settle && <Badge tone="neutral">Settlements</Badge>}
                  {m.permissions.register && <Badge tone="neutral">Register</Badge>}
                  {m.permissions.supervisor && <Badge tone="neutral">Supervisor</Badge>}
                  {m.permissions.reports && <Badge tone="neutral">Financials</Badge>}
                </div>

                {canManageStaff && (
                  <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
                    <Toggle
                      checked={m.active}
                      onChange={async (v) => {
                        const result = await updateStaff(m.id, { active: v })
                        if (!result.ok) {
                          push(result.error, 'error')
                          return
                        }
                        push(v ? `${m.name} activated` : `${m.name} deactivated`, 'info')
                      }}
                      label="Active"
                      disabled={m.id === user.id}
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${m.name}`}
                        title={`Edit ${m.name}`}
                        onClick={() => setEditor({ open: true, member: m })}
                        className="rounded-lg p-1.5 text-muted transition hover:bg-cream-200 hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${m.name}`}
                        title={`Remove ${m.name}`}
                        onClick={() => setDeleteTarget(m)}
                        disabled={m.id === user.id}
                        className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
        )}
        </>
      )}

      <Card className="flex items-start gap-3 border-accent-foreground/20 bg-accent-50/60 p-4">
        <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent-foreground" />
        <div className="text-[12px] leading-relaxed text-accent-foreground">
          <span className="font-semibold">Staff sign in with a unique username and 4–6 character PIN.</span>
          {' '}Usernames are unique across all stores, so no store code, email, or password is needed.
          PINs can be reused and are stored hashed; share the login details securely when they are
          shown after creation or reset. Staff only see this store’s data.
        </div>
      </Card>

      {editor.open && (
        <StaffEditor
          key={editor.member?.id ?? 'new'}
          member={editor.member}
          isSelf={editor.member?.id === user.id}
          storeSlug={store.slug}
          users={db.users}
          canChangeRoles={canChangeRoles && editor.member?.role !== 'admin'}
          canManagePayroll={canManagePayroll}
          canManageTabLimits={canManageTabLimits}
          quick={quick}
          stationsEnabled={stationsEnabled}
          onClose={() => setEditor({ open: false })}
          onSave={async (data) => {
            if (editor.member) {
              const patch = {
                ...(editor.member.role === 'admin'
                  ? {
                      name: data.name,
                      username: data.username,
                      pin: data.pin,
                      photo: data.photo,
                      active: data.active,
                      permissions: data.permissions,
                    }
                  : {
                      ...data,
                      ...(canChangeRoles ? { role: data.role } : {}),
                      ...(data.role === 'manager'
                        ? { salaryType: 'none' as const, salaryAmount: 0 }
                        : {}),
                    }),
              }
              try {
                const result = await updateStaff(editor.member.id, patch)
                if (!result.ok) {
                  push(result.error, 'error')
                  return result
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Could not update this team member.'
                push(message, 'error')
                return { ok: false, error: message }
              }
              push('Team member updated')
              if (data.pin && (editor.member.role === 'staff' || editor.member.role === 'manager')) {
                setLoginDetails({ name: data.name, username: data.username, pin: data.pin })
              }
            } else {
              try {
                const result = await addStaff(store.id, data)
                if (!result.ok) {
                  push(result.error, 'error')
                  return result
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Could not add this team member.'
                push(message, 'error')
                return { ok: false, error: message }
              }
              push(`${data.name} added to the team`)
              setLoginDetails({ name: data.name, username: data.username, pin: data.pin })
            }
            setEditor({ open: false })
            return { ok: true }
          }}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove team member?"
        subtitle={deleteTarget?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteTarget) return
                const res = deleteStaff(deleteTarget.id)
                if (!res.ok) {
                  push(res.error, 'error')
                  return
                }
                push('Team member removed', 'info')
                setDeleteTarget(null)
              }}
            >
              Remove
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-muted">
          They lose access immediately. Their past orders remain in your reports.
        </p>
      </Modal>
    </div>
  )
}

function StaffEditor({
  member,
  isSelf,
  storeSlug,
  users,
  canChangeRoles,
  canManagePayroll,
  canManageTabLimits,
  quick,
  stationsEnabled,
  onClose,
  onSave,
}: {
  member?: User
  isSelf?: boolean
  storeSlug: string
  users: User[]
  canChangeRoles: boolean
  canManagePayroll: boolean
  canManageTabLimits: boolean
  quick: boolean
  stationsEnabled: boolean
  onClose: () => void
  onSave: (data: StaffForm) => Promise<Result>
}) {
  const [name, setName] = useState(member?.name ?? '')
  const [username, setUsername] = useState(
    () => member?.username ?? '',
  )
  const [pin, setPin] = useState('')
  const [photo, setPhoto] = useState(member?.photo)
  const [active, setActive] = useState(member?.active ?? true)
  const [role, setRole] = useState<'staff' | 'manager'>(member?.role === 'manager' ? 'manager' : 'staff')
  const [stationOnly, setStationOnly] = useState(member?.stationOnly === true)
  const [attendanceEnabled, setAttendanceEnabled] = useState(member?.attendanceEnabled ?? !member?.stationOnly)
  const [salaryType, setSalaryType] = useState<User['salaryType']>(member?.salaryType ?? 'none')
  const [salaryAmount, setSalaryAmount] = useState(String(member?.salaryAmount ?? 0))
  const [tabCreditLimit, setTabCreditLimit] = useState(String(member?.tabCreditLimit ?? 0))
  const [permissions, setPermissions] = useState(member?.permissions ?? defaultPermissions('staff'))
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  const nameError = name.trim() ? '' : 'Enter a full name.'
  const normalizedUsername = normalizeUsername(username)
  const duplicateUsername = users.some((user) =>
    user.id !== member?.id && normalizeUsername(user.username ?? '') === normalizedUsername,
  )
  const usernameError = !isValidUsername(username)
    ? 'Use 3–64 lowercase letters, digits, dots, underscores or hyphens.'
    : username !== normalizeUsername(member?.username ?? '') && !isUsernameForStore(username, storeSlug)
      ? `Generate a username ending in .${storeSlug}.`
    : duplicateUsername ? 'That username is already in use.' : ''
  const pinError = member
    ? pin && !isValidPin(pin) ? `PIN must contain ${PIN_RANGE_HINT}.` : ''
    : isValidPin(pin) ? '' : `PIN must contain ${PIN_RANGE_HINT}.`
  const salaryValue = Number(salaryAmount)
  const salaryError = role === 'staff' && salaryType !== 'none' &&
    (!Number.isFinite(salaryValue) || salaryValue <= 0)
    ? 'Enter a salary amount greater than zero.'
    : ''
  const tabCreditLimitValue = Number(tabCreditLimit)
  const tabCreditLimitError = canManageTabLimits &&
    (!Number.isFinite(tabCreditLimitValue) || tabCreditLimitValue < 0)
    ? 'Enter a valid non-negative tab limit.'
    : ''
  const usernameSaveError = /username/i.test(saveError) ? saveError : ''
  const pinSaveError = /pin/i.test(saveError) ? saveError : ''
  const salarySaveError = /salary/i.test(saveError) ? saveError : ''
  const visibleErrors = [
    nameError,
    usernameError || usernameSaveError,
    pinError || pinSaveError,
    salaryError || salarySaveError,
    tabCreditLimitError,
  ].filter(Boolean)
  const valid = visibleErrors.length === 0
  const disabledReason = visibleErrors[0]

  return (
    <Modal
      open
      onClose={onClose}
      title={member ? 'Edit team member' : 'Add team member'}
      subtitle={member ? member.name : 'They will only see this store’s data.'}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!valid && (
            <span id="staff-save-help" role="status" className="mr-auto text-xs text-red-600">
              Save disabled: {disabledReason}
            </span>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || saving}
            title={!valid ? `Save disabled: ${disabledReason}` : undefined}
            aria-describedby={!valid ? 'staff-save-help' : undefined}
            onClick={async () => {
              setSaveError('')
              setSaving(true)
              const result = await onSave({
                name: name.trim(),
                role,
                stationOnly,
                attendanceEnabled,
                username,
                pin,
                photo,
                active,
                salaryType: role === 'manager' ? 'none' : salaryType,
                salaryAmount: role === 'manager' || salaryType === 'none' ? 0 : Number(salaryAmount),
                ...(canManageTabLimits ? { tabCreditLimit: tabCreditLimitValue } : {}),
                permissions,
              })
              setSaving(false)
              if (!result.ok) setSaveError(result.error)
            }}
          >
            {saving ? 'Saving…' : member ? 'Save changes' : 'Add to team'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Full name" className="sm:col-span-2">
            <Input value={name} onChange={(e) => { setName(e.target.value); setSaveError('') }} placeholder="e.g. Amine Jebali" autoFocus aria-invalid={Boolean(nameError)} />
            {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
          </Field>
          {canChangeRoles && (
            <Field label="Role / permission preset">
              <Select
                value={role === 'manager' ? 'manager' : stationOnly ? 'station' : 'staff'}
                onChange={(event) => {
                  setSaveError('')
                  const preset = event.target.value
                  const nextRole = preset === 'manager' ? 'manager' : 'staff'
                  const nextStationOnly = preset === 'station'
                  setRole(nextRole)
                  setStationOnly(nextStationOnly)
                  setAttendanceEnabled(nextStationOnly ? false : true)
                  setPermissions(nextRole === 'manager'
                    ? { ...defaultPermissions('manager'), ...MANAGER_DEFAULT_PERMISSIONS }
                    : nextStationOnly ? stationOnlyPermissions() : defaultPermissions('staff'))
                }}
              >
                <option value="staff">Staff</option>
                <option value="station">Cook / Barista (station-only)</option>
                <option value="manager">Manager (gérant)</option>
              </Select>
            </Field>
          )}
          <Field label="Username" hint={`Generate a unique username ending in .${storeSlug} for this store.`}>
            <div className="flex gap-2">
              <Input
                value={username}
                maxLength={64}
                onChange={(e) => { setUsername(e.target.value.toLowerCase()); setSaveError('') }}
                placeholder={`name.${storeSlug}`}
                autoComplete="username"
                aria-invalid={Boolean(usernameError || usernameSaveError)}
              />
              <Button
                variant="secondary"
                disabled={!name.trim()}
                onClick={() => setUsername(suggestStaffUsername(name, storeSlug, users, member?.id))}
              >
                <Sparkles className="h-4 w-4" /> Generate
              </Button>
            </div>
            {(usernameError || usernameSaveError) && <p className="mt-1 text-xs text-red-600">{usernameError || usernameSaveError}</p>}
          </Field>
          <Field label={member ? 'Set/reset PIN' : 'PIN'} hint={member ? `Leave blank to keep the current PIN · ${PIN_RANGE_HINT}` : `${PIN_RANGE_HINT} · PINs can be reused`}>
            <Input
              type="text"
              value={pin}
              maxLength={PIN_MAX_LENGTH}
              onChange={(e) => { setPin(e.target.value.slice(0, PIN_MAX_LENGTH)); setSaveError('') }}
              placeholder={member ? 'Leave unchanged' : '4–6 characters'}
              autoCapitalize="characters"
              autoCorrect="off"
              className="font-mono tracking-[0.3em]"
              aria-invalid={Boolean(pinError || pinSaveError)}
            />
            {(pinError || pinSaveError) && <p className="mt-1 text-xs text-red-600">{pinError || pinSaveError}</p>}
          </Field>
          <div className="sm:col-span-2">
            <Toggle
              checked={active}
              onChange={setActive}
              label="Account active"
              description={isSelf ? 'You cannot deactivate your own account.' : 'Inactive accounts cannot sign in.'}
              disabled={isSelf}
            />
          </div>
        </div>

        <ImageUpload value={photo} label="Upload profile photo" onChange={setPhoto} />

        {stationOnly && canChangeRoles && (
          <Toggle
            checked={attendanceEnabled}
            onChange={setAttendanceEnabled}
            label="Enable attendance tracking"
            description="Station-only accounts do not create attendance records unless an admin enables this."
          />
        )}

        {role === 'staff' && canManagePayroll && (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Salary type">
              <Select value={salaryType} onChange={(event) => { setSalaryType(event.target.value as User['salaryType']); setSaveError('') }}>
                <option value="none">Not set</option>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>
            <Field label="Salary amount (DT)" hint={salaryType === 'daily' ? 'Per full day' : 'Per month'}>
              <Input
                type="number"
                min={0}
                step="0.001"
                value={salaryAmount}
                onChange={(event) => { setSalaryAmount(event.target.value); setSaveError('') }}
                disabled={salaryType === 'none'}
                placeholder="0.000"
                aria-invalid={Boolean(salaryError || salarySaveError)}
              />
              {(salaryError || salarySaveError) && <p className="mt-1 text-xs text-red-600">{salaryError || salarySaveError}</p>}
            </Field>
          </div>
        )}

        {canManageTabLimits && role !== 'manager' && (
          <Field label="Staff tab credit limit (DT)" hint="0.000 blocks staff tab charges; the owner can override the limit.">
            <Input
              type="number"
              min={0}
              step="0.001"
              value={tabCreditLimit}
              onChange={(event) => { setTabCreditLimit(event.target.value); setSaveError('') }}
              aria-invalid={Boolean(tabCreditLimitError)}
            />
            {tabCreditLimitError && <p className="mt-1 text-xs text-red-600">{tabCreditLimitError}</p>}
          </Field>
        )}

        <StaffPermissionsEditor
          role={role}
          stationOnly={stationOnly}
          quick={quick}
          stationsEnabled={stationsEnabled}
          permissions={permissions}
          onChange={(nextPermissions) => { setPermissions(nextPermissions); setSaveError('') }}
        />

        {saveError && !usernameSaveError && !pinSaveError && !salarySaveError && (
          <p role="alert" className="text-xs text-red-600">{saveError}</p>
        )}
        <p className="text-[11px] leading-relaxed text-muted">
          PINs are securely hashed. You will only see the PIN again when you reset it.
        </p>
      </div>
    </Modal>
  )
}

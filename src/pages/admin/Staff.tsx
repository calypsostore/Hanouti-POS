import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  AtSign,
  BadgeCheck,
  Copy,
  Crown,
  KeyRound,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useApp } from '../../store/AppStore'
import type { User } from '../../types'
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
import { isValidUsername, suggestStaffUsername } from '../../lib/staff'
import { getStaffSalesThisMonth } from '../../lib/staffDetails'

type StaffForm = {
  name: string
  username: string
  pin: string
  photo?: string
  active: boolean
  salaryType: User['salaryType']
  salaryAmount: number
  permissions: User['permissions']
}

export default function Staff() {
  const { db, store, user, addStaff, updateStaff, deleteStaff } = useApp()
  const { push } = useToast()
  const navigate = useNavigate()
  const [editor, setEditor] = useState<{ open: boolean; member?: User }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [loginDetails, setLoginDetails] = useState<{ name: string; username: string; pin: string } | null>(null)

  if (!user) return null
  const canManageStaff = user.role === 'admin'
  const canOpenStaffDetails = canManageStaff || (user.role === 'staff' && user.permissions.supervisor)
  if (!canOpenStaffDetails) return <Navigate to="/staff" replace />
  if (!store) return null

  const team = db.users.filter((u) => u.storeId === store.id)

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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {team.map((m) => {
            const detailsAvailable = m.role === 'staff'
            return (
              <Card
                key={m.id}
                role={detailsAvailable ? 'button' : undefined}
                tabIndex={detailsAvailable ? 0 : undefined}
                aria-label={detailsAvailable ? `View ${m.name} details` : undefined}
                onClick={(event) => {
                  if (event.target instanceof HTMLElement && event.target.closest('button,input,select,a')) return
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
                      {m.role !== 'staff' || m.salaryType === 'none'
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
                  {m.permissions.reports && <Badge tone="neutral">Reports</Badge>}
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
                        onClick={() => setEditor({ open: true, member: m })}
                        className="rounded-lg p-1.5 text-muted transition hover:bg-cream-200 hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
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

      <Card className="flex items-start gap-3 border-accent-foreground/20 bg-accent-50/60 p-4">
        <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent-foreground" />
        <div className="text-[12px] leading-relaxed text-accent-foreground">
          <span className="font-semibold">Staff sign in with a unique username and 4–6 digit PIN.</span>
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
          onClose={() => setEditor({ open: false })}
          onSave={async (data) => {
            if (editor.member) {
              const patch = editor.member.role === 'staff'
                ? data
                : {
                    name: data.name,
                    username: data.username,
                    pin: data.pin,
                    photo: data.photo,
                    active: data.active,
                    permissions: data.permissions,
                  }
              const result = await updateStaff(editor.member.id, patch)
              if (!result.ok) {
                push(result.error, 'error')
                return
              }
              push('Team member updated')
              if (data.pin && editor.member.role === 'staff') {
                setLoginDetails({ name: data.name, username: data.username, pin: data.pin })
              }
            } else {
              const res = await addStaff(store.id, data)
              if (!res.ok) {
                push(res.error, 'error')
                return
              }
              push(`${data.name} added to the team`)
              setLoginDetails({ name: data.name, username: data.username, pin: data.pin })
            }
            setEditor({ open: false })
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
  onClose,
  onSave,
}: {
  member?: User
  isSelf?: boolean
  storeSlug: string
  users: User[]
  onClose: () => void
  onSave: (data: StaffForm) => void
}) {
  const [name, setName] = useState(member?.name ?? '')
  const [username, setUsername] = useState(
    () => member?.username ?? '',
  )
  const [pin, setPin] = useState('')
  const [photo, setPhoto] = useState(member?.photo)
  const [active, setActive] = useState(member?.active ?? true)
  const [salaryType, setSalaryType] = useState<User['salaryType']>(member?.salaryType ?? 'none')
  const [salaryAmount, setSalaryAmount] = useState(String(member?.salaryAmount ?? 0))
  const [permissions, setPermissions] = useState(member?.permissions ?? {
    discount: false,
    credit: true,
    settle: false,
    reports: false,
    register: false,
    supervisor: false,
  })

  const valid =
    !!name.trim() &&
    isValidUsername(username) &&
    (salaryType === 'none' || (Number.isFinite(Number(salaryAmount)) && Number(salaryAmount) > 0)) &&
    (member ? !pin || /^\d{4,6}$/.test(pin) : /^\d{4,6}$/.test(pin))

  return (
    <Modal
      open
      onClose={onClose}
      title={member ? 'Edit team member' : 'Add team member'}
      subtitle={member ? member.name : 'They will only see this store’s data.'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onSave({
                name: name.trim(),
                username,
                pin,
                photo,
                active,
                salaryType,
                salaryAmount: salaryType === 'none' ? 0 : Number(salaryAmount),
                permissions,
              })
            }
          >
            {member ? 'Save changes' : 'Add to team'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Full name" className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amine Jebali" autoFocus />
          </Field>
          <Field label="Username" hint="3–24 lowercase letters, digits, dots, underscores or hyphens">
            <div className="flex gap-2">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="amine.yasmine"
                autoComplete="username"
              />
              <Button
                variant="secondary"
                onClick={() => setUsername(suggestStaffUsername(name, storeSlug, users, member?.id))}
              >
                <Sparkles className="h-4 w-4" /> Generate
              </Button>
            </div>
          </Field>
          <Field label={member ? 'Set/reset PIN' : 'PIN'} hint={member ? 'Leave blank to keep the current PIN · 4–6 digits' : '4–6 digits · PINs can be reused'}>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={member ? 'Leave unchanged' : '1234'}
              inputMode="numeric"
              className="font-mono tracking-[0.3em]"
            />
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

        {(!member || member.role === 'staff') && (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Salary type">
              <Select value={salaryType} onChange={(event) => setSalaryType(event.target.value as User['salaryType'])}>
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
                onChange={(event) => setSalaryAmount(event.target.value)}
                disabled={salaryType === 'none'}
                placeholder="0.000"
              />
            </Field>
          </div>
        )}

        <div className="rounded-xl border border-line bg-white p-3.5">
          <div className="mb-2 text-[12.5px] font-semibold text-ink">Permissions</div>
          <div className="space-y-3">
            <Toggle
              checked={permissions.discount}
              onChange={(v) => setPermissions((p) => ({ ...p, discount: v }))}
              label="Apply discounts"
              description="Can reduce the total at checkout."
            />
            <Toggle
              checked={permissions.credit}
              onChange={(v) => setPermissions((p) => ({ ...p, credit: v }))}
              label="Charge to tabs"
              description="Can attach an order to a customer account."
            />
            <Toggle
              checked={permissions.settle}
              onChange={(v) => setPermissions((p) => ({ ...p, settle: v }))}
              label="Take customer payments"
              description="Can settle tab balances."
            />
            <Toggle
              checked={permissions.reports}
              onChange={(v) => setPermissions((p) => ({ ...p, reports: v }))}
              label="View reports"
              description="Can open the reports and expenses pages."
            />
            <Toggle
              checked={permissions.register}
              onChange={(v) => setPermissions((p) => ({ ...p, register: v }))}
              label="Open & close the register"
              description="Can open a session, print X reports and close the day with a Z report."
            />
            <Toggle
              checked={permissions.supervisor}
              onChange={(v) => setPermissions((p) => ({ ...p, supervisor: v }))}
              label="Shift supervisor"
              description="Trusted with the team: sees every register session and the whole team's sales, and can close sessions opened by others."
            />
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          PINs are securely hashed. You will only see the PIN again when you reset it.
        </p>
      </div>
    </Modal>
  )
}

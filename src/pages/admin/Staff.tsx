import { useState } from 'react'
import {
  BadgeCheck,
  Crown,
  KeyRound,
  Mail,
  Pencil,
  ShieldCheck,
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
  Segmented,
  Toggle,
} from '../../components/ui'
import { useToast } from '../../components/toast'
import { money } from '../../lib/utils'
export default function Staff() {
  const { db, store, user, addStaff, updateStaff, deleteStaff } = useApp()
  const { push } = useToast()
  const [editor, setEditor] = useState<{ open: boolean; member?: User }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  if (!store || !user) return null

  const team = db.users.filter((u) => u.storeId === store.id)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Team</h2>
          <p className="mt-1 text-[13px] text-muted">
            Give your staff a scoped login — they only ever see this store.
          </p>
        </div>
        <Button onClick={() => setEditor({ open: true })}>
          <UserPlus className="h-4 w-4" /> Add team member
        </Button>
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Store code</div>
            <div className="text-[14px] font-extrabold">{store.slug}</div>
          </div>
        </Card>
      </div>

      {team.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="h-5 w-5" />} title="No team members yet" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {team.map((m) => {
            const sales = db.orders.filter(
              (o) =>
                o.storeId === store.id &&
                o.staffId === m.id &&
                o.status === 'completed' &&
                new Date(o.createdAt) >= monthStart,
            )
            return (
              <Card key={m.id} className="group p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={m.name} size="md" />
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
                      <Mail className="h-3 w-3" /> {m.email}
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
                      This month
                    </div>
                    <div className="text-[13px] font-bold tabular">
                      {money(sales.reduce((a, o) => a + o.total, 0))}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1">
                  {m.permissions.discount && <Badge tone="neutral">Discounts</Badge>}
                  {m.permissions.credit && <Badge tone="neutral">Tabs</Badge>}
                  {m.permissions.settle && <Badge tone="neutral">Settlements</Badge>}
                  {m.permissions.register && <Badge tone="neutral">Register</Badge>}
                  {m.permissions.supervisor && <Badge tone="neutral">Supervisor</Badge>}
                  {m.permissions.reports && <Badge tone="neutral">Reports</Badge>}
                </div>

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
              </Card>
            )
          })}
        </div>
      )}

      <Card className="flex items-start gap-3 border-accent-500/20 bg-accent-50/60 p-4">
        <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent-600" />
        <div className="text-[12px] leading-relaxed text-accent-700">
          <span className="font-semibold">How staff access works:</span> each person gets their own
          email + password, plus a 4–6 digit PIN for fast register login using the store code{' '}
          <span className="rounded bg-white/70 px-1 font-mono font-bold">{store.slug}</span>. Data is
          always scoped to this store.
        </div>
      </Card>

      {editor.open && (
        <StaffEditor
          key={editor.member?.id ?? 'new'}
          member={editor.member}
          isSelf={editor.member?.id === user.id}
          onClose={() => setEditor({ open: false })}
          onSave={async (data) => {
            if (editor.member) {
              const result = await updateStaff(editor.member.id, data)
              if (!result.ok) {
                push(result.error, 'error')
                return
              }
              push('Team member updated')
            } else {
              const res = await addStaff(store.id, data)
              if (!res.ok) {
                push(res.error, 'error')
                return
              }
              push(`${data.name} added to the team`)
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

type StaffForm = {
  name: string
  email: string
  password: string
  pin: string
  active: boolean
  role: User['role']
  permissions: User['permissions']
}

function StaffEditor({
  member,
  isSelf,
  onClose,
  onSave,
}: {
  member?: User
  isSelf?: boolean
  onClose: () => void
  onSave: (data: StaffForm) => void
}) {
  const [name, setName] = useState(member?.name ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [active, setActive] = useState(member?.active ?? true)
  const [role, setRole] = useState<'admin' | 'staff'>(member?.role === 'admin' ? 'admin' : 'staff')
  const [permissions, setPermissions] = useState(member?.permissions ?? {
    discount: false,
    credit: true,
    settle: false,
    reports: false,
    register: false,
    supervisor: false,
  })

  const valid =
    name.trim() &&
    email.trim().includes('@') &&
    (member ? !pin || /^\d{4,6}$/.test(pin) : /^\d{4,6}$/.test(pin)) &&
    (member ? !password || password.length >= 4 : password.length >= 4)

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
                email: email.trim(),
                password,
                pin,
                active,
                role,
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
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amine Jebali" autoFocus />
          </Field>
          <Field label="Role">
            <Segmented
              value={role}
              onChange={setRole}
              className="h-10 w-full [&>button]:flex-1"
              size="md"
              options={[
                { value: 'staff', label: 'Staff' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </Field>
          <Field label="Email" className="sm:col-span-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@yourcafe.tn"
            />
          </Field>
          <Field label={member ? 'Set/reset password' : 'Password'} hint={member ? 'Leave blank to keep current password' : 'Min 4 characters'}>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={member ? 'Leave unchanged' : ''} />
          </Field>
          <Field label={member ? 'Set/reset PIN' : 'PIN'} hint={member ? 'Leave blank to keep current PIN · 4–6 digits' : 'Register login · 4–6 digits'}>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={member ? 'Leave unchanged' : '1234'}
              inputMode="numeric"
              className="font-mono tracking-[0.3em]"
            />
          </Field>
        </div>

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

        <Toggle
          checked={active}
          onChange={setActive}
          label="Account active"
          description={isSelf ? 'You cannot deactivate your own account.' : 'Inactive accounts cannot sign in.'}
          disabled={isSelf}
        />

        {role === 'admin' && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
            Admins get full access to settings, products, staff and finances.
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-muted">
          Share these credentials with the team member. They can change their password later — PIN
          changes stay with the store admin.
        </p>
      </div>
    </Modal>
  )
}

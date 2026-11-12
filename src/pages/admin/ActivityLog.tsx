import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { Badge, Button, Card, Field, Input, Select } from '../../components/ui'
import { useToast } from '../../components/toast'
import { csvDownload } from '../../lib/utils'
import { useApp } from '../../store/AppStore'
import type { AuditAction, AuditEntity, AuditLog } from '../../types'

const PAGE_SIZE = 50
const ENTITIES: AuditEntity[] = [
  'order', 'product', 'category', 'customer', 'staff', 'expense',
  'register', 'settings', 'auth', 'payroll',
]

const actionTone = (action: AuditAction) => {
  if (['created', 'login_success', 'register_opened'].includes(action)) return 'success'
  if (['deleted', 'voided', 'refund_applied', 'login_failure', 'deactivated'].includes(action)) return 'danger'
  if (['discount_applied', 'debt_payment', 'register_closed', 'pin_reset'].includes(action)) return 'warning'
  return 'info'
}

const displayDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const changesText = (changes: AuditLog['before']) =>
  changes ? JSON.stringify(changes, null, 2) : 'No field details recorded.'

export default function ActivityLog() {
  const { db, store } = useApp()
  const { push } = useToast()
  const [userFilter, setUserFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  const storeLogs = useMemo(
    () => db.auditLogs
      .filter((log) => log.storeId === store?.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.auditLogs, store?.id],
  )
  const users = useMemo(() => Array.from(
    new Map(storeLogs.map((log) => [log.userId, log.userName])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1])), [storeLogs])
  const filtered = storeLogs.filter((log) => {
    const day = log.createdAt.slice(0, 10)
    if (userFilter !== 'all' && log.userId !== userFilter) return false
    if (entityFilter !== 'all' && log.entity !== entityFilter) return false
    if (fromDate && day < fromDate) return false
    if (toDate && day > toDate) return false
    if (query.trim()) {
      const needle = query.trim().toLowerCase()
      return [log.summary, log.userName, log.action, log.entity, log.entityId ?? '']
        .some((value) => value.toLowerCase().includes(needle))
    }
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstRow = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const lastRow = Math.min(currentPage * PAGE_SIZE, filtered.length)

  if (!store) return null

  const exportCsv = () => {
    csvDownload(`activity-log-${store.slug}.csv`, [
      ['Date and time', 'User', 'Role', 'Action', 'Entity', 'Entity ID', 'Summary', 'Before', 'After'],
      ...filtered.map((log) => [
        log.createdAt,
        log.userName,
        log.role,
        log.action,
        log.entity,
        log.entityId ?? '',
        log.summary,
        log.before ? JSON.stringify(log.before) : '',
        log.after ? JSON.stringify(log.after) : '',
      ]),
    ])
    push('Activity log exported to CSV')
  }

  const resetFilters = () => {
    setUserFilter('all')
    setEntityFilter('all')
    setFromDate('')
    setToDate('')
    setQuery('')
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Activity log</h2>
          <p className="mt-1 text-[13px] text-muted">Append-only record of changes and sign-in activity for {store.name}.</p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="User">
            <Select value={userFilter} onChange={(event) => { setUserFilter(event.target.value); setPage(1) }}>
              <option value="all">All users</option>
              {users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </Field>
          <Field label="Entity">
            <Select value={entityFilter} onChange={(event) => { setEntityFilter(event.target.value); setPage(1) }}>
              <option value="all">All entities</option>
              {ENTITIES.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1) }} />
          </Field>
          <Field label="To">
            <Input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1) }} />
          </Field>
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
              <Input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1) }}
                placeholder="Summary, user or ID"
                className="pl-9"
              />
            </div>
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" onClick={resetFilters}>Clear filters</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
          <p className="text-[12px] font-semibold text-muted">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} · showing {firstRow}–{lastRow}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="secondary"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            ><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[72px] text-center text-[11px] text-muted">Page {currentPage} / {totalPages}</span>
            <Button
              size="icon"
              variant="secondary"
              aria-label="Next page"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
            ><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        {visible.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead className="bg-cream-100/70 text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">Date / time</th>
                  <th className="px-4 py-3 font-bold">User</th>
                  <th className="px-4 py-3 font-bold">Action</th>
                  <th className="px-4 py-3 font-bold">Entity</th>
                  <th className="px-4 py-3 font-bold">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {visible.map((log) => (
                  <Fragment key={log.id}>
                    <tr className="align-top hover:bg-cream-100/45">
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{displayDate(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{log.userName}</div>
                        <div className="mt-0.5 text-[10px] capitalize text-muted">{log.role}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={actionTone(log.action)}>{log.action.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize">{log.entity}</span>
                        {log.entityId && <div className="mt-0.5 max-w-32 truncate text-[10px] text-muted">{log.entityId}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-expanded={expanded === log.id}
                          onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                          className="flex items-start gap-1.5 text-left font-medium text-ink hover:text-brand-navy"
                        >
                          <span>{log.summary}</span>
                          <ChevronDown className={`mt-0.5 h-3.5 w-3.5 shrink-0 transition ${expanded === log.id ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                    {expanded === log.id && (
                      <tr className="bg-cream-100/45">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">Before</h3>
                              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white/60 p-3 text-[11px] leading-relaxed">{changesText(log.before)}</pre>
                            </div>
                            <div>
                              <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">After</h3>
                              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white/60 p-3 text-[11px] leading-relaxed">{changesText(log.after)}</pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-[13px] text-muted">No activity matches these filters.</div>
        )}
      </Card>
    </div>
  )
}

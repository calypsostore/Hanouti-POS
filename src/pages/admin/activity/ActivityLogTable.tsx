import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Field, Input, Select } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { csvDownload } from '../../../lib/utils'
import { formatAuditDateTime, type AuditIdLabels } from '../../../lib/auditFormat'
import type { AuditLog } from '../../../types'
import { auditActionLabel, auditActionTone, auditEntityLabel, AUDIT_ENTITIES } from './activityLogHelpers'
import LogDetails from './LogDetails'

const PAGE_SIZE = 50

export default function ActivityLogTable({
  logs,
  storeSlug,
  staffIds,
  idLabels,
}: {
  logs: AuditLog[]
  storeSlug: string
  staffIds: string[]
  idLabels: AuditIdLabels
}) {
  const { push } = useToast()
  const [userFilter, setUserFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const staffIdSet = useMemo(() => new Set(staffIds), [staffIds])
  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [logs],
  )
  const users = useMemo(() => Array.from(
    new Map(sortedLogs.map((log) => [log.userId, log.userName])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1])), [sortedLogs])
  const filtered = sortedLogs.filter((log) => {
    const day = log.createdAt.slice(0, 10)
    if (userFilter !== 'all' && log.userId !== userFilter) return false
    if (entityFilter !== 'all' && log.entity !== entityFilter) return false
    if (fromDate && day < fromDate) return false
    if (toDate && day > toDate) return false
    const needle = query.trim().toLowerCase()
    if (needle && ![
      log.summary, log.userName, log.action, log.entity, log.entityId ?? '',
    ].some((value) => value.toLowerCase().includes(needle))) return false
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstRow = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const lastRow = Math.min(currentPage * PAGE_SIZE, filtered.length)

  const exportCsv = () => {
    csvDownload(`activity-log-${storeSlug}.csv`, [
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
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end">
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
              {AUDIT_ENTITIES.map((entity) => (
                <option key={entity} value={entity}>{auditEntityLabel(entity)}</option>
              ))}
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
            <Button size="icon" variant="secondary" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[72px] text-center text-[11px] text-muted">Page {currentPage} / {totalPages}</span>
            <Button size="icon" variant="secondary" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
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
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatAuditDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        {staffIdSet.has(log.userId)
                          ? <Link to={`/admin/staff/${encodeURIComponent(log.userId)}`} className="font-semibold text-ink hover:text-accent-foreground hover:underline">{log.userName}</Link>
                          : <div className="font-semibold text-ink">{log.userName}</div>}
                        <div className="mt-1">
                          <Badge tone={log.role === 'admin' ? 'dark' : log.role === 'manager' ? 'accent' : 'neutral'}>
                            {log.role === 'manager' ? 'Manager (gérant)' : log.role}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge tone={auditActionTone(log.action)}>{auditActionLabel(log.action)}</Badge></td>
                      <td className="px-4 py-3">
                        <span>{auditEntityLabel(log.entity)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-expanded={expanded === log.id}
                          onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                          className="flex items-start gap-1.5 text-left font-medium text-ink hover:text-accent-foreground"
                        >
                          <span>{log.summary}</span>
                          <ChevronDown className={`mt-0.5 h-3.5 w-3.5 shrink-0 transition ${expanded === log.id ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                    {expanded === log.id && (
                      <tr className="bg-cream-100/45">
                        <td colSpan={5} className="px-4 py-4"><LogDetails log={log} idLabels={idLabels} /></td>
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

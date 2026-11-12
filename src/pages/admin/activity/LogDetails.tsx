import type { AuditLog } from '../../../types'
import { auditActionLabel, auditActionTone, auditEntityLabel } from './activityLogHelpers'
import { formatAuditDateTime, getAuditChanges, type AuditIdLabels } from '../../../lib/auditFormat'
import { Badge } from '../../../components/ui'

export default function LogDetails({ log, idLabels }: { log: AuditLog; idLabels: AuditIdLabels }) {
  const changes = getAuditChanges(log, idLabels)
  return (
    <section className="space-y-4 rounded-xl border border-line bg-white/70 p-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{log.userName}</span>
          <Badge tone={log.role === 'admin' ? 'dark' : log.role === 'manager' ? 'accent' : 'neutral'}>
            {log.role === 'manager' ? 'Manager (gérant)' : log.role}
          </Badge>
          <Badge tone={auditActionTone(log.action)}>{auditActionLabel(log.action)}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>{auditEntityLabel(log.entity)}</span>
          <time dateTime={log.createdAt}>{formatAuditDateTime(log.createdAt)}</time>
        </div>
        {changes.length > 0 && <p className="text-[12px] leading-relaxed text-ink">{log.summary}</p>}
      </header>

      {changes.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">What changed</h3>
          <div className="overflow-x-auto rounded-lg border border-line/70">
            <table className="w-full min-w-[420px] text-left text-[12px]">
              <thead className="bg-cream-100/70 text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2 font-bold">Field</th>
                  <th className="px-3 py-2 font-bold">Before</th>
                  <th className="px-3 py-2 font-bold">After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {changes.map((change) => (
                  <tr key={change.field}>
                    <th scope="row" className="px-3 py-2 font-semibold text-ink">{change.field}</th>
                    <td className="max-w-[220px] whitespace-pre-wrap break-words px-3 py-2 text-muted">{change.before}</td>
                    <td className="max-w-[220px] whitespace-pre-wrap break-words px-3 py-2 text-ink">{change.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-[12px] leading-relaxed text-ink">{log.summary}</p>
      )}

      <details className="border-t border-line/70 pt-3">
        <summary className="cursor-pointer text-[11px] font-semibold text-muted hover:text-ink">
          Technical details
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {log.before && (
            <div>
              <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Before</h4>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-cream-100/70 p-3 text-[10px] leading-relaxed">{JSON.stringify(log.before, null, 2)}</pre>
            </div>
          )}
          {log.after && (
            <div>
              <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">After</h4>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-cream-100/70 p-3 text-[10px] leading-relaxed">{JSON.stringify(log.after, null, 2)}</pre>
            </div>
          )}
        </div>
      </details>
    </section>
  )
}

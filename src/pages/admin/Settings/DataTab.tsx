import { useRef, useState } from 'react'
import { Download, FileUp, RotateCcw } from 'lucide-react'
import { useApp } from '../../../store/AppStore'
import { useToast } from '../../../components/toast'
import { Button, Card, Field, Input, Modal } from '../../../components/ui'
import { APP_BUILD_TIMESTAMP, APP_VERSION } from '../../../lib/appVersion'
import { dateKey } from '../../../lib/utils'
import { buildSeed } from '../../../data/seed'
import { DB_KEY, normalizeDatabaseBackup } from '../../../store/database'
import type { Database } from '../../../types'

type PendingImport = { database: Database; fileName: string }

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : timestamp
}

const countStaff = (database: Database) =>
  database.users.filter((user) => user.role === 'staff' || user.role === 'manager').length

function downloadBackup(database: Database) {
  const blob = new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `7anouti-backup-${dateKey(new Date())}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function DataTab() {
  const { user, exportDatabaseBackup, importDatabaseBackup, resetDemo } = useApp()
  const { push } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState('')
  const [importing, setImporting] = useState(false)
  const [resetting, setResetting] = useState(false)

  if (user?.role !== 'admin') return null

  const selectBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const database = normalizeDatabaseBackup(parsed, buildSeed())
      if (!database) {
        push('This file is not a valid, complete 7anouti database backup.', 'error')
        return
      }
      setPendingImport({ database, fileName: file.name })
    } catch (error) {
      console.error('7anouti: could not read the selected database backup.', error)
      push('Could not read this backup file. Choose a valid 7anouti JSON backup.', 'error')
    }
  }

  const exportBackup = () => {
    const result = exportDatabaseBackup()
    if (!result.ok) {
      push(result.error, 'error')
      return
    }
    try {
      downloadBackup(result.database)
      push('Database backup downloaded', 'success')
    } catch (error) {
      console.error('7anouti: could not download the database backup.', error)
      push('Could not download the database backup.', 'error')
    }
  }

  const confirmImport = async () => {
    if (!pendingImport || importing) return
    setImporting(true)
    try {
      const result = await importDatabaseBackup(pendingImport.database)
      if (!result.ok) {
        push(result.error, 'error')
        return
      }
      setPendingImport(null)
      push('Database backup imported', 'success')
    } catch (error) {
      console.error('7anouti: database backup import failed.', error)
      push('Could not import this backup. Your current data was not replaced.', 'error')
    } finally {
      setImporting(false)
    }
  }

  const confirmReset = async () => {
    if (resetConfirmation !== 'RESET' || resetting) return
    setResetting(true)
    try {
      const result = await resetDemo(resetConfirmation)
      if (!result.ok) {
        push(result.error, 'error')
        return
      }
      setResetOpen(false)
      setResetConfirmation('')
      push('Demo data reset', 'success')
    } catch (error) {
      console.error('7anouti: demo data reset failed.', error)
      push('Could not reset demo data.', 'error')
    } finally {
      setResetting(false)
    }
  }

  const imported = pendingImport?.database

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-bold text-ink">Application version</h2>
        <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted">App version</dt>
            <dd className="mt-1 break-all font-semibold text-ink">{APP_VERSION}</dd>
          </div>
          <div>
            <dt className="text-muted">Database version</dt>
            <dd className="mt-1 break-all font-semibold text-ink">{DB_KEY}</dd>
          </div>
          <div>
            <dt className="text-muted">Build timestamp</dt>
            <dd className="mt-1 break-all font-semibold text-ink">{formatTimestamp(APP_BUILD_TIMESTAMP)}</dd>
          </div>
        </dl>
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-bold text-ink">Browser-local data</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Data stays in this browser. Until the Phase 2 backend exists, a backup file is the only way
            to move it to another browser or device. Exported backups include stored password and PIN hashes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportBackup}>
            <Download className="h-4 w-4" /> Export backup
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={importing}>
            <FileUp className="h-4 w-4" /> Import backup
          </Button>
          <input
            ref={fileInput}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={selectBackup}
            aria-label="Choose a database backup"
          />
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 border-dashed p-4">
        <div>
          <div className="text-[12.5px] font-semibold text-ink">Reset to demo data</div>
          <div className="text-[11.5px] text-muted">
            Replaces all stores and records with the original sample data, then signs you out.
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
        </Button>
      </Card>

      <Modal
        open={!!imported}
        onClose={() => {
          if (!importing) setPendingImport(null)
        }}
        title="Replace current data?"
        subtitle={pendingImport?.fileName}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={importing} onClick={() => setPendingImport(null)}>Cancel</Button>
            <Button variant="danger" loading={importing} disabled={importing} onClick={confirmImport}>
              Replace data
            </Button>
          </div>
        }
      >
        {imported && (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-muted">
              This replaces the database saved in this browser. Confirm the backup contents before continuing.
            </p>
            <dl className="grid grid-cols-2 gap-2 rounded-xl bg-cream-100 p-3 text-xs sm:grid-cols-4">
              <Count label="Stores" value={imported.stores.length} />
              <Count label="Products" value={imported.products.length} />
              <Count label="Orders" value={imported.orders.length} />
              <Count label="Staff" value={countStaff(imported)} />
            </dl>
          </div>
        )}
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => {
          setResetOpen(false)
          setResetConfirmation('')
        }}
        title="Reset to demo data?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => {
              setResetOpen(false)
              setResetConfirmation('')
            }}>Cancel</Button>
            <Button variant="danger" loading={resetting} disabled={resetConfirmation !== 'RESET' || resetting} onClick={confirmReset}>
              Reset everything
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted">
            This replaces all local data with demo data and signs you out. Type RESET to confirm.
          </p>
          <Field label="Confirmation">
            <Input value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-bold text-ink">{value}</dd>
    </div>
  )
}

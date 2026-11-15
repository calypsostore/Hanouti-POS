import { randomUUID } from 'node:crypto'
import type { HubStorage } from '../storage.ts'
import type { HubWebSocket } from '../websocket.ts'
import { sendToPrinter } from './drivers.ts'
import type { PrintConnection, PrintJobType } from '../../../src/types.ts'
import type { SyncDocument } from '../../../src/shared/sync.ts'

export interface PrinterRecord extends SyncDocument {
  id: string
  storeId: string
  name: string
  connection: PrintConnection
  host?: string
  port: number
  osPrinterName?: string
  baudRate: number
  paperWidth: 58 | 80
  codepage: 'cp1252' | 'cp437' | 'cp850' | 'cp858'
  cutMode: 'none' | 'partial' | 'full'
  openDrawerOnCash?: boolean
  copies: number
  enabled: boolean
  fallbackPrinterId?: string
}

export interface PrintJobRecord extends SyncDocument {
  id: string
  storeId: string
  type: PrintJobType
  printerId: string
  stationId?: string
  payload: Array<{ text: string; align?: 'left' | 'center' | 'right'; bold?: boolean; size?: 'normal' | 'double' }>
  copies: number
  createdById: string
  createdAt: string
  status: 'queued' | 'sending' | 'printed' | 'failed' | 'cancelled'
  attempts: number
  openDrawer?: boolean
  lastError?: string
  nextAttemptAt?: string
  fallbackTried?: boolean
}

type NewPrintJob = Pick<
  PrintJobRecord,
  'storeId' | 'type' | 'printerId' | 'payload' | 'copies' | 'createdById'
> & Partial<Pick<PrintJobRecord, 'stationId' | 'openDrawer'>>

export class HubPrintQueue {
  private readonly working = new Set<string>()
  private timer: NodeJS.Timeout | undefined
  private readonly storage: HubStorage
  private readonly sockets: HubWebSocket

  constructor(storage: HubStorage, sockets: HubWebSocket) {
    this.storage = storage
    this.sockets = sockets
  }

  async start(): Promise<void> {
    for (const storeId of await this.storage.listStoreIds()) {
      const state = await this.storage.readStore(storeId)
      const jobs = Object.values(state.collections.printJobs ?? {}) as unknown as PrintJobRecord[]
      for (const job of jobs) {
        if (job.status === 'sending') {
          await this.update({ ...job, status: 'queued', lastError: 'Recovered an interrupted print attempt.' })
        }
      }
    }
    this.timer = setInterval(() => { void this.pump() }, 1000)
    this.timer.unref()
    await this.pump()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async enqueue(job: NewPrintJob): Promise<PrintJobRecord> {
    const record: PrintJobRecord = {
      ...job,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'queued',
      attempts: 0,
    }
    await this.update(record)
    return record
  }

  async test(storeId: string, printerId: string, userId: string): Promise<PrintJobRecord> {
    return this.enqueue({
      storeId, type: 'test', printerId, copies: 1, createdById: userId,
      payload: [{ text: '7anouti POS', align: 'center', bold: true }, { text: 'Hub printer test' }, { text: new Date().toISOString() }],
    })
  }

  async update(job: PrintJobRecord): Promise<void> {
    const state = await this.storage.readStore(job.storeId)
    const opId = randomUUID()
    await this.storage.transact(job.storeId, {
      opId, deviceId: 'hub-print-service', storeId: job.storeId, baseSeq: state.seq,
      ops: [{ kind: 'put', collection: 'printJobs', id: job.id, document: job }],
    })
    this.sockets.broadcast(job.storeId, { type: 'print-job', job: { ...job, lastError: job.lastError?.slice(0, 256) } })
  }

  async counts(storeId: string): Promise<Record<string, number>> {
    const state = await this.storage.readStore(storeId)
    const jobs = Object.values(state.collections.printJobs ?? {}) as unknown as PrintJobRecord[]
    return jobs.reduce<Record<string, number>>((counts, job) => {
      counts[job.status] = (counts[job.status] ?? 0) + 1
      return counts
    }, {})
  }

  async cloudPoll(storeId: string, printerId: string): Promise<{ job: PrintJobRecord; bytes: Uint8Array } | null> {
    const state = await this.storage.readStore(storeId)
    const printer = state.collections.printers?.[printerId] as unknown as PrinterRecord | undefined
    if (!printer || printer.connection !== 'hub-star') return null
    const jobs = Object.values(state.collections.printJobs ?? {}) as unknown as PrintJobRecord[]
    const job = jobs.filter((candidate) => candidate.printerId === printerId && candidate.status === 'queued').sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
    if (!job) return null
    await this.update({ ...job, status: 'sending', attempts: job.attempts + 1 })
    const { renderJob } = await import('./drivers.ts')
    return { job, bytes: renderJob(job, printer) }
  }

  async reportCloudPrint(storeId: string, jobId: string, success: boolean, message?: string): Promise<void> {
    const state = await this.storage.readStore(storeId)
    const job = state.collections.printJobs?.[jobId] as unknown as PrintJobRecord | undefined
    if (!job || job.status !== 'sending') throw new Error('Print job is not awaiting CloudPRNT status.')
    await this.update({
      ...job,
      status: success ? 'printed' : 'failed',
      lastError: success ? undefined : (message || 'CloudPRNT reported a print failure.').slice(0, 256),
    })
  }

  private async pump(): Promise<void> {
    for (const storeId of await this.storage.listStoreIds()) {
      const state = await this.storage.readStore(storeId)
      const printers = Object.values(state.collections.printers ?? {}) as unknown as PrinterRecord[]
      const jobs = Object.values(state.collections.printJobs ?? {}) as unknown as PrintJobRecord[]
      for (const printer of printers) {
        if (!printer.enabled || !printer.id || this.working.has(`${storeId}:${printer.id}`)) continue
        const job = jobs.filter((candidate) => candidate.printerId === printer.id && candidate.status === 'queued')
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
        if (!job || (job.nextAttemptAt && Date.parse(job.nextAttemptAt) > Date.now())) continue
        const key = `${storeId}:${printer.id}`
        this.working.add(key)
        void this.processJob(job, printer)
          .catch((error: unknown) => console.error(`Print job ${job.id} failed to persist its state: ${error instanceof Error ? error.message : 'storage error'}`))
          .finally(() => this.working.delete(key))
      }
    }
  }

  private async processJob(job: PrintJobRecord, printer: PrinterRecord): Promise<void> {
    if (printer.connection === 'hub-star' && printer.host?.toLowerCase() === 'cloudprnt') return
    const sending = { ...job, status: 'sending' as const, attempts: job.attempts + 1 }
    await this.update(sending)
    try {
      for (let copy = 0; copy < Math.max(1, Math.min(10, job.copies)); copy += 1) await sendToPrinter(job, printer)
      await this.update({ ...sending, status: 'printed', lastError: undefined, nextAttemptAt: undefined })
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 256) : 'Printer error.'
      const fallback = printer.fallbackPrinterId
      const state = await this.storage.readStore(job.storeId)
      const fallbackPrinter = fallback ? state.collections.printers?.[fallback] as unknown as PrinterRecord | undefined : undefined
      if (fallbackPrinter?.enabled && fallbackPrinter.storeId === job.storeId && !job.fallbackTried) {
        await this.update({ ...sending, printerId: fallbackPrinter.id, fallbackTried: true, status: 'queued', lastError: `Primary printer failed: ${message}` })
      } else if (sending.attempts < 5) {
        const delay = Math.min(300_000, 1000 * (2 ** sending.attempts))
        await this.update({
          ...sending, status: 'queued', lastError: message,
          nextAttemptAt: new Date(Date.now() + delay).toISOString(),
        })
      } else {
        await this.update({ ...sending, status: 'failed', lastError: message })
      }
    }
  }
}

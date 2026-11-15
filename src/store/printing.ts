import { useCallback } from 'react'
import type { PrintJob, PrintJobType, PrintRoute, Printer } from '../types'
import { can } from '../lib/permissions'
import { uid } from '../lib/utils'
import { addLog } from './audit'
import type { AppContextValue, EnqueuePrintInput, PrintJobResult, PrinterInput, Result } from './types'
import type { StoreSliceDependencies } from './sliceTypes'
import { hasPrintCapability, sendToPrintTransport } from '../lib/printQueue'
import { readDevicePrintPreference } from '../lib/printPreferences'
import { resolvePrintPrinter } from '../lib/printRouting'
import { automaticPrintRetryLimit } from '../lib/automation'

const isPrintJobType = (type: PrintJobType) =>
  ['receipt', 'kitchen', 'bar', 'report', 'label', 'test'].includes(type)
const isValidPrinterInput = (input: PrinterInput) =>
  Number.isSafeInteger(input.port) && input.port >= 1 && input.port <= 65535 &&
  Number.isSafeInteger(input.baudRate) && input.baudRate >= 300 && input.baudRate <= 921600 &&
  (input.paperWidth === 58 || input.paperWidth === 80) &&
  ['cp1252', 'cp437', 'cp850', 'cp858'].includes(input.codepage) &&
  ['none', 'partial', 'full'].includes(input.cutMode) &&
  Number.isSafeInteger(input.copies) && input.copies >= 1 && input.copies <= 10
const isValidPrintPayload = (payload: unknown): payload is EnqueuePrintInput['payload'] =>
  Array.isArray(payload) && payload.length <= 5000 && payload.every((line) =>
    typeof line === 'object' && line !== null && 'text' in line &&
    typeof line.text === 'string' &&
    (!('align' in line) || line.align === undefined || line.align === 'left' || line.align === 'center' || line.align === 'right') &&
    (!('bold' in line) || line.bold === undefined || typeof line.bold === 'boolean') &&
    (!('size' in line) || line.size === undefined || line.size === 'normal' || line.size === 'double'),
  )

export function usePrintingSlice({ dbRef, commitDb, requireActor, requireCapability, provider }: StoreSliceDependencies) {
  const addPrinter = useCallback<AppContextValue['addPrinter']>((storeId, input: PrinterInput): Result => {
    const actorResult = requireCapability(storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    const name = input.name.trim().slice(0, 100)
    if (!name) return { ok: false, error: 'Enter a printer name.' }
    if (!isValidPrinterInput(input)) return { ok: false, error: 'Check the printer port, baud rate, paper settings and copy count.' }
    if (dbRef.current.printers.some((printer) =>
      printer.storeId === storeId && printer.name.toLowerCase() === name.toLowerCase(),
    )) return { ok: false, error: 'A printer with this name already exists.' }
    if (input.fallbackPrinterId && !dbRef.current.printers.some((printer) =>
      printer.id === input.fallbackPrinterId && printer.storeId === storeId && printer.enabled,
    )) return { ok: false, error: 'Choose an enabled fallback printer from this store.' }
    const printer: Printer = { ...input, id: uid('printer'), storeId, name }
    commitDb((previous) => addLog({
      ...previous,
      printers: [...previous.printers, printer],
    }, actorResult.actor, {
      storeId,
      action: 'created',
      entity: 'settings',
      entityId: printer.id,
      summary: `Added printer ${name}`,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const updatePrinter = useCallback<AppContextValue['updatePrinter']>((id, patch): Result => {
    const printer = dbRef.current.printers.find((entry) => entry.id === id)
    if (!printer) return { ok: false, error: 'Printer not found.' }
    const actorResult = requireCapability(printer.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    if ('id' in patch || 'storeId' in patch) return { ok: false, error: 'A printer cannot be moved to another store.' }
    const name = patch.name === undefined ? printer.name : patch.name.trim().slice(0, 100)
    if (!name) return { ok: false, error: 'Enter a printer name.' }
    if (dbRef.current.printers.some((entry) =>
      entry.id !== id && entry.storeId === printer.storeId &&
      entry.name.toLowerCase() === name.toLowerCase(),
    )) return { ok: false, error: 'A printer with this name already exists.' }
    const fallbackPrinterId = patch.fallbackPrinterId === undefined
      ? printer.fallbackPrinterId
      : patch.fallbackPrinterId || undefined
    if (fallbackPrinterId && !dbRef.current.printers.some((entry) =>
      entry.id === fallbackPrinterId && entry.id !== id &&
      entry.storeId === printer.storeId && entry.enabled,
    )) return { ok: false, error: 'Choose an enabled fallback printer from this store.' }
    const updated = { ...printer, ...patch, name, fallbackPrinterId }
    if (!isValidPrinterInput(updated)) return { ok: false, error: 'Check the printer port, baud rate, paper settings and copy count.' }
    commitDb((previous) => addLog({
      ...previous,
      printers: previous.printers.map((entry) => entry.id === id ? updated : entry),
    }, actorResult.actor, {
      storeId: printer.storeId,
      action: 'edited',
      entity: 'settings',
      entityId: id,
      summary: `Updated printer ${name}`,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const deletePrinter = useCallback<AppContextValue['deletePrinter']>((id): Result => {
    const printer = dbRef.current.printers.find((entry) => entry.id === id)
    if (!printer) return { ok: false, error: 'Printer not found.' }
    const actorResult = requireCapability(printer.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    const jobs = dbRef.current.printJobs.filter((job) => job.printerId === id)
    if (jobs.some((job) => job.status === 'queued' || job.status === 'sending')) {
      return { ok: false, error: 'Wait for queued jobs to finish before removing this printer.' }
    }
    const hasHistory = jobs.length > 0
    commitDb((previous) => addLog({
      ...previous,
      printers: hasHistory
        ? previous.printers.map((entry) => entry.id === id ? { ...entry, enabled: false } : {
            ...entry,
            fallbackPrinterId: entry.fallbackPrinterId === id ? undefined : entry.fallbackPrinterId,
          })
        : previous.printers.filter((entry) => entry.id !== id).map((entry) => ({
            ...entry,
            fallbackPrinterId: entry.fallbackPrinterId === id ? undefined : entry.fallbackPrinterId,
          })),
      printRoutes: previous.printRoutes.filter((route) => route.printerId !== id),
      stations: previous.stations.map((station) =>
        station.printerId === id ? { ...station, printerId: undefined } : station,
      ),
    }, actorResult.actor, {
      storeId: printer.storeId,
      action: 'deleted',
      entity: 'settings',
      entityId: id,
      summary: `${hasHistory ? 'Archived' : 'Deleted'} printer ${printer.name}`,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const setPrintRoute = useCallback<AppContextValue['setPrintRoute']>((
    storeId, type, stationId, printerId,
  ): Result => {
    const actorResult = requireCapability(storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    if (!isPrintJobType(type)) return { ok: false, error: 'Choose a supported print type.' }
    if (stationId && !dbRef.current.stations.some((station) =>
      station.id === stationId && station.storeId === storeId,
    )) return { ok: false, error: 'Choose a station from this store.' }
    if (printerId && !dbRef.current.printers.some((printer) =>
      printer.id === printerId && printer.storeId === storeId && printer.enabled,
    )) return { ok: false, error: 'Choose an enabled printer from this store.' }
    const existing = dbRef.current.printRoutes.find((route) =>
      route.storeId === storeId && route.type === type && route.stationId === stationId,
    )
    const routes = dbRef.current.printRoutes.filter((route) => route.id !== existing?.id)
    const nextRoute: PrintRoute | undefined = printerId
      ? { id: existing?.id ?? uid('route'), storeId, type, stationId, printerId }
      : undefined
    commitDb((previous) => addLog({
      ...previous,
      printRoutes: nextRoute ? [...routes, nextRoute] : routes,
    }, actorResult.actor, {
      storeId,
      action: nextRoute ? existing ? 'edited' : 'created' : 'deleted',
      entity: 'settings',
      entityId: existing?.id ?? nextRoute?.id,
      summary: `${nextRoute ? 'Updated' : 'Removed'} ${type}${stationId ? ' station' : ''} print route`,
      before: existing
        ? { type: existing.type, stationId: existing.stationId ?? null, printerId: existing.printerId ?? null }
        : undefined,
      after: nextRoute
        ? { type: nextRoute.type, stationId: nextRoute.stationId ?? null, printerId: nextRoute.printerId ?? null }
        : undefined,
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  const executeJob = useCallback(async (job: PrintJob): Promise<PrintJobResult> => {
    const printer = dbRef.current.printers.find((entry) =>
      entry.id === job.printerId && entry.storeId === job.storeId,
    )
    if (!printer) return { ok: false, error: 'The configured printer no longer exists.' }
    const actorResult = requireActor(job.storeId)
    if (!actorResult.ok) return actorResult
    if (actorResult.actor.id !== job.createdById && !can(actorResult.actor, 'manageSettings')) {
      return { ok: false, error: 'Only the print-job owner or a settings manager can retry this job.' }
    }
    if (provider.mode === 'hub' && printer.connection.startsWith('hub-')) {
      const queued = { ...job, status: 'queued' as const, lastError: undefined }
      commitDb((previous) => ({
        ...previous,
        printJobs: previous.printJobs.map((entry) => entry.id === job.id ? queued : entry),
      }))
      const result = await provider.queuePrint(queued)
      return result.ok
        ? { ok: true, job: queued }
        : { ok: false, error: result.error }
    }
    const automation = dbRef.current.stores.find((store) => store.id === job.storeId)?.settings.automation
    const retryLimit = automaticPrintRetryLimit(automation)
    let attempts = job.attempts
    let fallbackAttempted = false
    let finalError = 'The printer transport failed.'
    let fallbackName: string | undefined
    for (let retry = 0; retry < retryLimit; retry += 1) {
      attempts += 1
      const sending: PrintJob = {
        ...job, status: 'sending', attempts, lastError: undefined,
      }
      commitDb((previous) => ({
        ...previous,
        printJobs: previous.printJobs.map((entry) => entry.id === job.id ? sending : entry),
      }))
      try {
        const result = await sendToPrintTransport(sending, printer, readDevicePrintPreference())
        if (result.ok) {
          const printed = { ...sending, status: 'printed' as const, lastError: undefined }
          commitDb((previous) => ({
            ...previous,
            printJobs: previous.printJobs.map((entry) => entry.id === job.id ? printed : entry),
          }))
          return { ok: true, job: printed }
        }
        finalError = result.error
      } catch (error) {
        finalError = error instanceof Error ? error.message : 'The printer transport failed.'
      }
      if (!fallbackAttempted && automation?.fallbackPrintJobs !== false && printer.fallbackPrinterId) {
        const fallback = dbRef.current.printers.find((entry) =>
          entry.id === printer.fallbackPrinterId && entry.storeId === job.storeId && entry.enabled,
        )
        if (fallback) {
          fallbackAttempted = true
          fallbackName = fallback.name
          attempts += 1
          try {
            const fallbackResult = await sendToPrintTransport(
              { ...sending, attempts },
              fallback,
              readDevicePrintPreference(),
            )
            if (fallbackResult.ok) {
              const printed = {
                ...sending,
                status: 'printed' as const,
                attempts,
                lastError: `Primary printer failed; printed via ${fallback.name}.`,
              }
              commitDb((previous) => ({
                ...previous,
                printJobs: previous.printJobs.map((entry) => entry.id === job.id ? printed : entry),
              }))
              return { ok: true, job: printed }
            }
            finalError = `${finalError} Fallback ${fallback.name} failed: ${fallbackResult.error}`
          } catch (error) {
            finalError = `${finalError} Fallback ${fallback.name} failed: ${
              error instanceof Error ? error.message : 'The printer transport failed.'
            }`
          }
        }
      }
      if (retry + 1 < retryLimit) {
        const queued = { ...sending, status: 'queued' as const, attempts, lastError: finalError.slice(0, 500) }
        commitDb((previous) => ({
          ...previous,
          printJobs: previous.printJobs.map((entry) => entry.id === job.id ? queued : entry),
        }))
        await new Promise((resolve) => window.setTimeout(resolve, Math.min(5000, 500 * (2 ** retry))))
      }
    }
    const failed: PrintJob = {
      ...job,
      status: 'failed',
      attempts,
      lastError: `${finalError}${fallbackName ? ` (fallback printer tried: ${fallbackName})` : ''}`.slice(0, 500),
    }
    commitDb((previous) => ({
      ...previous,
      printJobs: previous.printJobs.map((entry) => entry.id === job.id ? failed : entry),
    }))
    return { ok: false, error: failed.lastError ?? finalError }
  }, [commitDb, dbRef, provider, requireActor])

  const enqueuePrint = useCallback<AppContextValue['enqueuePrint']>(async (
    input: EnqueuePrintInput,
  ): Promise<PrintJobResult> => {
    const actorResult = requireActor()
    if (!actorResult.ok) return actorResult
    const storeId = actorResult.actor.storeId
    if (!storeId) return { ok: false, error: 'The logged-in account is not assigned to a store.' }
    if (!isPrintJobType(input.type) || !isValidPrintPayload(input.payload)) {
      return { ok: false, error: 'The print job is not valid.' }
    }
    if (input.stationId && !dbRef.current.stations.some((entry) =>
      entry.id === input.stationId && entry.storeId === storeId,
    )) return { ok: false, error: 'The print job station is not in this store.' }
    const printer = input.printerId
      ? dbRef.current.printers.find((candidate) =>
        candidate.id === input.printerId && candidate.storeId === storeId && candidate.enabled,
      )
      : resolvePrintPrinter(dbRef.current, storeId, input.type, input.stationId)
    if (input.printerId && !printer) return { ok: false, error: 'The selected printer is disabled or unavailable.' }
    if (!printer) return { ok: false, error: 'No enabled printer is configured for this print job.' }
    const job: PrintJob = {
      id: uid('print'),
      storeId,
      type: input.type,
      stationId: input.stationId,
      printerId: printer.id,
      payload: input.payload.map((line) => ({ ...line, text: line.text.slice(0, 2000) })),
      copies: printer.copies,
      createdById: actorResult.actor.id,
      createdAt: new Date().toISOString(),
      status: 'queued',
      attempts: 0,
      openDrawer: input.openDrawer,
    }
    commitDb((previous) => ({ ...previous, printJobs: [...previous.printJobs, job] }))
    return executeJob(job)
  }, [commitDb, dbRef, executeJob, requireActor])

  const retryPrintJob = useCallback<AppContextValue['retryPrintJob']>(async (id) => {
    const job = dbRef.current.printJobs.find((entry) => entry.id === id)
    if (!job) return { ok: false, error: 'Print job not found.' }
    if (job.status !== 'failed' && job.status !== 'queued') {
      return { ok: false, error: 'Only queued or failed jobs can be retried.' }
    }
    return executeJob(job)
  }, [dbRef, executeJob])

  const printPendingHere = useCallback<AppContextValue['printPendingHere']>(async (id) => {
    const job = dbRef.current.printJobs.find((entry) => entry.id === id)
    if (!job || job.status !== 'queued') return { ok: false, error: 'Queued print job not found.' }
    const actorResult = requireActor(job.storeId)
    if (!actorResult.ok) return actorResult
    if (actorResult.actor.id !== job.createdById && !can(actorResult.actor, 'manageSettings')) {
      return { ok: false, error: 'Only the print-job owner or a settings manager can print this job here.' }
    }
    if (provider.mode !== 'hub' || !provider.beginLocalPrintFallback(job.id)) {
      return { ok: false, error: 'This print job may already have reached the hub; retry it there to avoid a duplicate.' }
    }
    const localPrinter = dbRef.current.printers.find((printer) =>
      printer.storeId === job.storeId && printer.enabled &&
      printer.connection === 'browser-webserial' && hasPrintCapability(printer),
    )
    if (!localPrinter) {
      await provider.finishLocalPrintFallback(job.id, false)
      return { ok: false, error: 'No available WebSerial printer is configured on this device.' }
    }
    try {
      const result = await sendToPrintTransport(
        { ...job, printerId: localPrinter.id },
        localPrinter,
        'this-device',
      )
      await provider.finishLocalPrintFallback(job.id, result.ok)
      if (!result.ok) return { ok: false, error: result.error }
      const printed = {
        ...job,
        status: 'printed' as const,
        lastError: `Printed here via ${localPrinter.name} while the hub was offline.`,
      }
      commitDb((previous) => ({
        ...previous,
        printJobs: previous.printJobs.map((entry) => entry.id === job.id ? printed : entry),
      }))
      return { ok: true, job: printed }
    } catch (error) {
      await provider.finishLocalPrintFallback(job.id, false)
      return { ok: false, error: error instanceof Error ? error.message : 'Local printer failed.' }
    }
  }, [commitDb, dbRef, provider, requireActor])

  const cancelPrintJob = useCallback<AppContextValue['cancelPrintJob']>((id): Result => {
    const job = dbRef.current.printJobs.find((entry) => entry.id === id)
    if (!job) return { ok: false, error: 'Print job not found.' }
    const actorResult = requireCapability(job.storeId, 'manageSettings')
    if (!actorResult.ok) return actorResult
    if (job.status !== 'queued' && job.status !== 'failed') {
      return { ok: false, error: 'Only queued or failed jobs can be cancelled.' }
    }
    commitDb((previous) => ({
      ...previous,
      printJobs: previous.printJobs.map((entry) =>
        entry.id === id ? { ...entry, status: 'cancelled' } : entry,
      ),
    }))
    return { ok: true }
  }, [commitDb, dbRef, requireCapability])

  return {
    addPrinter,
    updatePrinter,
    deletePrinter,
    setPrintRoute,
    enqueuePrint,
    retryPrintJob,
    printPendingHere,
    cancelPrintJob,
  }
}

/**
 * WebSerial ESC/POS bridge.
 *
 * Real byte-level printing for USB thermal printers exposed through the Web
 * Serial API (Chrome / Edge desktop — see docs/PRODUCTION_PLAN.md for the
 * support matrix). The browser-print dialog is used as fallback when no
 * serial connection exists.
 *
 * The bridge:
 *  - asks the user to pick a port once (requestPort),
 *  - re-opens previously authorized ports silently on later visits (getPorts),
 *  - keeps a read loop draining status bytes so printers with ACK/flow
 *    control do not stall after the first job,
 *  - writes payloads in small chunks with backpressure handling.
 */

export interface PrinterState {
  supported: boolean
  connected: boolean
  label: string | null
  busy: boolean
}

type Listener = (state: PrinterState) => void

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  getInfo?(): { usbVendorId?: number; usbProductId?: number }
}

interface SerialLike {
  requestPort(options?: { filters?: unknown[] }): Promise<SerialPortLike>
  getPorts(): Promise<SerialPortLike[]>
}

const getSerial = (): SerialLike | null => {
  if (typeof navigator === 'undefined') return null
  return (navigator as unknown as { serial?: SerialLike }).serial ?? null
}

export const isWebSerialSupported = () => getSerial() !== null

let port: SerialPortLike | null = null
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null
let busy = false
const listeners = new Set<Listener>()

const portLabel = (p: SerialPortLike) => {
  const info = p.getInfo?.()
  if (info?.usbVendorId !== undefined) {
    return `USB ${info.usbVendorId.toString(16).padStart(4, '0')}:${(info.usbProductId ?? 0)
      .toString(16)
      .padStart(4, '0')}`
  }
  return 'Serial port'
}

const getState = (): PrinterState => ({
  supported: isWebSerialSupported(),
  connected: port !== null && writer !== null,
  label: port ? portLabel(port) : null,
  busy,
})

const notify = () => {
  const state = getState()
  listeners.forEach((fn) => fn(state))
}

/** Subscribe to connection changes. Returns an unsubscribe function. */
export const onPrinterState = (fn: Listener) => {
  listeners.add(fn)
  fn(getState())
  return () => {
    listeners.delete(fn)
  }
}

export const printerState = getState

/** Start a background read loop so ACK-bearing printers never stall. */
const startDrain = (p: SerialPortLike) => {
  if (!p.readable) return
  const r = p.readable.getReader()
  reader = r
  ;(async () => {
    try {
      for (;;) {
        const { done } = await r.read()
        if (done) break
        // Status bytes are intentionally discarded.
      }
    } catch {
      /* port closed or unplugged */
    }
  })()
}

const openPort = async (p: SerialPortLike, baudRate: number) => {
  await p.open({ baudRate })
  port = p
  startDrain(p)
  writer = p.writable ? p.writable.getWriter() : null
  if (!writer) throw new Error('This port cannot be written to.')
  notify()
}

/** Ask the user to choose a printer port and open it. */
export const connectPrinter = async (
  baudRate = 9600,
): Promise<{ ok: true; label: string } | { ok: false; error: string }> => {
  const serial = getSerial()
  if (!serial) {
    return {
      ok: false,
      error: 'WebSerial is not available. Use Chrome or Edge on a desktop computer.',
    }
  }
  if (port) return { ok: true, label: portLabel(port) }
  try {
    const p = await serial.requestPort()
    await openPort(p, baudRate)
    return { ok: true, label: portLabel(p) }
  } catch (e) {
    const message = e instanceof Error && e.name === 'NotFoundError'
      ? 'No printer was selected.'
      : 'Could not open the printer. Close other apps using it and try again.'
    return { ok: false, error: message }
  }
}

/** Silently re-open a port the user already authorized for this site. */
export const restorePrinter = async (baudRate = 9600) => {
  const serial = getSerial()
  if (!serial || port) return
  try {
    const ports = await serial.getPorts()
    if (ports.length) await openPort(ports[0], baudRate)
  } catch {
    /* silent — the user can connect manually */
  }
}

export const disconnectPrinter = async () => {
  try {
    await reader?.cancel()
  } catch { /* ignore */ }
  reader = null
  try {
    await writer?.releaseLock()
  } catch { /* ignore */ }
  writer = null
  try {
    await port?.close()
  } catch { /* ignore */ }
  port = null
  notify()
}

/** Write a full ESC/POS payload. Resolves when the printer has accepted it. */
export const printBytes = async (data: Uint8Array): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (!port || !writer) {
    return { ok: false, error: 'No printer connected.' }
  }
  if (busy) return { ok: false, error: 'Printer is busy — wait for the current job.' }
  busy = true
  notify()
  try {
    const CHUNK = 512
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.subarray(i, Math.min(data.length, i + CHUNK))
      await writer.write(chunk as Uint8Array<ArrayBuffer>)
      if (writer.desiredSize !== null && writer.desiredSize <= 0) {
        await new Promise((r) => setTimeout(r, 20))
      }
    }
    return { ok: true }
  } catch {
    // The port died mid-job (unplugged). Reset so the user can reconnect.
    try { await writer?.releaseLock() } catch { /* ignore */ }
    writer = null
    port = null
    return { ok: false, error: 'The printer stopped responding. Reconnect and try again.' }
  } finally {
    busy = false
    notify()
  }
}

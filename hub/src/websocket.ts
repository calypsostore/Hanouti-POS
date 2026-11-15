import { createHash } from 'node:crypto'
import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import type { AuthenticatedActor } from './types.ts'
import { can, type HubAuth } from './auth.ts'

interface Client {
  socket: Duplex
  actor: AuthenticatedActor | null
  token?: string
  buffer: Buffer
  messageCount: number
  messageWindow: number
  sendQueue: Promise<void>
}

const MAX_FRAME = 65_536

function frame(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value))
  if (body.length > MAX_FRAME) throw new Error('WebSocket message too large.')
  if (body.length < 126) return Buffer.concat([Buffer.from([0x81, body.length]), body])
  const header = Buffer.alloc(4)
  header[0] = 0x81
  header[1] = 126
  header.writeUInt16BE(body.length, 2)
  return Buffer.concat([header, body])
}

export class HubWebSocket {
  private clients = new Set<Client>()
  private readonly auth: HubAuth
  private readonly onMessage: (actor: AuthenticatedActor, message: Record<string, unknown>) => Promise<void>
  private readonly originAllowed: (origin: string | undefined, request: IncomingMessage) => boolean

  constructor(
    server: Server,
    auth: HubAuth,
    onMessage: (actor: AuthenticatedActor, message: Record<string, unknown>) => Promise<void>,
    originAllowed: (origin: string | undefined, request: IncomingMessage) => boolean,
  ) {
    this.auth = auth
    this.onMessage = onMessage
    this.originAllowed = originAllowed
    server.on('upgrade', (request, socket) => this.upgrade(request, socket))
  }

  private upgrade(request: IncomingMessage, socket: Duplex): void {
    if (request.url?.split('?')[0] !== '/ws' || request.headers.upgrade?.toLowerCase() !== 'websocket') {
      socket.end('HTTP/1.1 404 Not Found\r\n\r\n')
      return
    }
    if (!this.originAllowed(typeof request.headers.origin === 'string' ? request.headers.origin : undefined, request)) {
      console.log('WebSocket origin denied.')
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
      return
    }
    const key = request.headers['sec-websocket-key']
    if (typeof key !== 'string' || request.headers['sec-websocket-version'] !== '13') {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      return
    }
    const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
    const client: Client = {
      socket, actor: null, buffer: Buffer.alloc(0), messageCount: 0,
      messageWindow: Date.now() + 60_000, sendQueue: Promise.resolve(),
    }
    this.clients.add(client)
    socket.on('data', (data) => this.read(client, data))
    socket.on('close', () => this.clients.delete(client))
    socket.on('error', () => this.clients.delete(client))
  }

  private read(client: Client, chunk: Buffer): void {
    client.buffer = Buffer.concat([client.buffer, chunk])
    if (client.buffer.length > MAX_FRAME + 14) {
      client.socket.destroy()
      return
    }
    while (client.buffer.length >= 2) {
      const first = client.buffer[0]
      const second = client.buffer[1]
      const opcode = first & 0x0f
      let length = second & 0x7f
      let offset = 2
      if (length === 126) {
        if (client.buffer.length < 4) return
        length = client.buffer.readUInt16BE(2)
        offset = 4
      } else if (length === 127) {
        client.socket.destroy()
        return
      }
      const masked = (second & 0x80) !== 0
      if (!masked || length > MAX_FRAME) {
        client.socket.destroy()
        return
      }
      if (client.buffer.length < offset + 4 + length) return
      const mask = client.buffer.subarray(offset, offset + 4)
      const payload = Buffer.from(client.buffer.subarray(offset + 4, offset + 4 + length))
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4]
      client.buffer = client.buffer.subarray(offset + 4 + length)
      if (opcode === 8) {
        client.socket.end(Buffer.from([0x88, 0x00]))
        this.clients.delete(client)
        return
      }
      if (opcode === 9) {
        client.socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]))
        continue
      }
      if (opcode !== 1) {
        client.socket.destroy()
        return
      }
      void this.handle(client, payload.toString('utf8'))
    }
  }

  private async handle(client: Client, raw: string): Promise<void> {
    try {
      if (client.messageWindow <= Date.now()) {
        client.messageWindow = Date.now() + 60_000
        client.messageCount = 0
      }
      client.messageCount += 1
      if (client.messageCount > 120) {
        this.clients.delete(client)
        client.socket.destroy()
        return
      }
      const message: unknown = JSON.parse(raw)
      if (!message || typeof message !== 'object') throw new Error('Invalid WebSocket message.')
      const candidate = message as Record<string, unknown>
      if (!client.actor && candidate.type === 'auth') {
        let actor = this.auth.authenticate(typeof candidate.token === 'string' ? candidate.token : undefined)
        if (!actor && typeof candidate.deviceId === 'string' && typeof candidate.token === 'string') {
          actor = await this.auth.authenticateDevice(candidate.deviceId, candidate.token)
        }
        if (!actor) throw new Error('WebSocket authentication failed.')
        client.actor = actor
        client.token = typeof candidate.token === 'string' ? candidate.token : undefined
        client.socket.write(frame({ type: 'connected', storeId: actor.storeId, stationIds: actor.stationIds ?? [] }))
        return
      }
      if (!client.actor) throw new Error('Authenticate before sending messages.')
      const current = client.actor.deviceToken
        ? await this.auth.authenticateDevice(client.actor.deviceId ?? '', client.token ?? '')
        : this.auth.authenticate(client.token)
      const refreshed = current?.deviceToken ? current : current ? await this.auth.refreshActor(current) : null
      if (!refreshed) throw new Error('WebSocket session has expired or been revoked.')
      client.actor = refreshed
      await this.onMessage(client.actor, candidate)
    } catch (error) {
      client.socket.write(frame({ type: 'error', error: error instanceof Error ? error.message : 'Invalid WebSocket message.' }))
    }
  }

  broadcast(storeId: string, value: unknown, stationIds?: string[]): void {
    for (const client of this.clients) {
      if (!client.actor || client.actor.storeId !== storeId) continue
      client.sendQueue = client.sendQueue.then(async () => {
        if (!client.actor || client.socket.destroyed) return
        const current = client.actor.deviceToken
          ? await this.auth.authenticateDevice(client.actor.deviceId ?? '', client.token ?? '')
          : this.auth.authenticate(client.token)
        const actor = current?.deviceToken ? current : current ? await this.auth.refreshActor(current) : null
        if (!actor || actor.storeId !== storeId) {
          this.clients.delete(client)
          client.socket.destroy()
          return
        }
        client.actor = actor
        if (actor.stationOnly && stationIds && !stationIds.some((id) => actor.stationIds?.includes(id))) return
        if (value && typeof value === 'object' && (value as Record<string, unknown>).type === 'station-status' &&
          !actor.stationOnly && !can(actor, 'viewStation')) return
        client.socket.write(frame(value))
      }).catch((error: unknown) => {
        console.error(`WebSocket broadcast failed: ${error instanceof Error ? error.message : 'unknown error'}`)
        this.clients.delete(client)
        client.socket.destroy()
      })
    }
  }

  countByStore(storeId: string, deviceOnly?: boolean): number {
    return [...this.clients].filter((client) =>
      client.actor?.storeId === storeId &&
      (deviceOnly === undefined || client.actor.deviceToken === deviceOnly),
    ).length
  }
}

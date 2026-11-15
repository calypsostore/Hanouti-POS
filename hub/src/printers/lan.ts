import { connect } from 'node:net'
import { networkInterfaces } from 'node:os'

export async function discoverRawPrinters(): Promise<string[]> {
  const addresses = Object.values(networkInterfaces()).flatMap((items) =>
    (items ?? []).filter((item) => item.family === 'IPv4' && !item.internal).map((item) => item.address),
  )
  const candidates = new Set<string>()
  for (const address of addresses) {
    const octets = address.split('.')
    if (octets.length !== 4 || octets.some((part) => !/^\d+$/.test(part))) continue
    const subnet = octets.slice(0, 3).join('.')
    for (let host = 1; host <= 254; host += 1) {
      const target = `${subnet}.${host}`
      if (target !== address) candidates.add(target)
    }
  }
  const pending = [...candidates]
  const found: string[] = []
  const scan = async () => {
    while (pending.length) {
      const host = pending.pop()
      if (!host) return
      await new Promise<void>((resolve) => {
        const socket = connect({ host, port: 9100 })
        const finish = (open: boolean) => {
          if (open) found.push(host)
          socket.destroy()
          resolve()
        }
        socket.setTimeout(400)
        socket.once('connect', () => finish(true))
        socket.once('timeout', () => finish(false))
        socket.once('error', () => finish(false))
      })
    }
  }
  await Promise.all(Array.from({ length: Math.min(24, pending.length) }, scan))
  return found.sort()
}

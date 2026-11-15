import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { statfs } from 'node:fs/promises'
import { X509Certificate } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { connect } from 'node:net'
import { access } from 'node:fs/promises'
import { HubStorage } from './storage.ts'

const execFileAsync = promisify(execFile)
const checks: Array<{ name: string; ok: boolean; detail: string }> = []
const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail })

async function main(): Promise<void> {
  const runtimeMajor = Number(process.versions.node.split('.')[0])
  add('Node.js', runtimeMajor >= 22, `Detected Node ${process.versions.node}; Node 22 or newer is required.`)
  const host = process.env.HUB_HOST ?? Object.values(networkInterfaces()).flatMap((items) => items ?? [])
    .find((item) => item.family === 'IPv4' && !item.internal)?.address ?? '127.0.0.1'
  const port = Number(process.env.HUB_PORT ?? 8080)
  let portOpen = false
  try {
    const server = await import('node:net').then(({ createServer }) => createServer())
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => { portOpen = true; server.close(() => resolve()) })
    })
  } catch (error) {
    add('Hub port', false, `Cannot bind ${host}:${port}: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
  if (portOpen) add('Hub port', true, `${host}:${port} is available`)
  add('LAN IP', host !== '127.0.0.1', host === '127.0.0.1' ? 'Only loopback was detected; configure HUB_HOST for LAN use.' : host)
  const tlsKey = process.env.HUB_TLS_KEY
  const tlsCert = process.env.HUB_TLS_CERT
  if (tlsKey && tlsCert) {
    try {
      const { readFile } = await import('node:fs/promises')
      const cert = new X509Certificate(await readFile(tlsCert))
      const expired = Date.parse(cert.validTo) <= Date.now()
      const matchesHost = host === '127.0.0.1' || host === 'localhost'
        ? cert.checkHost(host) === host
        : cert.checkIP(host) === host
      add('TLS certificate', !expired && matchesHost, expired
        ? `Certificate expired ${cert.validTo}`
        : matchesHost ? `Valid for ${host} through ${cert.validTo}` : `Certificate SAN does not match ${host}.`)
      await access(tlsKey)
    } catch (error) {
      add('TLS certificate', false, error instanceof Error ? error.message : 'Could not read certificate.')
    }
  } else add('TLS certificate', false, 'HTTPS is not enabled (HUB_TLS_KEY/HUB_TLS_CERT are unset).')
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-NetFirewallProfile | Select-Object -ExpandProperty Enabled | ConvertTo-Json -Compress'], { timeout: 5000 })
      const enabled = stdout.trim() !== '' && !/\bfalse\b|\b0\b/i.test(stdout)
      add('Firewall', enabled, `Windows firewall profile status: ${stdout.trim() || 'query returned no output'}`)
    } else {
      try {
        const { stdout } = await execFileAsync('ufw', ['status'], { timeout: 5000 })
        add('Firewall', true, stdout.trim().split(/\r?\n/)[0] ?? 'ufw responded')
      } catch {
        add('Firewall', false, 'Could not query ufw. Confirm the OS firewall allows only trusted shop LAN devices.')
      }
    }
  } catch (error) {
    add('Firewall', false, error instanceof Error ? error.message : 'Firewall check failed.')
  }
  const storage = new HubStorage()
  await storage.initialize()
  try {
    const filesystem = await statfs(storage.root)
    const freeBytes = Number(filesystem.bavail) * Number(filesystem.bsize)
    add('Disk space', freeBytes >= 1024 * 1024 * 512, `${(freeBytes / (1024 ** 3)).toFixed(2)} GiB free at ${storage.root}`)
  } catch (error) {
    add('Disk space', false, error instanceof Error ? error.message : 'Could not inspect hub data directory.')
  }
  const stores = await storage.listStoreIds()
  for (const storeId of stores) {
    const state = await storage.readStore(storeId)
    const printers = Object.values(state.collections.printers ?? {}) as Array<Record<string, unknown>>
    if (!printers.length) add(`Printers ${storeId}`, true, 'No printers configured.')
    for (const printer of printers) {
      if (printer.enabled !== true) {
        add(`Printer ${String(printer.name)}`, true, 'Disabled in store configuration.')
        continue
      }
      if (printer.connection === 'hub-tcp' || printer.connection === 'hub-epson-epos' || printer.connection === 'hub-star') {
        const cloud = printer.connection === 'hub-star' && printer.host === 'cloudprnt'
        const printerHost = typeof printer.host === 'string' ? printer.host : ''
        if (cloud) add(`Printer ${String(printer.name)}`, true, 'CloudPRNT pull mode configured; remote reachability is checked by printer polling.')
        else {
          const portNumber = typeof printer.port === 'number' ? printer.port : printer.connection === 'hub-tcp' ? 9100 : 80
          const reachable = await probeTcp(printerHost, portNumber)
          add(`Printer ${String(printer.name)}`, reachable, reachable
            ? `TCP ${printerHost}:${portNumber} accepts connections.`
            : `TCP ${printerHost}:${portNumber} did not respond.`)
        }
      } else {
        add(`Printer ${String(printer.name)}`, true, `${String(printer.connection)} configured; OS device health is not probed.`)
      }
    }
  }
  if (!stores.length) add('Printers', true, 'No store configured yet.')
  console.log('\n7anouti Hub doctor')
  console.log(checks.map((check) => `${check.ok ? 'PASS' : 'WARN'}  ${check.name}: ${check.detail}`).join('\n'))
  console.log(`\n${checks.filter((check) => !check.ok).length} warning(s).`)
  if (!portOpen) process.exitCode = 1
}

function probeTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port })
    let finished = false
    const done = (reachable: boolean) => {
      if (finished) return
      finished = true
      socket.destroy()
      resolve(reachable)
    }
    socket.setTimeout(1500)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Hub doctor failed.')
  process.exitCode = 1
})

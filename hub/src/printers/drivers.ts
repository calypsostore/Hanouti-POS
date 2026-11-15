import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { open } from 'node:fs/promises'
import { linesToEscpos } from '../../../src/shared/escpos.ts'
import type { PrinterRecord, PrintJobRecord } from './queue.ts'
import { sendEpos } from './epos.ts'
import { sendStarWebPrnt } from './star.ts'

export function renderJob(job: PrintJobRecord, printer: PrinterRecord): Uint8Array {
  const lines = job.payload.map((line) => ({
    text: line.text,
    align: line.align,
    bold: line.bold,
    size: line.size,
  }))
  return linesToEscpos(lines, printer.paperWidth === 80 ? 80 : 58, {
    codepage: printer.codepage,
    cutMode: printer.cutMode,
    openDrawer: job.openDrawer === true,
  })
}

async function writeTcp(host: string, port: number, bytes: Uint8Array): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port })
    socket.setTimeout(5_000)
    socket.once('connect', () => socket.end(Buffer.from(bytes), resolve))
    socket.once('timeout', () => socket.destroy(new Error('Printer connection timed out.')))
    socket.once('error', reject)
  })
}

function command(program: string, args: string[], bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true })
    let error = ''
    child.stderr.on('data', (chunk: Buffer) => { error += chunk.toString().slice(0, 2048) })
    child.once('error', reject)
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(error || `${program} exited with code ${code}.`)))
    child.stdin.end(Buffer.from(bytes))
  })
}

async function printOs(printerName: string | undefined, bytes: Uint8Array): Promise<void> {
  if (!printerName) throw new Error('OS printer name is not configured.')
  if (process.platform === 'win32') {
    const script = `$b=[Convert]::FromBase64String('${Buffer.from(bytes).toString('base64')}');$n='${printerName.replace(/'/g, "''")}';Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class RawSpool{[DllImport("winspool.drv",SetLastError=true,CharSet=CharSet.Unicode)]public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr d);[DllImport("winspool.drv",SetLastError=true)]public static extern bool ClosePrinter(IntPtr h);[DllImport("winspool.drv",SetLastError=true,CharSet=CharSet.Unicode)]public static extern int StartDocPrinter(IntPtr h,int l,IntPtr d);[DllImport("winspool.drv",SetLastError=true)]public static extern bool EndDocPrinter(IntPtr h);[DllImport("winspool.drv",SetLastError=true)]public static extern bool StartPagePrinter(IntPtr h);[DllImport("winspool.drv",SetLastError=true)]public static extern bool EndPagePrinter(IntPtr h);[DllImport("winspool.drv",SetLastError=true)]public static extern bool WritePrinter(IntPtr h,byte[] b,int c,out int w);[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct DOC{public string n;public string o;public string t;public string m;public string d;}}';$h=[IntPtr]::Zero;if(-not[RawSpool]::OpenPrinter($n,[ref]$h,[IntPtr]::Zero)){throw 'OpenPrinter failed'};$doc=New-Object RawSpool+DOC;$doc.n='7anouti raw job';$doc.t='RAW';$p=[Runtime.InteropServices.Marshal]::AllocHGlobal([Runtime.InteropServices.Marshal]::SizeOf($doc));[Runtime.InteropServices.Marshal]::StructureToPtr($doc,$p,$false);try{[RawSpool]::StartDocPrinter($h,1,$p)|Out-Null;[RawSpool]::StartPagePrinter($h)|Out-Null;$w=0;if(-not[RawSpool]::WritePrinter($h,$b,$b.Length,[ref]$w)){throw 'WritePrinter failed'};[RawSpool]::EndPagePrinter($h)|Out-Null;[RawSpool]::EndDocPrinter($h)|Out-Null}finally{[Runtime.InteropServices.Marshal]::FreeHGlobal($p);[RawSpool]::ClosePrinter($h)|Out-Null}`
    await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], new Uint8Array())
    return
  }
  await command('lp', ['-d', printerName, '-o', 'raw'], bytes)
}

async function writeDevice(path: string | undefined, bytes: Uint8Array): Promise<void> {
  if (!path || !path.startsWith('/dev/')) throw new Error('A /dev/ device path is required.')
  const handle = await open(path, 'w')
  try { await handle.write(Buffer.from(bytes)); await handle.sync() } finally { await handle.close() }
}

async function writeSerial(path: string | undefined, baudRate: number, bytes: Uint8Array): Promise<void> {
  if (process.platform === 'win32') {
    if (!path || !/^COM\d+$/i.test(path)) throw new Error('Serial port must be a COM port, such as COM3.')
    const script = `$p=New-Object System.IO.Ports.SerialPort('${path.toUpperCase()}',${Math.max(300, Math.min(115200, baudRate))});$p.Open();try{$b=[Convert]::FromBase64String('${Buffer.from(bytes).toString('base64')}');$p.Write($b,0,$b.Length)}finally{$p.Close()}`
    await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], new Uint8Array())
    return
  }
  await writeDevice(path, bytes)
}

export async function sendToPrinter(job: PrintJobRecord, printer: PrinterRecord): Promise<void> {
  const bytes = renderJob(job, printer)
  const host = typeof printer.host === 'string' ? printer.host : ''
  switch (printer.connection) {
    case 'hub-tcp': return writeTcp(host, printer.port || 9100, bytes)
    case 'hub-usb':
      if (printer.osPrinterName) return printOs(printer.osPrinterName, bytes)
      return writeDevice(host, bytes)
    case 'hub-serial': return writeSerial(host, printer.baudRate || 9600, bytes)
    case 'hub-epson-epos': return sendEpos(host, printer.port || 80, job)
    case 'hub-star': return sendStarWebPrnt(host, printer.port || 80, job)
    default: throw new Error(`Unsupported hub printer connection: ${printer.connection}.`)
  }
}

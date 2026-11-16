import { registerPlugin } from '@capacitor/core'

export interface TcpPrinterPlugin {
  send(options: {
    host: string
    port?: number
    data: string
  }): Promise<{ ok: boolean; error?: string }>
}

export const TcpPrinter = registerPlugin<TcpPrinterPlugin>('TcpPrinter')

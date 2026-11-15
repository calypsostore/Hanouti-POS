import type { Database, PrintJobType, Printer } from '../types'

export const resolvePrintPrinter = (
  database: Pick<Database, 'printers' | 'printRoutes' | 'stations'>,
  storeId: string,
  type: PrintJobType,
  stationId?: string,
): Printer | undefined => {
  const stationRoute = stationId ? database.printRoutes.find((candidate) =>
    candidate.storeId === storeId && candidate.type === type && candidate.stationId === stationId,
  ) : undefined
  const genericRoute = database.printRoutes.find((candidate) =>
    candidate.storeId === storeId && candidate.type === type && candidate.stationId === undefined,
  )
  const station = stationId
    ? database.stations.find((candidate) => candidate.id === stationId && candidate.storeId === storeId)
    : undefined
  const selectedId = stationRoute?.printerId ?? station?.printerId ?? genericRoute?.printerId
  if (selectedId) {
    return database.printers.find((printer) =>
      printer.id === selectedId && printer.storeId === storeId && printer.enabled,
    )
  }
  const stationPrinterIds = new Set([
    ...database.stations.map((entry) => entry.printerId).filter((id): id is string => !!id),
    ...database.printRoutes.filter((entry) => entry.stationId)
      .map((entry) => entry.printerId).filter((id): id is string => !!id),
  ])
  return database.printers.find((printer) =>
    printer.storeId === storeId && printer.enabled && !stationPrinterIds.has(printer.id),
  )
}

import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { createReadStream } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { isIP } from 'node:net'
import { networkInterfaces } from 'node:os'
import { extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HubAuth, can, requireCapability } from './auth.ts'
import type { AuthenticatedActor } from './types.ts'
import { HubStorage } from './storage.ts'
import { HubPrintQueue } from './printers/queue.ts'
import type { PrintJobRecord, PrinterRecord } from './printers/queue.ts'
import { discoverRawPrinters } from './printers/lan.ts'
import { startVirtualPrinter } from './printers/virtual-printer.ts'
import { qrSvg } from './qr.ts'
import { HubWebSocket } from './websocket.ts'
import { logEvent } from './logger.ts'
import { MAX_BODY_BYTES, record, requireString, validId, validateStoreDoc } from './validation.ts'
import { mergeOpenOrderDocument, type SyncDocument } from '../../src/shared/sync.ts'
import { planStockDeductions, stockKey } from '../../src/shared/orderRules.ts'
import { stationBoardHtml } from './board.ts'
import { validateOrderDocument } from './orderValidation.ts'
import { validateLedgerEntry } from './ledgerValidation.ts'
import { isUnavailable } from '../../src/shared/availability.ts'
import { balanceFor } from '../../src/lib/selectors.ts'
import type { InventoryItem, LedgerEntry, OrderItem, Product, Shift, Store, StoreSettings } from '../../src/types.ts'
import { shiftOpenScheduleError, normalizeShiftAccessSettings } from '../../src/lib/shiftAccess.ts'
import { PIN_MAX_LENGTH } from '../../src/shared/pin.ts'
import { round } from '../../src/lib/pricing-utils.ts'
import { isQuick, normalizeCashierModeSettings } from '../../src/lib/posMode.ts'

const RATE_WINDOW = 60_000
const RATE_LIMIT = 120
const loginLimits = new Map<string, { count: number; reset: number }>()
const websocketLimits = new Map<string, { count: number; reset: number }>()
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
}
const PRIVATE_COLLECTIONS: Record<string, string> = {
  users: 'manageStaff', stations: 'manageSettings', stationDevices: 'manageSettings',
  printers: 'manageSettings', printRoutes: 'manageSettings', stores: 'manageSettings',
  products: 'manageProducts', categories: 'manageProducts',
  expenses: 'expenses', inventoryItems: 'manageInventory', stockMovements: 'manageInventory',
  purchases: 'recordPurchases', purchasePayments: 'recordPurchases',
  payrolls: 'managePayroll', advances: 'managePayroll', suppliers: 'recordPurchases',
  cashDifferences: 'manageCashDifferences',
  ledger: 'ledger',
}
const ORDER_COLLECTIONS = new Set(['orders', 'openOrders', 'orderItems', 'payments'])
const localDateKey = (value: string): string => {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const isQuickStoreDocument = (value: unknown): boolean =>
  record(value) && record(value.settings) &&
  normalizeCashierModeSettings(value.settings.posMode, value.settings.cashierModeEnabled).posMode === 'quick'

function isAvailabilityOnlyProductChange(
  previous: unknown,
  incoming: unknown,
  storeId: string,
  allowed: boolean,
): boolean {
  if (!allowed || !record(previous) || !record(incoming) ||
    previous.storeId !== storeId || incoming.storeId !== storeId) return false
  const stripAvailability = (document: Record<string, unknown>) => {
    const copy = { ...document }
    delete copy.eightySix
    if (Array.isArray(copy.variants)) {
      copy.variants = copy.variants.map((variant) => {
        if (!record(variant)) return variant
        const normalized = { ...variant }
        delete normalized.eightySix
        return normalized
      })
    }
    return copy
  }
  const availabilityChanged =
    !isDeepStrictEqual(previous.eightySix, incoming.eightySix) ||
    !isDeepStrictEqual(previous.variants, incoming.variants)
  return availabilityChanged && isDeepStrictEqual(stripAvailability(previous), stripAvailability(incoming))
}

function productAvailabilityChanged(previous: Record<string, unknown>, incoming: Record<string, unknown>): boolean {
  const snapshot = (document: Record<string, unknown>) => ({
    eightySix: document.eightySix,
    variants: Array.isArray(document.variants)
      ? document.variants.flatMap((variant) => record(variant) && typeof variant.id === 'string'
        ? [{ id: variant.id, eightySix: variant.eightySix }]
        : [])
      : [],
  })
  return !isDeepStrictEqual(snapshot(previous), snapshot(incoming))
}

function normalizeHubAvailability(value: unknown): Record<string, unknown> {
  const source = record(value) ? value : {}
  const reasons = Array.isArray(source.reasons)
    ? source.reasons.filter((reason): reason is string => typeof reason === 'string')
      .map((reason) => reason.trim().slice(0, 120)).filter(Boolean).slice(0, 20)
    : ['Out of stock', 'Machine down', 'Not prepared today', 'Quality issue']
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
    autoEightySixAtZero: typeof source.autoEightySixAtZero === 'boolean' ? source.autoEightySixAtZero : true,
    autoReturnOnRestock: typeof source.autoReturnOnRestock === 'boolean' ? source.autoReturnOnRestock : true,
    requireReason: typeof source.requireReason === 'boolean' ? source.requireReason : true,
    reasons,
    defaultReturnMode: ['manual', 'on_restock', 'at_time'].includes(String(source.defaultReturnMode))
      ? source.defaultReturnMode
      : 'manual',
    resetManualAtDayStart: source.resetManualAtDayStart === true,
    resetManualAtFirstShift: source.resetManualAtFirstShift === true,
    displayStyle: source.displayStyle === 'dimmed_badge' ? 'dimmed_badge' : 'big_red_x',
    showListButton: typeof source.showListButton === 'boolean' ? source.showListButton : true,
    notifyStaffAboutChanges: typeof source.notifyStaffAboutChanges === 'boolean' ? source.notifyStaffAboutChanges : true,
    showCountOnStationScreens: typeof source.showCountOnStationScreens === 'boolean' ? source.showCountOnStationScreens : true,
  }
}

function normalizeHubEightySix(value: unknown): Record<string, unknown> | undefined {
  if (!record(value) || typeof value.active !== 'boolean' || typeof value.at !== 'string' ||
    !Number.isFinite(Date.parse(value.at)) || typeof value.byId !== 'string' ||
    !['manual', 'on_restock', 'at_time'].includes(String(value.returnMode))) return undefined
  return {
    active: value.active,
    at: value.at,
    byId: value.byId,
    reason: typeof value.reason === 'string' ? value.reason.trim().slice(0, 120) : undefined,
    returnMode: value.returnMode,
    backAt: typeof value.backAt === 'string' && Number.isFinite(Date.parse(value.backAt)) ? value.backAt : undefined,
  }
}

function normalizeHubRecipe(value: unknown): Array<{ inventoryItemId: string; qtyPerUnit: number }> | undefined {
  if (!Array.isArray(value)) return undefined
  const lines = value.flatMap((line) =>
    record(line) && typeof line.inventoryItemId === 'string' &&
    typeof line.qtyPerUnit === 'number' && Number.isFinite(line.qtyPerUnit) && line.qtyPerUnit > 0
      ? [{ inventoryItemId: line.inventoryItemId, qtyPerUnit: line.qtyPerUnit }]
      : [],
  )
  return lines.length ? lines : undefined
}

function normalizeHubOrderRules(value: unknown): Record<string, unknown> {
  const source = record(value) ? value : {}
  const roles = record(source.stockOverrideRoles) ? source.stockOverrideRoles : {}
  return {
    stockOverflowMode: ['block', 'warn', 'allow'].includes(String(source.stockOverflowMode))
      ? source.stockOverflowMode
      : 'warn',
    deductIngredientsOnSale: source.deductIngredientsOnSale === true,
    openOrderPricePolicy: ['keep', 'current', 'ask'].includes(String(source.openOrderPricePolicy))
      ? source.openOrderPricePolicy
      : 'keep',
    orderNumberFormat: ['plain', 'daily', 'prefix'].includes(String(source.orderNumberFormat))
      ? source.orderNumberFormat
      : 'plain',
    orderNumberPrefix: typeof source.orderNumberPrefix === 'string'
      ? source.orderNumberPrefix.trim().slice(0, 8)
      : '',
    showLowStockHints: source.showLowStockHints !== false,
    revalidationBanner: source.revalidationBanner !== false,
    stockOverrideRoles: {
      admin: roles.admin !== false,
      manager: roles.manager !== false,
      staff: roles.staff === true,
    },
  }
}

function normalizeHubCoffeeTracking(value: unknown): StoreSettings['coffeeTracking'] {
  const source = record(value) ? value : {}
  const min = typeof source.servingsPerKgMin === 'number' && Number.isFinite(source.servingsPerKgMin)
    ? Math.max(1, Math.min(1000, Math.round(source.servingsPerKgMin)))
    : 50
  return {
    enabled: source.enabled === true,
    inventoryItemId: typeof source.inventoryItemId === 'string' ? source.inventoryItemId.slice(0, 128) : undefined,
    servingsPerKgMin: min,
    servingsPerKgMax: typeof source.servingsPerKgMax === 'number' && Number.isFinite(source.servingsPerKgMax)
      ? Math.max(min, Math.min(1000, Math.round(source.servingsPerKgMax)))
      : Math.max(min, 70),
  }
}

function normalizeHubInventoryYieldTracking(value: unknown): StoreSettings['inventoryYieldTracking'] {
  const source = record(value) ? value : {}
  const seenItems = new Set<string>()
  const trackers = Array.isArray(source.trackers)
    ? source.trackers.flatMap((entry) => {
        if (!record(entry) || typeof entry.inventoryItemId !== 'string' ||
          typeof entry.referenceQuantity !== 'number' || !Number.isFinite(entry.referenceQuantity) ||
          entry.referenceQuantity < 0.001 || entry.referenceQuantity > 1_000_000_000 ||
          !Number.isSafeInteger(entry.servingsMin) || Number(entry.servingsMin) < 1 ||
          Number(entry.servingsMin) > 100_000 ||
          !Number.isSafeInteger(entry.servingsMax) || Number(entry.servingsMax) < Number(entry.servingsMin) ||
          Number(entry.servingsMax) > 100_000 ||
          !Array.isArray(entry.productIds) || !Array.isArray(entry.categoryIds)) return []
        const inventoryItemId = entry.inventoryItemId.trim().slice(0, 128)
        if (!inventoryItemId || seenItems.has(inventoryItemId)) return []
        seenItems.add(inventoryItemId)
        const uniqueIds = (ids: unknown[]) => [...new Set(ids
          .filter((id): id is string => typeof id === 'string' && !!id.trim())
          .map((id) => id.trim().slice(0, 128)))].slice(0, 200)
        return [{
          inventoryItemId,
          referenceQuantity: Math.round(entry.referenceQuantity * 1_000_000) / 1_000_000,
          servingsMin: Number(entry.servingsMin),
          servingsMax: Number(entry.servingsMax),
          productIds: uniqueIds(entry.productIds),
          categoryIds: uniqueIds(entry.categoryIds),
        }]
      })
    : []
  return { enabled: source.enabled === true, trackers }
}

function normalizeHubStaffConsumption(value: unknown): StoreSettings['staffConsumption'] {
  const source = record(value) ? value : {}
  const seen = new Set<string>()
  const allowances = Array.isArray(source.allowances)
    ? source.allowances.flatMap((entry) => {
        if (!record(entry) || typeof entry.productId !== 'string' ||
          !Number.isSafeInteger(entry.maxPerShift) || Number(entry.maxPerShift) < 1 ||
          Number(entry.maxPerShift) > 100) return []
        const productId = entry.productId.trim().slice(0, 128)
        if (!productId || seen.has(productId)) return []
        seen.add(productId)
        return [{ productId, maxPerShift: Number(entry.maxPerShift) }]
      }).slice(0, 200)
    : []
  return {
    enabled: source.enabled === true,
    pricing: source.pricing === 'full_price' || source.pricing === 'free' ? source.pricing : 'discount',
    discountPercent: typeof source.discountPercent === 'number' && Number.isFinite(source.discountPercent)
      ? Math.max(0, Math.min(100, source.discountPercent))
      : 0,
    allowances,
  }
}

function withoutProductAvailability(value: Record<string, unknown>): Record<string, unknown> {
  const copy = structuredClone(value)
  delete copy.eightySix
  if (Array.isArray(copy.variants)) {
    copy.variants = copy.variants.map((variant) => {
      if (!record(variant)) return variant
      const next = { ...variant }
      delete next.eightySix
      return next
    })
  }
  return copy
}

function setExpectedProductStock(
  expected: Map<string, number>,
  products: Product[],
  productId: string,
  variantId: string | undefined,
  quantity: number,
): void {
  const product = products.find((entry) => entry.id === productId)
  if (!product) return
  const key = stockKey(productId, variantId)
  const current = expected.get(key) ?? (variantId
    ? product.variants?.find((variant) => variant.id === variantId)?.stock
    : product.stock) ?? 0
  expected.set(key, Math.max(0, current - quantity))
}

function normalizeHubProduct(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...value,
    inventoryItemId: typeof value.inventoryItemId === 'string' ? value.inventoryItemId : undefined,
    eightySix: normalizeHubEightySix(value.eightySix),
    recipe: normalizeHubRecipe(value.recipe),
    modifiers: Array.isArray(value.modifiers)
      ? value.modifiers.map((group) => record(group) && Array.isArray(group.options)
        ? {
            ...group,
            options: group.options.map((option) => record(option)
              ? { ...option, recipe: normalizeHubRecipe(option.recipe) }
              : option),
          }
        : group)
      : value.modifiers,
    variants: Array.isArray(value.variants)
      ? value.variants.map((variant) => record(variant)
        ? {
            ...variant,
            eightySix: normalizeHubEightySix(variant.eightySix),
            recipe: normalizeHubRecipe(variant.recipe),
          }
        : variant)
      : value.variants,
  }
}

function validateHubProductRecipes(
  product: Record<string, unknown>,
  collections: Record<string, Record<string, SyncDocument> | undefined>,
  storeId: string,
): void {
  const inventory = collections.inventoryItems ?? {}
  const recipes: unknown[] = [product.recipe]
  if (Array.isArray(product.variants)) {
    for (const variant of product.variants) {
      if (record(variant)) recipes.push(variant.recipe)
    }
  }
  if (Array.isArray(product.modifiers)) {
    for (const group of product.modifiers) {
      if (!record(group) || !Array.isArray(group.options)) continue
      for (const option of group.options) {
        if (record(option)) recipes.push(option.recipe)
      }
    }
  }
  for (const recipe of recipes) {
    if (!Array.isArray(recipe)) continue
    for (const ingredient of recipe) {
      if (!record(ingredient) || typeof ingredient.inventoryItemId !== 'string' ||
        typeof ingredient.qtyPerUnit !== 'number' || !Number.isFinite(ingredient.qtyPerUnit) ||
        ingredient.qtyPerUnit <= 0) {
        throw new Error('Product recipe contains an invalid ingredient.')
      }
      const item = inventory[ingredient.inventoryItemId]
      if (!item || item.storeId !== storeId) {
        throw new Error('Product recipe ingredients must belong to this store.')
      }
    }
  }
}

function canManageSchedules(actor: AuthenticatedActor): boolean {
  return can(actor, 'manageStaff') ||
    (actor.role === 'staff' && actor.permissions.supervisor === true)
}

function localAddress(): string {
  const configured = process.env.HUB_HOST
  if (configured) return configured
  const privateIpv4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/
  for (const entries of Object.values(networkInterfaces())) {
    const address = entries?.find((entry) => entry.family === 'IPv4' && !entry.internal && privateIpv4.test(entry.address))
    if (address) return address.address
  }
  return '127.0.0.1'
}

function originAllowed(origin: string | undefined, request: IncomingMessage, address: string, port: number, secure: boolean): boolean {
  if (!origin) return true
  const configured = (process.env.HUB_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  if (configured.includes(origin)) return true
  const scheme = secure ? 'https:' : 'http:'
  try {
    const parsed = new URL(origin)
    const ownPort = request.headers.host?.split(':').at(-1)
    const expectedPort = ownPort || String(port)
    return parsed.protocol === scheme && parsed.port === expectedPort &&
      (parsed.hostname === address || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(body))
}

async function readJson(request: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length
    if (length > maxBytes) throw Object.assign(new Error(`Request body exceeds ${Math.round(maxBytes / (1024 * 1024))} MB.`), { status: 413 })
    chunks.push(buffer)
  }
  let value: unknown
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })
  }
  if (!record(value)) throw Object.assign(new Error('Request body must be a JSON object.'), { status: 400 })
  return value
}

function bearer(request: IncomingMessage): string | undefined {
  const value = request.headers.authorization
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : undefined
}

function contentSecurityPolicy(): string {
  return "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; connect-src 'self' ws: wss:"
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? '')
}

function jsonResponseError(error: unknown): { status: number; message: string } {
  const candidate = error as { status?: unknown; message?: unknown }
  const status = typeof candidate.status === 'number' ? candidate.status : 400
  const message = typeof candidate.message === 'string' ? candidate.message : 'Request failed.'
  return { status, message }
}

export interface HubRuntime {
  server: Server
  address: string
  port: number
  close: () => Promise<void>
  storage: HubStorage
}

export async function createHubServer(): Promise<HubRuntime> {
  const storage = new HubStorage()
  await storage.initialize()
  const auth = new HubAuth(storage)
  await auth.initialize()
  const httpsKey = process.env.HUB_TLS_KEY
  const httpsCert = process.env.HUB_TLS_CERT
  const tlsOptions = httpsKey && httpsCert
    ? { key: await readFile(resolve(httpsKey)), cert: await readFile(resolve(httpsCert)) }
    : undefined
  const address = localAddress()
  const port = Number(process.env.HUB_PORT ?? 8080)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('HUB_PORT must be an integer from 1 to 65535.')

  let sockets: HubWebSocket
  const server = tlsOptions
    ? createHttpsServer(tlsOptions, (request, response) => { void handleRequest(request, response) })
    : createHttpServer((request, response) => { void handleRequest(request, response) })
  sockets = new HubWebSocket(server, auth, async (actor, message) => {
    if (message.type === 'station-status') await updateStationStatus(actor, message, true)
    else if (message.type === 'sync') await applySync(actor, message.changeSet, true)
    else throw new Error('Unsupported WebSocket message.')
  }, (origin, request) => {
    if (!originAllowed(origin, request, address, port, !!tlsOptions)) return false
    const ip = request.socket.remoteAddress ?? 'unknown'
    const current = websocketLimits.get(ip)
    if (!current || current.reset <= Date.now()) {
      websocketLimits.set(ip, { count: 1, reset: Date.now() + RATE_WINDOW })
      return true
    }
    if (current.count >= 30) return false
    current.count += 1
    return true
  })
  const printQueue = new HubPrintQueue(storage, sockets)
  await printQueue.start()
  let virtualPrinter: Awaited<ReturnType<typeof startVirtualPrinter>> | undefined

  function authActor(request: IncomingMessage, storeId?: string): AuthenticatedActor {
    const deviceId = request.headers['x-device-id']
    const token = bearer(request)
    const actor = auth.authenticate(token)
    if (!actor) throw Object.assign(new Error('Authentication required.'), { status: 401 })
    if (storeId && actor.storeId !== storeId) throw Object.assign(new Error('Store scope mismatch.'), { status: 403 })
    if (typeof deviceId === 'string') throw Object.assign(new Error('Invalid device authentication.'), { status: 401 })
    return actor
  }

  async function actorFor(request: IncomingMessage, storeId?: string): Promise<AuthenticatedActor> {
    const deviceId = request.headers['x-device-id']
    const token = bearer(request)
    if (typeof deviceId === 'string' && token) {
      const actor = await auth.authenticateDevice(deviceId, token)
      if (!actor || (storeId && actor.storeId !== storeId)) throw Object.assign(new Error('Station device authentication failed.'), { status: 401 })
      return actor
    }
    const actor = authActor(request, storeId)
    const refreshed = await auth.refreshActor(actor)
    if (!refreshed) throw Object.assign(new Error('Account is disabled or no longer available.'), { status: 401 })
    return refreshed
  }

  async function authorizedStore(request: IncomingMessage, body?: Record<string, unknown>): Promise<{ actor: AuthenticatedActor; storeId: string }> {
    const claimedStore = typeof body?.storeId === 'string' ? body.storeId : undefined
    const actor = await actorFor(request, claimedStore)
    return { actor, storeId: actor.storeId }
  }

  async function applySync(actor: AuthenticatedActor, raw: unknown, fromSocket = false): Promise<{
    seq: number
    duplicate: boolean
    conflicts: Array<{ collection: string; id: string; label: string }>
    fullResyncRequired?: boolean
  }> {
    if (actor.deviceToken) throw new Error('Station devices cannot submit general sync operations.')
    if (!record(raw) || !Array.isArray(raw.ops) || raw.ops.length > 2000 ||
      typeof raw.opId !== 'string' || !validId(raw.opId) ||
      typeof raw.deviceId !== 'string' || !validId(raw.deviceId) ||
      raw.storeId !== actor.storeId || !Number.isSafeInteger(raw.baseSeq) || (raw.baseSeq as number) < 0) {
      throw new Error('Invalid change set.')
    }
    const state = await storage.readStore(actor.storeId)
    if (state.appliedOpIds.includes(raw.opId)) return { seq: state.seq, duplicate: true, conflicts: [] }
    const validationState = structuredClone(state)
    const changesSince = await storage.changesSince(actor.storeId, raw.baseSeq as number)
    if (changesSince.fullResyncRequired) {
      return { seq: state.seq, duplicate: false, conflicts: [], fullResyncRequired: true }
    }
    const changedDocuments = new Set(changesSince.changes
      .filter((entry) => entry.changeSet.deviceId !== raw.deviceId)
      .flatMap((entry) => entry.changeSet.ops.map((operation) => `${operation.collection}:${operation.id}`)))
    const conflicts: Array<{ collection: string; id: string; label: string }> = []
    const projectedOrderState = structuredClone(validationState)
    const projectedProducts = Object.values(projectedOrderState.collections.products ?? {}) as unknown as Product[]
    const projectedInventory = Object.values(projectedOrderState.collections.inventoryItems ?? {}) as unknown as InventoryItem[]
    const productStockAfterSales = new Map<string, number>()
    const inventoryStockAfterSales = new Map<string, number>()
    const expectedSaleMovements = new Map<string, Record<string, unknown>>()
    const claimedSaleMovements = new Set<string>()
    for (const rawOperation of raw.ops) {
      if (!record(rawOperation) || rawOperation.kind !== 'put' || rawOperation.collection !== 'orders' ||
        !record(rawOperation.document) || projectedOrderState.collections.orders?.[String(rawOperation.id)]) continue
      const incomingOrder = rawOperation.document
      if (incomingOrder.status !== 'completed') continue
      const checkedOrder = validateOrderDocument(incomingOrder, 'orders', projectedOrderState, actor)
      const orderId = String(rawOperation.id)
      projectedOrderState.collections.orders ??= {}
      projectedOrderState.collections.orders[orderId] = checkedOrder as SyncDocument
      const storeDoc = projectedOrderState.collections.stores?.[actor.storeId]
      const settings = record(storeDoc) && record(storeDoc.settings)
        ? storeDoc.settings as unknown as StoreSettings
        : undefined
      if (!settings) throw new Error('Store settings are unavailable for sale stock tracking.')
      const deductIngredients = checkedOrder.staffConsumption === true || settings.orderRules.deductIngredientsOnSale
      const plan = planStockDeductions(
        checkedOrder.items as OrderItem[],
        projectedProducts,
        deductIngredients,
      )
      for (const deduction of plan.productStock.values()) {
        const product = projectedProducts.find((entry) => entry.id === deduction.productId)
        const variant = deduction.variantId
          ? product?.variants?.find((entry) => entry.id === deduction.variantId)
          : undefined
        if (variant ? variant.trackStock : product?.trackStock) {
          setExpectedProductStock(
            productStockAfterSales,
            projectedProducts,
            deduction.productId,
            deduction.variantId,
            deduction.qty,
          )
        }
      }
      for (const ingredient of plan.ingredients.values()) {
        const item = projectedInventory.find((entry) => entry.id === ingredient.itemId && entry.storeId === actor.storeId)
        if (!item) continue
        const onHand = inventoryStockAfterSales.get(item.id) ?? item.onHand
        const deducted = Math.min(ingredient.qty, onHand)
        if (deducted <= 0) continue
        inventoryStockAfterSales.set(item.id, Math.max(0, onHand - deducted))
        const type = checkedOrder.staffConsumption === true ? 'staff_use' : 'sale_use'
        const orderLabel = String(incomingOrder.provisionalNumber ?? incomingOrder.number ?? checkedOrder.number)
        const movementKey = `${orderId}:${item.id}`
        expectedSaleMovements.set(movementKey, {
          storeId: actor.storeId,
          itemId: item.id,
          type,
          qtyDelta: -deducted,
          unitCostSnapshot: item.avgCostPerBaseUnit,
          reason: `${type === 'staff_use' ? 'Staff items' : 'Sale'} ${orderLabel}`,
          userId: actor.userId,
          userName: String(projectedOrderState.collections.users?.[actor.userId]?.name ?? ''),
          refType: 'order',
          refId: orderId,
        })
      }
    }
    const paidOpenOrderIds = new Set<string>()
    for (const candidate of raw.ops) {
      if (!record(candidate) || candidate.kind !== 'put' || candidate.collection !== 'orders' ||
        !record(candidate.document) || candidate.document.storeId !== actor.storeId ||
        candidate.document.status !== 'completed' ||
        typeof candidate.document.clientOrderId !== 'string' ||
        !candidate.document.clientOrderId.startsWith('pay:')) continue
      paidOpenOrderIds.add(candidate.document.clientOrderId.slice(4))
    }
    for (const operation of raw.ops) {
      if (!record(operation) || !['put', 'delete'].includes(String(operation.kind)) ||
        typeof operation.collection !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(operation.collection) ||
        !validId(operation.id)) throw new Error('Change set contains an invalid operation.')
      let operationId = operation.id as string
      const storeForAccess = validationState.collections.stores?.[actor.storeId]
      const accessSettings = normalizeShiftAccessSettings(
        record(storeForAccess) && record(storeForAccess.settings)
          ? storeForAccess.settings.shiftAccess
          : undefined,
      )
      const hasOpenStaffShift = Object.values(validationState.collections.registerSessions ?? {}).some((session) =>
        session.storeId === actor.storeId && session.status === 'open' &&
        ((session.staffId as string | undefined) ?? (session.openedById as string | undefined)) === actor.userId,
      )
      const allowedBeforeShift = ['registerSessions', 'auditLogs', 'attendance', 'cashDifferences'].includes(operation.collection)
      if (actor.role === 'staff' && !actor.stationOnly &&
        accessSettings.requireOpenShiftForStoreAccess && !hasOpenStaffShift && !allowedBeforeShift) {
        const message = operation.collection === 'orders' || operation.collection === 'openOrders'
          ? 'Open your shift before taking orders.'
          : 'Open your shift before accessing store operations.'
        throw Object.assign(new Error(message), { status: 403 })
      }
      const required = PRIVATE_COLLECTIONS[operation.collection]
      const previousForPermission = validationState.collections[operation.collection]?.[operation.id]
      const incomingForPermission = operation.kind === 'put' && record(operation.document) ? operation.document : undefined
      if (operation.collection === 'customers') {
        const storeDoc = validationState.collections.stores?.[actor.storeId] as unknown as Store | undefined
        if (!storeDoc) throw new Error('Store not found.')
        if (isQuick(storeDoc)) {
          requireCapability(actor, 'manageCustomers')
        } else if (actor.role !== 'admin') {
          throw Object.assign(new Error('Only the store owner can manage customer profiles.'), { status: 403 })
        }
        if (operation.kind === 'delete') {
          if (!record(previousForPermission) || previousForPermission.storeId !== actor.storeId) {
            throw new Error('Customer not found in this store.')
          }
          const ledger = Object.values(validationState.collections.ledger ?? {}) as unknown as LedgerEntry[]
          const balance = balanceFor(ledger, operation.id)
          if (balance > 0) throw new Error('Settle the outstanding balance before removing this customer.')
        } else {
          const customer = incomingForPermission
          if (!customer || customer.id !== operation.id || customer.storeId !== actor.storeId ||
            typeof customer.name !== 'string' || !customer.name.trim() ||
            typeof customer.phone !== 'string' ||
            typeof customer.notes !== 'string' ||
            typeof customer.limit !== 'number' || !Number.isFinite(customer.limit) || customer.limit < 0 ||
            typeof customer.createdAt !== 'string' || !Number.isFinite(Date.parse(customer.createdAt)) ||
            (customer.cycle !== undefined && !['monthly', 'weekly', 'on-demand'].includes(String(customer.cycle)))) {
            throw new Error('Customer profile details are invalid.')
          }
          if (record(previousForPermission) &&
            (customer.createdAt !== previousForPermission.createdAt ||
              customer.storeId !== previousForPermission.storeId)) {
            throw new Error('Customer profile ownership and creation details cannot be changed.')
          }
        }
      }
      if (operation.collection === 'users' && operation.kind === 'put' &&
        incomingForPermission) {
        if (incomingForPermission.tabCreditLimit !== undefined &&
          (typeof incomingForPermission.tabCreditLimit !== 'number' ||
            !Number.isFinite(incomingForPermission.tabCreditLimit) ||
            incomingForPermission.tabCreditLimit < 0)) {
          throw new Error('Staff tab credit limit is invalid.')
        }
        const previousLimit = record(previousForPermission) &&
          typeof previousForPermission.tabCreditLimit === 'number'
          ? previousForPermission.tabCreditLimit
          : 0
        const nextLimit = typeof incomingForPermission.tabCreditLimit === 'number'
          ? incomingForPermission.tabCreditLimit
          : previousLimit
        if (actor.role !== 'admin' && nextLimit !== previousLimit) {
          throw Object.assign(new Error('Only the store owner can set staff tab credit limits.'), { status: 403 })
        }
      }
      const previousDifference = record(previousForPermission) ? previousForPermission : undefined
      const incomingDifference = operation.collection === 'cashDifferences' ? incomingForPermission : undefined
      let selfQuickDifferenceAction = false
      if (actor.role === 'staff' && incomingDifference && previousDifference &&
        previousDifference.staffId === actor.userId && previousDifference.storeId === actor.storeId &&
        incomingDifference.staffId === actor.userId && incomingDifference.storeId === actor.storeId &&
        incomingDifference.shiftId === previousDifference.shiftId &&
        incomingDifference.amount === previousDifference.amount &&
        incomingDifference.type === previousDifference.type && previousDifference.status === 'open') {
        const storeDoc = validationState.collections.stores?.[actor.storeId] as unknown as Store | undefined
        const shiftDoc = validationState.collections.registerSessions?.[String(previousDifference.shiftId)]
        const shiftOwnerId = record(shiftDoc)
          ? typeof shiftDoc.staffId === 'string' ? shiftDoc.staffId : shiftDoc.openedById
          : undefined
        const allowedFields = new Set([
          'status', 'correctionEntries', 'resolvedAt', 'resolvedById', 'resolution', 'note',
        ])
        const stripAllowed = (document: Record<string, unknown>) => Object.fromEntries(
          Object.entries(document).filter(([field]) => !allowedFields.has(field)),
        )
        const previousCorrections = Array.isArray(previousDifference.correctionEntries)
          ? previousDifference.correctionEntries
          : []
        const nextCorrections = Array.isArray(incomingDifference.correctionEntries)
          ? incomingDifference.correctionEntries
          : []
        const unchanged = isDeepStrictEqual(stripAllowed(previousDifference), stripAllowed(incomingDifference))
        const accepted = isDeepStrictEqual(previousCorrections, nextCorrections) &&
          incomingDifference.status === 'settled' &&
          incomingDifference.resolution === 'waived' &&
          incomingDifference.resolvedById === actor.userId &&
          typeof incomingDifference.resolvedAt === 'string' &&
          Number.isFinite(Date.parse(incomingDifference.resolvedAt))
        const appendedCorrection = nextCorrections.length === previousCorrections.length + 1 &&
          isDeepStrictEqual(nextCorrections.slice(0, -1), previousCorrections)
        const correction = appendedCorrection ? nextCorrections[nextCorrections.length - 1] : undefined
        const previousCorrectionTotal = previousCorrections.reduce((total, entry) =>
          record(entry) && typeof entry.amount === 'number' ? total + entry.amount : total, 0)
        const nextCorrectionTotal = nextCorrections.reduce((total, entry) =>
          record(entry) && typeof entry.amount === 'number' ? total + entry.amount : total, 0)
        const remaining = Math.abs(Number(previousDifference.amount)) - previousCorrectionTotal
        const correctionIsValid = record(correction) &&
          typeof correction.id === 'string' && typeof correction.amount === 'number' &&
          Number.isFinite(correction.amount) && correction.amount > 0 &&
          correction.amount <= remaining && correction.staffId === actor.userId &&
          typeof correction.staffName === 'string' && typeof correction.at === 'string' &&
          Number.isFinite(Date.parse(correction.at)) &&
          (previousDifference.type === 'shortage') &&
          (incomingDifference.status === 'open' || incomingDifference.status === 'settled') &&
          (incomingDifference.status === 'open'
            ? incomingDifference.resolvedById === previousDifference.resolvedById
            : incomingDifference.resolution === 'paid_back' &&
              incomingDifference.resolvedById === actor.userId &&
              typeof incomingDifference.resolvedAt === 'string' &&
              Number.isFinite(Date.parse(incomingDifference.resolvedAt))) &&
          (incomingDifference.status !== 'settled' || nextCorrectionTotal >= Math.abs(Number(previousDifference.amount)))
        selfQuickDifferenceAction = !!storeDoc && isQuick(storeDoc) &&
          shiftOwnerId === actor.userId && unchanged && (accepted || correctionIsValid)
      }
      const selfQuickDifferenceLog = actor.role === 'staff' &&
        operation.collection === 'auditLogs' && incomingForPermission?.action === 'cash_difference_resolved' &&
        incomingForPermission.entity === 'cash_difference' &&
        typeof incomingForPermission.entityId === 'string' &&
        record(validationState.collections.cashDifferences?.[incomingForPermission.entityId]) &&
        validationState.collections.cashDifferences[incomingForPermission.entityId].staffId === actor.userId
      if (actor.role === 'staff' && !hasOpenStaffShift && operation.collection === 'auditLogs' &&
        !selfQuickDifferenceLog &&
        (operation.kind !== 'put' || incomingForPermission?.storeId !== actor.storeId ||
          incomingForPermission.userId !== actor.userId || incomingForPermission.action !== 'shift_access_denied')) {
        throw Object.assign(new Error('Before opening a shift, staff may only report their own blocked shift access.'), { status: 403 })
      }
      if (actor.role === 'staff' && !hasOpenStaffShift && operation.collection === 'attendance' &&
        (operation.kind !== 'put' || incomingForPermission?.storeId !== actor.storeId ||
          incomingForPermission.userId !== actor.userId ||
          (record(previousForPermission) && previousForPermission.userId !== actor.userId))) {
        throw Object.assign(new Error('Before opening a shift, staff may only update their own attendance.'), { status: 403 })
      }
      const hasAvailabilityChange = operation.collection === 'products' && record(previousForPermission) &&
        incomingForPermission !== undefined && productAvailabilityChanged(previousForPermission, incomingForPermission)
      const availabilityOnly = operation.collection === 'products' && operation.kind === 'put' &&
        isAvailabilityOnlyProductChange(
          previousForPermission,
          incomingForPermission,
          actor.storeId,
          can(actor, 'manage86'),
        )
      let verifiedSaleMovement: string | undefined
      let automaticSaleStockChange = false
      if (actor.role === 'staff' && operation.kind === 'put' && incomingForPermission) {
        if (operation.collection === 'inventoryItems' && record(previousForPermission)) {
          const expectedOnHand = inventoryStockAfterSales.get(operation.id)
          if (expectedOnHand !== undefined) {
            const expected = { ...previousForPermission, onHand: expectedOnHand }
            automaticSaleStockChange = isDeepStrictEqual(expected, incomingForPermission)
          }
        } else if (operation.collection === 'products' && record(previousForPermission)) {
          const expected = structuredClone(previousForPermission)
          let hasExpectedStock = false
          for (const [key, stock] of productStockAfterSales) {
            if (!key.startsWith(`${operation.id}:`)) continue
            hasExpectedStock = true
            const variantId = key.slice(operation.id.length + 1)
            if (variantId === 'base') expected.stock = stock
            else if (Array.isArray(expected.variants)) {
              expected.variants = expected.variants.map((variant) =>
                record(variant) && variant.id === variantId ? { ...variant, stock } : variant,
              )
            }
          }
          automaticSaleStockChange = hasExpectedStock &&
            isDeepStrictEqual(withoutProductAvailability(expected), withoutProductAvailability(incomingForPermission))
        } else if (operation.collection === 'stockMovements') {
          const itemId = incomingForPermission.itemId
          const refId = incomingForPermission.refId
          const movementKey = typeof itemId === 'string' && typeof refId === 'string'
            ? `${refId}:${itemId}`
            : ''
          const expected = expectedSaleMovements.get(movementKey)
          if (expected && incomingForPermission.id === operation.id &&
            Object.entries(expected).every(([key, value]) =>
              key === 'qtyDelta' && typeof value === 'number' && typeof incomingForPermission[key] === 'number'
                ? Math.abs((incomingForPermission[key] as number) - value) < 0.000001
                : incomingForPermission[key] === value,
            ) &&
            typeof incomingForPermission.createdAt === 'string' &&
            Number.isFinite(Date.parse(incomingForPermission.createdAt)) &&
            Date.parse(incomingForPermission.createdAt) <= Date.now()) {
            automaticSaleStockChange = true
            verifiedSaleMovement = movementKey
          }
        }
      }
      if (operation.collection === 'expenses') {
        const storeDoc = validationState.collections.stores?.[actor.storeId]
        if (!record(storeDoc)) throw new Error('Store not found.')
        if (isQuickStoreDocument(storeDoc)) {
          const capability = operation.kind === 'delete' || previousForPermission
            ? 'editExpenses'
            : 'addExpenses'
          requireCapability(actor, capability)
        } else {
          requireCapability(actor, 'manageSettings')
        }
      } else if (required && required !== 'ledger' && !availabilityOnly && !automaticSaleStockChange &&
        !selfQuickDifferenceAction) {
        requireCapability(actor, required)
      }
      if (verifiedSaleMovement) {
        if (claimedSaleMovements.has(verifiedSaleMovement)) throw new Error('Sale stock movement was recorded more than once.')
        claimedSaleMovements.add(verifiedSaleMovement)
      }
      if (hasAvailabilityChange) {
        const storeDoc = validationState.collections.stores?.[actor.storeId]
        const availability = record(storeDoc) && record(storeDoc.settings) && record(storeDoc.settings.availability)
          ? storeDoc.settings.availability
          : undefined
        if (availability?.enabled === false) {
          throw Object.assign(new Error('86 availability is disabled for this store.'), { status: 403 })
        }
      }
      if (operation.collection === 'shifts') {
        if (!canManageSchedules(actor)) {
          throw Object.assign(new Error('Permission denied: schedule management is required.'), { status: 403 })
        }
        const previous = validationState.collections.shifts?.[operation.id]
        if (operation.kind === 'delete') {
          if (!record(previous) || previous.storeId !== actor.storeId) {
            throw Object.assign(new Error('Shift not found in this store.'), { status: 404 })
          }
        } else if (record(operation.document)) {
          const shift = operation.document
          const staff = typeof shift.userId === 'string'
            ? validationState.collections.users?.[shift.userId]
            : undefined
          if (!staff || staff.storeId !== actor.storeId || staff.role !== 'staff') {
            throw new Error('Scheduled staff member must belong to this store.')
          }
          if (previous && record(previous) &&
            (shift.userId !== previous.userId || shift.createdBy !== previous.createdBy ||
              shift.createdAt !== previous.createdAt)) {
            throw new Error('Shift ownership and creation details cannot be changed.')
          }
          if (!previous && shift.createdBy !== actor.userId) {
            throw new Error('New shifts must record the authenticated manager.')
          }
          if (typeof shift.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(shift.date) ||
            typeof shift.startTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(shift.startTime) ||
            typeof shift.endTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(shift.endTime) ||
            shift.endTime <= shift.startTime ||
            (shift.note !== undefined && (typeof shift.note !== 'string' || shift.note.length > 500))) {
            throw new Error('Scheduled shift details are invalid.')
          }
        }
      }
      if (operation.collection === 'ledger') {
        if (operation.kind === 'delete') throw Object.assign(new Error('Ledger entries cannot be deleted.'), { status: 403 })
        if (!record(operation.document)) throw new Error('Ledger entry must be an object.')
      }
      if (ORDER_COLLECTIONS.has(operation.collection) && operation.kind === 'delete') {
        if (operation.collection === 'openOrders' && paidOpenOrderIds.has(operation.id)) {
          requireCapability(actor, 'register')
        } else {
          requireCapability(actor, 'voidOrders')
        }
      }
      if (ORDER_COLLECTIONS.has(operation.collection) && operation.kind === 'put') {
        requireCapability(actor, 'register')
      }
      if (operation.collection === 'registerSessions') {
        const previous = validationState.collections.registerSessions?.[operation.id]
        if (operation.kind === 'delete') {
          throw Object.assign(new Error('Register sessions cannot be deleted.'), { status: 403 })
        }
        const doc = operation.document
        if (!record(doc)) throw new Error('Register session must be an object.')
        const ownerId = (session: Record<string, unknown>) =>
          typeof session.staffId === 'string' ? session.staffId : session.openedById
        const isAuthorizedForceClose = actor.role !== 'admin' && can(actor, 'forceCloseShift')
        if (actor.role !== 'admin' && ownerId(doc) !== actor.userId && !isAuthorizedForceClose) {
          throw Object.assign(new Error('You can only change your own register session.'), { status: 403 })
        }
        if (record(previous)) {
          if (actor.role !== 'admin' && ownerId(previous) !== actor.userId && !isAuthorizedForceClose) {
            throw Object.assign(new Error('You can only change your own register session.'), { status: 403 })
          }
          for (const field of ['id', 'storeId', 'openedAt', 'openedById', 'openedByName', 'staffId', 'shiftNumber', 'openingCash', 'openingFloat', 'autoOpened']) {
            if (doc[field] !== previous[field]) {
              throw new Error('Register session opening details cannot be changed.')
            }
          }
          if (previous.status === 'closed' && !isDeepStrictEqual(previous, doc)) {
            throw Object.assign(new Error('Closed register sessions are immutable.'), { status: 403 })
          }
          if (previous.status === 'open' && doc.status === 'closed' &&
            (doc.closeType !== 'shift' || doc.zReportNumber !== undefined)) {
            throw new Error('Staff shift closeouts must save an X report; only the owner closes the day Z.')
          }
        } else if (actor.role !== 'admin' &&
          (doc.staffId !== actor.userId || doc.openedById !== actor.userId)) {
          throw Object.assign(new Error('New register sessions must belong to the authenticated staff member.'), { status: 403 })
        } else if (!record(previous)) {
          const openedAt = doc.openedAt
          if (typeof openedAt !== 'string' || !Number.isFinite(Date.parse(openedAt))) {
            throw new Error('Register shift opening time is invalid.')
          }
          if (actor.role === 'staff' && !actor.stationOnly) {
            const storeDoc = validationState.collections.stores?.[actor.storeId]
            const settings = normalizeShiftAccessSettings(
              record(storeDoc) && record(storeDoc.settings)
                ? storeDoc.settings.shiftAccess
                : undefined,
            )
            const scheduleError = shiftOpenScheduleError(
              settings,
              Object.values(validationState.collections.shifts ?? {}) as unknown as Shift[],
              actor.storeId,
              actor.userId,
              new Date(),
            )
            if (scheduleError) throw new Error(scheduleError)
          }
          if (Object.values(validationState.collections.registerDayReports ?? {}).some((report) =>
            report.storeId === actor.storeId && report.date === localDateKey(openedAt),
          )) {
            throw new Error('The store day is closed. Open a new shift on the next business day.')
          }
          const storeDoc = validationState.collections.stores?.[actor.storeId] as unknown as Store | undefined
          if (actor.role !== 'admin' && storeDoc && isQuick(storeDoc) &&
            storeDoc.settings.allowQuickOpeningFloatEdit !== true) {
            const previousClosed = Object.values(validationState.collections.registerSessions ?? {})
              .filter((session) => session.storeId === actor.storeId && session.status === 'closed')
              .sort((a, b) => String(b.closedAt ?? b.openedAt).localeCompare(String(a.closedAt ?? a.openedAt)))[0]
            const expectedFloat = record(previousClosed)
              ? typeof previousClosed.openingFloat === 'number'
                ? previousClosed.openingFloat
                : Number(previousClosed.openingCash) || 0
              : 0
            if (Number(doc.openingCash) !== expectedFloat || Number(doc.openingFloat) !== expectedFloat) {
              throw Object.assign(new Error('The opening float is locked to the previous shift.'), { status: 403 })
            }
          }
        }
        const hasCashCount = doc.countedCash !== undefined || doc.difference !== undefined
        const isClosing = doc.status === 'closed' || doc.closedAt !== undefined || hasCashCount
        if (isClosing) {
          const isClosingAnotherShift = record(previous) && ownerId(previous) !== actor.userId
          if (isClosingAnotherShift || (actor.role === 'manager' && can(actor, 'forceCloseShift'))) {
            requireCapability(actor, 'forceCloseShift')
          } else {
            requireCapability(actor, 'closeShift')
          }
        }
        else requireCapability(actor, 'openShift')
      }
      if (operation.collection === 'registerDayReports') {
        const previous = validationState.collections.registerDayReports?.[operation.id]
        if (actor.role !== 'admin' && !(actor.role === 'manager' && can(actor, 'forceCloseShift'))) {
          throw Object.assign(new Error('Only the owner or an authorized manager can close the store-day Z report.'), { status: 403 })
        }
        if (operation.kind === 'delete' || record(previous)) {
          throw Object.assign(new Error('Store-day Z reports are immutable and cannot be deleted.'), { status: 403 })
        }
        const report = operation.document
        if (!record(report) || report.closedById !== actor.userId ||
          typeof report.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(report.date) ||
          typeof report.closedByName !== 'string' ||
          typeof report.closedAt !== 'string' || !Number.isFinite(Date.parse(report.closedAt)) ||
          !Number.isSafeInteger(report.zReportNumber) || Number(report.zReportNumber) < 1 ||
          !Number.isFinite(report.openingCash) || Number(report.openingCash) < 0 ||
          !Number.isFinite(report.countedCash) || Number(report.countedCash) < 0 ||
          !Number.isFinite(report.difference) || !record(report.snapshot) || !record(report.reportDetails)) {
          throw new Error('Store-day Z report details are invalid.')
        }
        const storeDoc = validationState.collections.stores?.[actor.storeId] as unknown as Store | undefined
        if (storeDoc && isQuick(storeDoc)) {
          const summary = report.quickShiftSummary
          if (!record(summary) || !Array.isArray(summary.shifts) ||
            !Array.isArray(summary.staffDifferences) ||
            !Number.isFinite(summary.declaredSales) || !Number.isFinite(summary.retainedFloat) ||
            !Number.isFinite(summary.expectedCash) || !Number.isFinite(summary.countedCash) ||
            !Number.isFinite(summary.difference)) {
            throw new Error('Quick Z shift summary is invalid.')
          }
          const sourceShifts = Object.values(validationState.collections.registerSessions ?? {})
            .filter((session) => session.storeId === actor.storeId &&
              (localDateKey(String(session.openedAt)) === report.date ||
                (session.status === 'closed' && session.closedById === actor.userId &&
                  session.closedAt === report.closedAt)))
          if (summary.shifts.length !== sourceShifts.length) {
            throw new Error('Quick Z must include every shift for the store day.')
          }
          const shiftRows = summary.shifts.filter(record)
          if (shiftRows.length !== sourceShifts.length) {
            throw new Error('Quick Z contains an invalid shift row.')
          }
          const staffDifferences = new Map<string, { staffId: string; staffName: string; amount: number }>()
          let declaredSales = 0
          const sortedShifts = [...sourceShifts].sort((a, b) =>
            String(a.openedAt).localeCompare(String(b.openedAt)),
          )
          for (const session of sourceShifts) {
            if (session.status !== 'closed' || typeof session.id !== 'string' ||
              typeof session.openingCash !== 'number' || typeof session.countedCash !== 'number') {
              throw new Error('Quick Z cannot include an open or invalid shift.')
            }
            const row = shiftRows.find((candidate) => candidate.shiftId === session.id)
            const openingFloat = typeof session.openingFloat === 'number' ? session.openingFloat : session.openingCash
            const sessionSales = typeof session.declaredSales === 'number'
              ? session.declaredSales
              : round(session.countedCash - openingFloat)
            const expectedDifference = typeof session.expectedSales === 'number'
              ? Number(session.difference) || 0
              : 0
            const ownerId = typeof session.staffId === 'string' ? session.staffId : session.openedById
            if (!row || row.staffId !== ownerId || row.openingFloat !== openingFloat ||
              row.countedCash !== session.countedCash || row.declaredSales !== sessionSales ||
              row.difference !== expectedDifference) {
              throw new Error('Quick Z shift details do not match the stored register sessions.')
            }
            declaredSales = round(declaredSales + sessionSales)
            const owner = validationState.collections.users?.[String(ownerId)]
            const name = record(owner) && typeof owner.name === 'string' ? owner.name : String(ownerId)
            const total = staffDifferences.get(String(ownerId)) ?? {
              staffId: String(ownerId),
              staffName: name,
              amount: 0,
            }
            total.amount = round(total.amount + expectedDifference)
            staffDifferences.set(String(ownerId), total)
          }
          const retainedFloat = sortedShifts.length
            ? Number(sortedShifts[0].openingFloat ?? sortedShifts[0].openingCash)
            : 0
          const expectedCash = round(declaredSales + retainedFloat)
          const finalDifference = round(Number(report.countedCash) - expectedCash)
          const reportedStaffDifferences = summary.staffDifferences.filter(record)
          if (summary.declaredSales !== declaredSales ||
            summary.retainedFloat !== retainedFloat ||
            summary.expectedCash !== expectedCash ||
            summary.countedCash !== report.countedCash ||
            summary.difference !== finalDifference ||
            report.openingCash !== retainedFloat ||
            report.snapshot.expectedCash !== expectedCash ||
            report.difference !== finalDifference ||
            reportedStaffDifferences.length !== staffDifferences.size ||
            [...staffDifferences.values()].some((staff) =>
              !reportedStaffDifferences.some((row) =>
                row.staffId === staff.staffId && row.staffName === staff.staffName && row.amount === staff.amount,
              ),
            )) {
            throw new Error('Quick Z totals do not match the shift declarations and manager count.')
          }
        }
        if (Object.values(validationState.collections.registerSessions ?? {}).some((session) =>
          session.storeId === actor.storeId && session.status === 'open',
        )) {
          throw new Error('All staff shifts must be closed before the store-day Z report.')
        }
        if (Object.values(validationState.collections.registerDayReports ?? {}).some((dayReport) =>
          dayReport.storeId === actor.storeId &&
            (dayReport.date === report.date || dayReport.zReportNumber === report.zReportNumber),
        ) || Object.values(validationState.collections.registerSessions ?? {}).some((session) =>
          session.storeId === actor.storeId && session.zReportNumber === report.zReportNumber,
        )) {
          throw new Error('The store-day Z report date or number has already been used.')
        }
      }
      if (operation.collection === 'orders' && operation.kind === 'put' &&
        record(operation.document) && (operation.document.status === 'void' || operation.document.voidedAt)) {
        requireCapability(actor, 'voidOrders')
      }
      if (operation.kind === 'put') {
        let document: Record<string, unknown>
        if (operation.collection === 'stores') {
          if (!record(operation.document) || operation.document.id !== actor.storeId) {
            throw new Error('Store document must belong to the authenticated store.')
          }
          const settings = record(operation.document.settings) ? operation.document.settings : {}
          const incomingCashierMode = normalizeCashierModeSettings(
            settings.posMode,
            settings.cashierModeEnabled,
          )
          document = {
            ...operation.document,
            settings: {
            ...settings,
            ...incomingCashierMode,
            availability: normalizeHubAvailability(settings.availability),
            orderRules: normalizeHubOrderRules(settings.orderRules),
            shiftAccess: normalizeShiftAccessSettings(settings.shiftAccess),
            allowQuickOpeningFloatEdit: settings.allowQuickOpeningFloatEdit === true,
            staffLoginDestination: settings.staffLoginDestination === 'dashboard' ? 'dashboard' : 'pos',
            coffeeTracking: normalizeHubCoffeeTracking(settings.coffeeTracking),
            inventoryYieldTracking: normalizeHubInventoryYieldTracking(settings.inventoryYieldTracking),
            staffConsumption: normalizeHubStaffConsumption(settings.staffConsumption),
            },
          }
          const normalizedSettings = (document.settings as Record<string, unknown>)
          const coffeeTracking = normalizedSettings.coffeeTracking as StoreSettings['coffeeTracking']
          if (coffeeTracking.enabled) {
            const bean = coffeeTracking.inventoryItemId
              ? validationState.collections.inventoryItems?.[coffeeTracking.inventoryItemId]
              : undefined
            if (!record(bean) || bean.storeId !== actor.storeId || bean.active !== true || bean.baseUnit !== 'g') {
              throw new Error('Coffee yield tracking must reference active gram-based stock in this store.')
            }
          }
          const inventoryYieldTracking = normalizedSettings.inventoryYieldTracking as StoreSettings['inventoryYieldTracking']
          if (inventoryYieldTracking.enabled) {
            if (!inventoryYieldTracking.trackers.length) {
              throw new Error('Inventory yield tracking needs at least one tracked item.')
            }
            for (const tracker of inventoryYieldTracking.trackers) {
              const item = validationState.collections.inventoryItems?.[tracker.inventoryItemId]
              if (!record(item) || item.storeId !== actor.storeId || item.active !== true) {
                throw new Error('Yield tracking must reference active inventory from this store.')
              }
              if (!tracker.productIds.length && !tracker.categoryIds.length) {
                throw new Error('Each tracked inventory item needs at least one consuming product or category.')
              }
              if (tracker.productIds.some((id) => {
                const product = validationState.collections.products?.[id]
                return !record(product) || product.storeId !== actor.storeId
              }) || tracker.categoryIds.some((id) => {
                const category = validationState.collections.categories?.[id]
                return !record(category) || category.storeId !== actor.storeId
              })) {
                throw new Error('Yield tracking must reference products and categories from this store.')
              }
            }
          }
          const staffConsumption = normalizedSettings.staffConsumption as StoreSettings['staffConsumption']
          if (staffConsumption.enabled) {
            if (!staffConsumption.allowances.length) throw new Error('Staff item tracking needs at least one allowance.')
            for (const allowance of staffConsumption.allowances) {
              const product = validationState.collections.products?.[allowance.productId]
              if (!record(product) || product.storeId !== actor.storeId ||
                Array.isArray(product.modifiers) && product.modifiers.some((group) => record(group) && group.required === true)) {
                throw new Error('Staff allowances must reference products without required modifiers in this store.')
              }
            }
          }
        } else {
          validateStoreDoc(operation.document, actor.storeId)
          if (!record(operation.document)) throw new Error('Change set document must be an object.')
          document = operation.document
          if (operation.collection === 'products') {
            document = normalizeHubProduct(document)
            validateHubProductRecipes(document, validationState.collections, actor.storeId)
          }
        }
        if (operation.collection === 'orders' && typeof document.clientOrderId === 'string' &&
          document.clientOrderId) {
          const existingCheckout = Object.values(validationState.collections.orders ?? {}).find((candidate) =>
            candidate.id !== operation.id &&
            candidate.storeId === actor.storeId &&
            candidate.clientOrderId === document.clientOrderId,
          )
          if (existingCheckout) {
            operation.id = existingCheckout.id
            document = existingCheckout
          }
        }
        operation.document = document
        if (document.id !== operation.id) throw new Error('Operation ID does not match document ID.')
        const previousDocument = validationState.collections[operation.collection]?.[operationId]
        if ((operation.collection === 'products' || operation.collection === 'categories') &&
          previousDocument && changedDocuments.has(`${operation.collection}:${operation.id}`) &&
          !isDeepStrictEqual(previousDocument, document)) {
          const label = typeof document.name === 'string'
            ? document.name
            : typeof previousDocument.name === 'string' ? previousDocument.name : operationId
          conflicts.push({ collection: operation.collection, id: operationId, label })
        }
        if (operation.collection === 'printers') validatePrinter(document, actor.storeId, validationState)
        if (operation.collection === 'openOrders') {
          const orderDocument = document
          if (!record(orderDocument) || typeof orderDocument.id !== 'string') {
            throw new Error('Open-order document must have an ID.')
          }
          const incoming: SyncDocument = { ...orderDocument, id: orderDocument.id }
          let mergedInput: SyncDocument = incoming
          const duplicate = incoming.status === 'open'
            ? Object.values(validationState.collections.openOrders ?? {}).find((candidate) =>
                candidate.id !== operation.id && candidate.storeId === actor.storeId &&
                (incoming.tableId
                  ? candidate.tableId === incoming.tableId
                  : typeof incoming.tableName === 'string' && typeof candidate.tableName === 'string' &&
                    candidate.tableName.toLowerCase() === incoming.tableName.toLowerCase()),
              )
            : undefined
          if (duplicate) {
            operationId = duplicate.id
            operation.id = operationId
            mergedInput = {
              ...incoming,
              id: operationId,
              number: duplicate.number,
              staffId: duplicate.staffId,
              staffName: duplicate.staffName,
              shiftId: duplicate.shiftId,
              tableId: duplicate.tableId,
              tableName: duplicate.tableName,
              sectionId: duplicate.sectionId,
              sectionName: duplicate.sectionName,
              createdAt: duplicate.createdAt,
            }
          }
          document = mergeOpenOrderDocument(
            validationState.collections.openOrders?.[operationId],
            mergedInput,
          )
        }
        if (operation.collection === 'orders' || operation.collection === 'openOrders') {
          document = validateOrderDocument(document, operation.collection, validationState, actor)
        }
        if (operation.collection === 'ledger') {
          document = validateLedgerEntry(document, validationState, actor)
        }
        operation.document = document
        if (typeof document.id !== 'string') throw new Error('Change set document must have an ID.')
        const documents = validationState.collections[operation.collection] ?? (validationState.collections[operation.collection] = {})
        documents[operationId] = structuredClone({ ...document, id: document.id })
      } else {
        delete validationState.collections[operation.collection]?.[operation.id]
      }
    }
    if ([...expectedSaleMovements.keys()].some((key) => !claimedSaleMovements.has(key))) {
      throw new Error('Sale stock tracking is incomplete; the inventory movement was not submitted.')
    }
    const changeSet = {
      opId: raw.opId, deviceId: raw.deviceId, storeId: actor.storeId,
      baseSeq: raw.baseSeq as number,
      ops: raw.ops as Parameters<HubStorage['transact']>[1]['ops'],
    }
    const next = await storage.transact(actor.storeId, changeSet)
    if (!fromSocket) sockets.broadcast(actor.storeId, { type: 'sync', seq: next.seq, opId: raw.opId })
    else sockets.broadcast(actor.storeId, { type: 'sync', seq: next.seq, opId: raw.opId })
    return { seq: next.seq, duplicate: false, conflicts }
  }

  async function updateStationStatus(actor: AuthenticatedActor, raw: unknown, broadcast = true): Promise<void> {
    if (!record(raw) || typeof raw.orderId !== 'string' || typeof raw.itemId !== 'string' ||
      typeof raw.stationId !== 'string' || typeof raw.status !== 'string' ||
      !['preparing', 'ready', 'served', 'bumped', 'recalled'].includes(raw.status)) {
      throw new Error('Invalid station status update.')
    }
    requireCapability(actor, 'viewStation')
    const orderId = raw.orderId
    const itemId = raw.itemId
    const stationId = raw.stationId
    const nextStatus = raw.status
    if (actor.stationOnly && !actor.stationIds?.includes(stationId)) throw new Error('Station device is not assigned to this station.')
    const state = await storage.readStore(actor.storeId)
    const order = state.collections.openOrders?.[orderId] as Record<string, unknown> | undefined
    if (!order || order.storeId !== actor.storeId || !Array.isArray(order.items)) throw new Error('Order not found in this store.')
    const transitions: Record<string, string[]> = {
    sent: ['preparing', 'bumped'], preparing: ['ready', 'sent', 'bumped'],
    ready: ['served', 'preparing', 'bumped'], served: ['ready', 'bumped'],
    bumped: ['recalled'], recalled: ['preparing'],
    }
    let updatedItem: Record<string, unknown> | undefined
    const items = (order.items as Array<Record<string, unknown>>).map((item) => {
      if (item.id !== itemId || item.stationId !== stationId) return item
    const key = `${orderId}:${itemId}`
    const currentStatus = state.collections.stationStatuses?.[key]?.status ?? item.status
    if (!(transitions[String(currentStatus)] ?? []).includes(nextStatus)) throw new Error('Invalid station status transition.')
    const itemStatus = nextStatus === 'bumped' ? 'served' : nextStatus === 'recalled' ? 'preparing' : nextStatus
    updatedItem = { ...item, status: itemStatus, updatedAt: new Date().toISOString() }
      return updatedItem
    })
    if (!updatedItem) throw new Error('Station item not found.')
    const updatedOrder = { ...order, items, updatedAt: new Date().toISOString() }
    const statusKey = `${orderId}:${itemId}`
    const stationStatus = {
      id: statusKey, storeId: actor.storeId, orderId: raw.orderId, itemId: raw.itemId,
      stationId, status: nextStatus, updatedById: actor.userId, updatedAt: new Date().toISOString(),
    }
    const next = await storage.transact(actor.storeId, {
      opId: randomUUID(), deviceId: actor.deviceId ?? actor.userId, storeId: actor.storeId, baseSeq: state.seq,
      ops: [
        { kind: 'put', collection: 'openOrders', id: orderId, document: updatedOrder as typeof updatedOrder & { id: string } },
        { kind: 'put', collection: 'stationStatuses', id: statusKey, document: stationStatus },
      ],
    })
    if (broadcast) sockets.broadcast(actor.storeId, { type: 'station-status', seq: next.seq, orderId, item: updatedItem, status: nextStatus, stationId }, [stationId])
  }

  function validatePrinter(document: Record<string, unknown>, storeId: string, state: Awaited<ReturnType<HubStorage['readStore']>>): void {
    const connection = document.connection
    const host = typeof document.host === 'string' ? document.host : ''
    if (typeof document.name !== 'string' || !document.name.trim() || document.name.length > 100) throw new Error('Printer name is required and must be at most 100 characters.')
    if (!['hub-tcp', 'hub-usb', 'hub-serial', 'hub-epson-epos', 'hub-star', 'browser-webserial', 'browser-bluetooth', 'browser-print', 'screen'].includes(String(connection))) {
      throw new Error('Unsupported printer connection.')
    }
    if (document.paperWidth !== 58 && document.paperWidth !== 80) throw new Error('Printer paper width must be 58 or 80 mm.')
    if (!['cp1252', 'cp437', 'cp850', 'cp858'].includes(String(document.codepage))) throw new Error('Unsupported printer codepage.')
    if (!['none', 'partial', 'full'].includes(String(document.cutMode))) throw new Error('Unsupported printer cut mode.')
    if (document.enabled !== undefined && typeof document.enabled !== 'boolean') throw new Error('Printer enabled flag must be boolean.')
    if (document.baudRate !== undefined && (!Number.isInteger(document.baudRate) || Number(document.baudRate) < 300 || Number(document.baudRate) > 115200)) {
      throw new Error('Serial baud rate must be between 300 and 115200.')
    }
    const tcpTransport = connection === 'hub-tcp' || connection === 'hub-epson-epos' || connection === 'hub-star'
    if (tcpTransport && !(connection === 'hub-star' && host.toLowerCase() === 'cloudprnt')) {
      const family = isIP(host)
      const octets = family === 4 ? host.split('.').map(Number) : []
      const privateV4 = family === 4 && (
        octets[0] === 10 || octets[0] === 127 || octets[0] === 169 && octets[1] === 254 ||
        octets[0] === 192 && octets[1] === 168 ||
        octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31
      )
      if (!privateV4 && host !== 'localhost' && !(family === 6 && (host === '::1' || host.toLowerCase().startsWith('fc') || host.toLowerCase().startsWith('fd') || host.toLowerCase().startsWith('fe80:')))) {
        throw new Error('Printer address must be a private LAN IP or localhost.')
      }
      const port = document.port
      if (port !== undefined && (!Number.isInteger(port) || Number(port) < 1 || Number(port) > 65535)) throw new Error('Printer port must be between 1 and 65535.')
    }
    if ((connection === 'hub-usb' || connection === 'hub-serial') && host && process.platform !== 'win32' && !host.startsWith('/dev/')) {
      throw new Error('Linux USB/serial devices must use a /dev/ device path.')
    }
    if (typeof document.osPrinterName === 'string' && document.osPrinterName.length > 200) throw new Error('OS printer name is too long.')
    if (typeof document.fallbackPrinterId === 'string') {
      const fallback = state.collections.printers?.[document.fallbackPrinterId]
      if (document.fallbackPrinterId === document.id || !fallback || fallback.storeId !== storeId) throw new Error('Fallback printer must be a different printer in this store.')
    }
  }

  async function statusPage(response: ServerResponse): Promise<void> {
    const origin = `${tlsOptions ? 'https' : 'http'}://${address}:${port}`
    const stores = await storage.listStoreIds()
    const data = await Promise.all(stores.map(async (storeId) => {
      const state = await storage.readStore(storeId)
      const store = Object.values(state.collections.stores ?? {})[0] as Record<string, unknown> | undefined
      const printers = Object.values(state.collections.printers ?? {}) as unknown as PrinterRecord[]
      const counts = await printQueue.counts(storeId)
      return {
        name: typeof store?.name === 'string' ? store.name : storeId,
        storeId, connectedStaff: sockets.countByStore(storeId, false),
        connectedDevices: sockets.countByStore(storeId, true),
        printers: printers.map((printer) => ({
          name: printer.name, enabled: printer.enabled, connection: printer.connection,
          status: printer.enabled ? 'enabled; health not polled' : 'disabled',
        })),
        queue: counts,
      }
    }))
    const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy()}"><title>7anouti Hub status</title><style>body{font:16px system-ui;max-width:900px;margin:2rem auto;padding:0 1rem;color:#17221c}main{display:grid;grid-template-columns:1fr 240px;gap:2rem}section{border:1px solid #ccd5cf;border-radius:12px;padding:1rem;margin:1rem 0}img{width:220px}code{overflow-wrap:anywhere}@media(max-width:600px){main{grid-template-columns:1fr}}</style><h1>7anouti shop hub</h1><main><div><p>Open this address on devices connected to the shop Wi-Fi:</p><p><a href="${htmlEscape(origin)}">${htmlEscape(origin)}</a></p><p>Hub IP: <code>${htmlEscape(address)}</code> · port ${port} · ${tlsOptions ? 'HTTPS enabled' : 'HTTP only'}</p>${data.map((store) => `<section><h2>${htmlEscape(store.name)}</h2><p>Staff connected: ${store.connectedStaff} · Station devices: ${store.connectedDevices}</p>    <p>Printers: ${store.printers.map((printer) => `${htmlEscape(printer.name)} (${htmlEscape(printer.status)})`).join(', ') || 'none configured'}</p><p>Queue: ${htmlEscape(JSON.stringify(store.queue))}</p></section>`).join('')}</div><img alt="QR code to open the hub app" src="/api/status/qr"></main></html>`
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': contentSecurityPolicy(), 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    })
    response.end(page)
  }

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const started = Date.now()
    const path = (request.url ?? '/').split('?')[0]
    const ip = request.socket.remoteAddress ?? 'unknown'
    const rate = loginLimits.get(ip)
    if (loginLimits.size > 2000) {
      for (const [key, value] of loginLimits) if (value.reset <= Date.now()) loginLimits.delete(key)
    }
    if (!rate || rate.reset <= Date.now()) loginLimits.set(ip, { count: 1, reset: Date.now() + RATE_WINDOW })
    else if (rate.count >= RATE_LIMIT) {
      sendJson(response, 429, { error: 'Rate limit exceeded.' })
      return
    } else rate.count += 1

    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Frame-Options', 'DENY')
    const origin = request.headers.origin
    if (!originAllowed(typeof origin === 'string' ? origin : undefined, request, address, port, !!tlsOptions)) {
      sendJson(response, 403, { error: 'Origin is not allowed.' })
      return
    }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Device-Id')
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }
    try {
      if (path === '/health' && request.method === 'GET') return sendJson(response, 200, { ok: true, time: new Date().toISOString() })
      if (path === '/status' && request.method === 'GET') return await statusPage(response)
      if (request.method === 'GET' && (path === '/kitchen' || /^\/station\/[a-zA-Z0-9._:-]{1,128}$/.test(path))) {
        const stationId = path === '/kitchen' ? '' : path.slice('/station/'.length)
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
          'Content-Security-Policy': contentSecurityPolicy(), 'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        })
        response.end(stationBoardHtml(stationId))
        return
      }
      if (path === '/api/status' && request.method === 'GET') {
        const stores = await storage.listStoreIds()
        return sendJson(response, 200, { ok: true, address, port, secure: !!tlsOptions, stores: stores.length })
      }
      if (path === '/api/status/qr' && request.method === 'GET') {
        const originUrl = `${tlsOptions ? 'https' : 'http'}://${address}:${port}`
        response.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
        response.end(qrSvg(originUrl))
        return
      }
      if (path === '/api/auth/setup' && request.method === 'POST') {
        const body = await readJson(request)
        const setupToken = request.headers['x-setup-token'] ?? body.setupToken
        const result = await auth.setupOwner(body, setupToken, ip)
        return sendJson(response, 201, result)
      }
      if (path === '/api/auth/login' && request.method === 'POST') {
        const body = await readJson(request)
        const storeCode = requireString(body.storeCode, 'store code', 40)
        const username = requireString(body.username, 'username', 64)
        const secret = requireString(body.secret, 'password or PIN', 128)
        return sendJson(response, 200, await auth.login(storeCode, username, secret, ip))
      }
      if (path === '/api/auth/verify-pin' && request.method === 'POST') {
        const actor = await actorFor(request)
        if (actor.stationOnly) throw Object.assign(new Error('Station devices cannot verify staff PINs.'), { status: 403 })
        const body = await readJson(request)
        const pin = requireString(body.pin, 'PIN', PIN_MAX_LENGTH)
        return sendJson(response, 200, { verified: await auth.verifyPin(actor, pin, ip) })
      }
      if (path === '/api/auth/verify-authorization-pin' && request.method === 'POST') {
        const body = await readJson(request)
        const storeId = requireString(body.storeId, 'store ID', 80)
        const actor = await actorFor(request, storeId)
        if (actor.stationOnly) throw Object.assign(new Error('Station devices cannot verify staff PINs.'), { status: 403 })
        const pin = requireString(body.pin, 'PIN', PIN_MAX_LENGTH)
        if (body.purpose !== 'void-order' && body.purpose !== 'cancel-table' && body.purpose !== 'override-stock') {
          throw Object.assign(new Error('Choose a valid PIN authorization purpose.'), { status: 400 })
        }
        const confirmer = await auth.verifyAuthorizationPin(actor, pin, body.purpose, ip)
        return sendJson(response, 200, { verified: confirmer !== null, confirmer })
      }
      if (path === '/api/auth/logout' && request.method === 'POST') {
        const token = bearer(request)
        if (token) auth.revoke(token)
        return sendJson(response, 200, { ok: true })
      }
      if (path === '/api/station/pair' && request.method === 'POST') {
        const body = await readJson(request)
        return sendJson(response, 200, await auth.pair(requireString(body.storeCode, 'store code', 40), requireString(body.pairingCode, 'pairing code', 6), ip))
      }
      if (path === '/api/setup/import-backup' && request.method === 'POST') {
        const body = await readJson(request, 50 * 1024 * 1024)
        const setupToken = request.headers['x-setup-token'] ?? body.setupToken
        auth.beginSetup(setupToken, ip)
        let succeeded = false
        try {
          if ((await storage.listStoreIds()).length) {
            throw Object.assign(new Error('Backup bootstrap is available only on an empty hub.'), { status: 409 })
          }
          const ids = await storage.importAppBackup(body.backup)
          await auth.reindexDevices()
          auth.finishSetup(true)
          succeeded = true
          return sendJson(response, 201, { stores: ids })
        } finally {
          if (!succeeded) auth.finishSetup(false)
        }
      }
      if (path === '/api/backup' && request.method === 'POST') {
        const { actor, storeId } = await authorizedStore(request)
        requireCapability(actor, 'manageSettings')
        const filename = await storage.backupNow([storeId])
        return sendJson(response, 201, { filename: relative(storage.root, filename) })
      }
      if (path === '/api/backup/health' && request.method === 'GET') {
        const actor = await actorFor(request)
        return sendJson(response, 200, { lastBackupAt: await storage.lastBackupAt(actor.storeId) })
      }
      if (path === '/api/restore' && request.method === 'POST') {
        const body = await readJson(request)
        const { actor } = await authorizedStore(request, body)
        requireCapability(actor, 'manageSettings')
        const filename = requireString(body.filename, 'backup filename', 64)
        const restored = await storage.restoreSnapshot(filename, actor.storeId)
        await auth.reindexDevices()
        return sendJson(response, 200, { restored })
      }
      if (path === '/api/sync' && request.method === 'POST') {
        const body = await readJson(request)
        const { actor } = await authorizedStore(request, body)
        return sendJson(response, 200, await applySync(actor, body))
      }
      if (path === '/api/sync/snapshot' && request.method === 'GET') {
        const actor = await actorFor(request)
        const state = await storage.readStore(actor.storeId)
        const storeForAccess = state.collections.stores?.[actor.storeId] as unknown as Store | undefined
        const shiftAccess = normalizeShiftAccessSettings(storeForAccess?.settings.shiftAccess)
        const hasOpenStaffShift = Object.values(state.collections.registerSessions ?? {}).some((session) =>
          session.storeId === actor.storeId && session.status === 'open' &&
          ((session.staffId as string | undefined) ?? (session.openedById as string | undefined)) === actor.userId,
        )
        const waitingForShift = actor.role === 'staff' && !actor.stationOnly &&
          shiftAccess.requireOpenShiftForStoreAccess && !hasOpenStaffShift
        const collections: Record<string, Array<Record<string, unknown>>> = {}
        for (const [name, documents] of Object.entries(state.collections)) {
          if (waitingForShift && ![
            'stores', 'users', 'shifts', 'registerSessions', 'attendance', 'cashDifferences', 'auditLogs',
          ].includes(name)) continue
          const permission = PRIVATE_COLLECTIONS[name]
          if (name !== 'stores') {
            if (name === 'shifts' && !canManageSchedules(actor) &&
              actor.role !== 'staff' && actor.role !== 'admin' && actor.role !== 'manager') continue
            if (name === 'registerSessions' && actor.role !== 'admin' && actor.role !== 'manager' &&
              !can(actor, 'openShift') && !can(actor, 'closeShift')) continue
            if (name === 'registerDayReports' && actor.role !== 'admin' &&
              !(actor.role === 'manager' && can(actor, 'forceCloseShift'))) continue
            if (permission === 'ledger') {
              const quick = !!storeForAccess && isQuick(storeForAccess)
              if (quick
                ? !can(actor, 'viewTabs') && !can(actor, 'addToTabs') && !can(actor, 'settleTabs')
                : actor.role !== 'admin' && actor.permissions.credit !== true && actor.permissions.settle !== true) continue
            } else if (name === 'customers' && storeForAccess && isQuick(storeForAccess)) {
              if (!can(actor, 'viewTabs') && !can(actor, 'addToTabs') &&
                !can(actor, 'settleTabs') && !can(actor, 'manageCustomers')) continue
            } else if (name === 'expenses' && storeForAccess) {
              const expensesPermission = isQuickStoreDocument(storeForAccess) ? 'viewExpenses' : 'manageSettings'
              if (!can(actor, expensesPermission)) continue
            } else if (permission && !(name === 'cashDifferences' && actor.role === 'staff') &&
              !can(actor, permission)) continue
          }
          collections[name] = Object.values(documents).filter((document) => {
            if (name === 'stores' ? document.id !== actor.storeId : document.storeId !== actor.storeId) return false
            if (waitingForShift && name === 'users' && document.id !== actor.userId) return false
            if (name === 'registerSessions' && actor.role === 'staff' && actor.permissions.supervisor !== true) {
              const session = document as Record<string, unknown>
              const ownerId = typeof session.staffId === 'string' ? session.staffId : session.openedById
              if (ownerId !== actor.userId) return false
            }
            if (name === 'cashDifferences' && actor.role === 'staff' &&
              document.staffId !== actor.userId) return false
            if (name === 'shifts' && actor.role === 'staff' && !canManageSchedules(actor) &&
              document.userId !== actor.userId) return false
            if (waitingForShift && name === 'attendance' && document.userId !== actor.userId) return false
            if (waitingForShift && name === 'auditLogs' && document.userId !== actor.userId) return false
            if (actor.stationOnly) {
              if (name === 'stores') return true
              return name === 'openOrders' && Array.isArray(document.items) &&
                (document.items as Array<Record<string, unknown>>).some((item) =>
                  typeof item.stationId === 'string' && actor.stationIds?.includes(item.stationId),
                )
            }
            return true
          }).map((document) => {
            if (actor.stationOnly && name === 'openOrders' && Array.isArray(document.items)) {
              return {
                ...document,
                items: (document.items as Array<Record<string, unknown>>).filter((item) =>
                  typeof item.stationId === 'string' && actor.stationIds?.includes(item.stationId),
                ),
              }
            }
            if (name !== 'users' && name !== 'stationDevices') return document
            const safe = { ...document }
            delete safe.password
            delete safe.pin
            delete safe.deviceTokenHash
            return safe
          })
        }
        const currentUser = state.collections.users?.[actor.userId]
        if (currentUser && !collections.users?.some((user) => user.id === actor.userId)) {
          const safe = { ...currentUser }
          delete safe.password
          delete safe.pin
          delete safe.deviceTokenHash
          collections.users = [...(collections.users ?? []), safe]
        }
        return sendJson(response, 200, { storeId: actor.storeId, seq: state.seq, collections })
      }
      if (path === '/api/stations' && request.method === 'GET') {
        const actor = await actorFor(request)
        requireCapability(actor, 'viewStation')
        const state = await storage.readStore(actor.storeId)
        const stations = Object.values(state.collections.stations ?? {}).filter((station) =>
          station.active === true && station.screen === true && (!actor.stationOnly || actor.stationIds?.includes(String(station.id))),
        )
        const store = state.collections.stores?.[actor.storeId] as unknown as Store | undefined
        const availabilitySettings = store?.settings.availability
        let eightySixCount: number | undefined
        if (store && availabilitySettings?.showCountOnStationScreens !== false) {
          const products = Object.values(state.collections.products ?? {}) as unknown as Product[]
          const inventoryItems = Object.values(state.collections.inventoryItems ?? {}) as unknown as InventoryItem[]
          eightySixCount = products.filter((product) => product.storeId === actor.storeId && product.active)
            .reduce((count, product) => {
              const inventory = inventoryItems.find((item) => item.id === product.inventoryItemId && item.storeId === actor.storeId)
              const variants = product.variants ?? []
              if (!variants.length) {
                return count + Number(isUnavailable(product, undefined, availabilitySettings, inventory).unavailable)
              }
              return count + variants.reduce((variantCount, variant) =>
                variantCount + Number(isUnavailable(product, variant, availabilitySettings, inventory).unavailable), 0)
            }, 0)
        }
        const orders = Object.values(state.collections.openOrders ?? {}).flatMap((order) => {
          if (order.storeId !== actor.storeId || !Array.isArray(order.items)) return []
          const items = (order.items as Array<Record<string, unknown>>).filter((item) => {
            const status = state.collections.stationStatuses?.[`${order.id}:${item.id}`]?.status ?? item.status
            return typeof item.stationId === 'string' && (!actor.stationOnly || actor.stationIds?.includes(item.stationId)) &&
              (['sent', 'preparing', 'ready'].includes(String(item.status)) || status === 'bumped')
          }).map((item) => ({
            ...item,
            boardStatus: state.collections.stationStatuses?.[`${order.id}:${item.id}`]?.status ?? item.status,
          }))
          return items.length ? [{ ...order, items }] : []
        })
        return sendJson(response, 200, { seq: state.seq, stations, orders, eightySixCount })
      }
      if (path === '/api/print' && request.method === 'POST') {
        const body = await readJson(request)
        const { actor, storeId } = await authorizedStore(request, body)
        if (actor.deviceToken) throw Object.assign(new Error('Station devices cannot enqueue print jobs.'), { status: 403 })
        const printerId = requireString(body.printerId, 'printer ID', 128)
        const state = await storage.readStore(storeId)
        const printer = state.collections.printers?.[printerId] as unknown as PrinterRecord | undefined
        if (!printer || printer.storeId !== storeId || !printer.enabled) throw new Error('Printer is unavailable in this store.')
        const payload = body.payload
        if (!Array.isArray(payload) || payload.length > 200 || payload.some((line) =>
          !record(line) || typeof line.text !== 'string' || line.text.length > 512 ||
          (line.bold !== undefined && typeof line.bold !== 'boolean') ||
          (line.size !== undefined && !['normal', 'double'].includes(String(line.size))) ||
          (line.align !== undefined && !['left', 'center', 'right'].includes(String(line.align))),
        )) throw new Error('Invalid print payload.')
        const jobTypes = ['receipt', 'kitchen', 'bar', 'report', 'label', 'test']
        if (body.type !== undefined && !jobTypes.includes(String(body.type))) throw new Error('Invalid print job type.')
        if (body.copies !== undefined && (typeof body.copies !== 'number' || !Number.isFinite(body.copies))) throw new Error('Invalid print copy count.')
        if (body.stationId !== undefined && !validId(body.stationId)) throw new Error('Invalid station ID.')
        if (body.openDrawer === true && actor.role === 'staff' && actor.permissions.register !== true) {
          throw Object.assign(new Error('Permission denied: register access is required for a drawer kick.'), { status: 403 })
        }
        const job = await printQueue.enqueue({
          storeId, printerId, type: typeof body.type === 'string' ? body.type as PrintJobRecord['type'] : 'test',
          stationId: typeof body.stationId === 'string' ? body.stationId : undefined,
          payload: payload as PrintJobRecord['payload'],
          copies: typeof body.copies === 'number' ? Math.min(10, Math.max(1, Math.trunc(body.copies))) : 1,
          createdById: actor.userId,
          openDrawer: body.openDrawer === true,
          idempotencyKey: typeof body.opId === 'string' ? requireString(body.opId, 'print idempotency key', 128) : undefined,
        })
        return sendJson(response, 202, { job })
      }
      if (path === '/api/print/test' && request.method === 'POST') {
        const body = await readJson(request)
        const { actor, storeId } = await authorizedStore(request, body)
        requireCapability(actor, 'manageSettings')
        const printerId = requireString(body.printerId, 'printer ID', 128)
        const state = await storage.readStore(storeId)
        const printer = state.collections.printers?.[printerId] as unknown as PrinterRecord | undefined
        if (!printer || printer.storeId !== storeId || !printer.enabled) throw new Error('Printer is unavailable in this store.')
        return sendJson(response, 202, { job: await printQueue.test(storeId, printerId, actor.userId) })
      }
      if (path === '/api/print/jobs' && request.method === 'GET') {
        const actor = await actorFor(request)
        const state = await storage.readStore(actor.storeId)
        const jobs = Object.values(state.collections.printJobs ?? {}) as unknown as PrintJobRecord[]
        return sendJson(response, 200, { jobs: jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500) })
      }
      if (path === '/api/printers/status' && request.method === 'GET') {
        const actor = await actorFor(request)
        const state = await storage.readStore(actor.storeId)
        return sendJson(response, 200, {
          printers: await printQueue.statuses(actor.storeId, state),
          offlineSince: printQueue.offlineSince(actor.storeId),
        })
      }
      if (path === '/api/print/retry' && request.method === 'POST') {
        const body = await readJson(request)
        const { actor, storeId } = await authorizedStore(request, body)
        requireCapability(actor, 'manageSettings')
        const jobId = requireString(body.jobId, 'job ID', 128)
        const state = await storage.readStore(storeId)
        const job = state.collections.printJobs?.[jobId] as unknown as PrintJobRecord | undefined
        if (!job || job.storeId !== storeId || job.status !== 'failed') throw new Error('Failed print job not found.')
        await printQueue.update({ ...job, status: 'queued', attempts: 0, lastError: undefined, nextAttemptAt: undefined })
        return sendJson(response, 200, { ok: true })
      }
      if (path === '/api/print/cancel' && request.method === 'POST') {
        const body = await readJson(request)
        const { actor, storeId } = await authorizedStore(request, body)
        requireCapability(actor, 'manageSettings')
        const jobId = requireString(body.jobId, 'job ID', 128)
        const state = await storage.readStore(storeId)
        const job = state.collections.printJobs?.[jobId] as unknown as PrintJobRecord | undefined
        if (!job || job.storeId !== storeId || job.status !== 'queued') throw new Error('Queued print job not found.')
        await printQueue.update({ ...job, status: 'cancelled' })
        return sendJson(response, 200, { ok: true })
      }
      if (path === '/api/printers/discover' && request.method === 'POST') {
        const body = await readJson(request)
        const { actor } = await authorizedStore(request, body)
        requireCapability(actor, 'manageSettings')
        return sendJson(response, 200, { printers: await discoverRawPrinters() })
      }
      if (path === '/api/station/status' && request.method === 'POST') {
        const body = await readJson(request)
        const { actor } = await authorizedStore(request, body)
        await updateStationStatus(actor, body)
        return sendJson(response, 200, { ok: true })
      }
      if (path.startsWith('/api/cloudprnt/') && request.method === 'GET') {
        if (!process.env.HUB_CLOUDPRNT_TOKEN || bearer(request) !== process.env.HUB_CLOUDPRNT_TOKEN) {
          throw Object.assign(new Error('CloudPRNT authentication failed.'), { status: 401 })
        }
        const [, , , storeId, printerId] = path.split('/')
        if (!validId(storeId) || !validId(printerId)) throw new Error('Invalid printer path.')
        const result = await printQueue.cloudPoll(storeId, printerId)
        if (!result) {
          response.writeHead(204)
          response.end()
          return
        }
        response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'X-Print-Job-Id': result.job.id, 'Cache-Control': 'no-store' })
        response.end(Buffer.from(result.bytes))
        return
      }
      if (path.startsWith('/api/cloudprnt/') && request.method === 'POST') {
        if (!process.env.HUB_CLOUDPRNT_TOKEN || bearer(request) !== process.env.HUB_CLOUDPRNT_TOKEN) {
          throw Object.assign(new Error('CloudPRNT authentication failed.'), { status: 401 })
        }
        const [, , , storeId, printerId] = path.split('/')
        if (!validId(storeId) || !validId(printerId)) throw new Error('Invalid printer path.')
        const body = await readJson(request)
        if (typeof body.jobId !== 'string' || typeof body.success !== 'boolean') throw new Error('Invalid CloudPRNT result.')
        await printQueue.reportCloudPrint(storeId, body.jobId, body.success, typeof body.message === 'string' ? body.message : undefined)
        return sendJson(response, 200, { ok: true })
      }
      if (path.startsWith('/api/')) throw Object.assign(new Error('API endpoint not found.'), { status: 404 })
      if (request.method !== 'GET') throw Object.assign(new Error('Method not allowed.'), { status: 405 })
      await serveApp(response, path)
    } catch (error) {
      const detail = jsonResponseError(error)
      sendJson(response, detail.status, { error: detail.message })
      if (detail.status >= 500) await logEvent(storage.root, 'error', `${request.method} ${path} failed with status ${detail.status}.`)
    } finally {
      if (!path.startsWith('/api/auth/')) await logEvent(storage.root, 'info', `${request.method} ${path} ${response.statusCode || 200} ${Date.now() - started}ms`)
    }
  }

  async function serveApp(response: ServerResponse, path: string): Promise<void> {
    const dist = resolve(process.env.HUB_DIST_DIR ?? fileURLToPath(new URL('../../dist/', import.meta.url)))
    let relativePath = path === '/' ? 'index.html' : decodeURIComponent(path.slice(1))
    if (relativePath.includes('\0')) throw Object.assign(new Error('Invalid app path.'), { status: 400 })
    let target = resolve(dist, relativePath)
    const fromDist = relative(dist, target)
    if (fromDist.startsWith(`..${sep}`) || fromDist === '..' || resolve(dist, fromDist) !== target) {
      throw Object.assign(new Error('Invalid app path.'), { status: 400 })
    }
    try {
      const fileStat = await stat(target)
      if (fileStat.isDirectory()) target = join(target, 'index.html')
      await access(target)
    } catch {
      target = join(dist, 'index.html')
      try { await access(target) } catch {
        throw Object.assign(new Error('Built app is not available. Run npm run build.'), { status: 503 })
      }
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(target)] ?? 'application/octet-stream',
      'Cache-Control': target.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
      'Content-Security-Policy': contentSecurityPolicy(),
      'X-Content-Type-Options': 'nosniff',
    })
    createReadStream(target).pipe(response)
  }

  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'))
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(port, address, () => {
      server.removeListener('error', reject)
      resolveListen()
    })
  })
  try {
    virtualPrinter = await startVirtualPrinter()
  } catch (error) {
    await logEvent(storage.root, 'warn', `Virtual printer did not start: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
  const scheme = tlsOptions ? 'https' : 'http'
  scheduleDailyBackup(storage)
  await logEvent(storage.root, 'info', `Hub listening at ${scheme}://${address}:${port}.`)
  return {
    server, address, port, storage,
    close: async () => {
      printQueue.stop()
      virtualPrinter?.close()
      await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()))
    },
  }

  function scheduleDailyBackup(storage: HubStorage): void {
    const schedule = () => {
      const now = new Date()
      const next = new Date(now)
      next.setHours(24, 0, 0, 0)
      const timer = setTimeout(async () => {
        try {
          const date = new Date().toISOString().slice(0, 10)
          await storage.saveSnapshot(date, await storage.listStoreIds())
          await logEvent(storage.root, 'info', `Daily backup completed for ${date}.`)
        } catch (error) {
          await logEvent(storage.root, 'error', `Daily backup failed: ${error instanceof Error ? error.message : 'unknown error'}`)
        } finally {
          schedule()
        }
      }, Math.max(1000, next.getTime() - now.getTime()))
      timer.unref()
    }
    schedule()
  }
}

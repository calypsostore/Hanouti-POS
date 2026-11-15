export const MAX_BODY_BYTES = 1_048_576
const SAFE_ID = /^[a-zA-Z0-9._:-]{1,128}$/

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value)
}

export function requireString(value: unknown, field: string, maximum = 200): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || value.trim() !== value) {
    throw new Error(`Invalid ${field}.`)
  }
  return value
}

export function validateStoreDoc(value: unknown, storeId: string): asserts value is Record<string, unknown> & { id: string; storeId: string } {
  if (!record(value) || !validId(value.id) || value.storeId !== storeId) throw new Error('Document must have a valid ID and belong to this store.')
  if (JSON.stringify(value).length > MAX_BODY_BYTES) throw new Error('Document is too large.')
}

export interface LoginFailureState {
  count: number
  lockedUntil: number
  updatedAt: number
}

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_MS = 30_000
const MAX_FAILURE_AGE_MS = 24 * 60 * 60 * 1000
const MAX_FAILURE_ENTRIES = 1000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const pruneFailures = (failures: Map<string, LoginFailureState>, now: number): void => {
  for (const [key, failure] of failures) {
    if ((failure.count === 0 && failure.lockedUntil <= now) ||
      failure.updatedAt < now - MAX_FAILURE_AGE_MS) {
      failures.delete(key)
    }
  }
  if (failures.size <= MAX_FAILURE_ENTRIES) return
  const oldest = [...failures.entries()].sort(([, left], [, right]) => left.updatedAt - right.updatedAt)
  for (const [key] of oldest.slice(0, failures.size - MAX_FAILURE_ENTRIES)) failures.delete(key)
}

export function parseLoginFailures(raw: string | null, now = Date.now()): Map<string, LoginFailureState> {
  if (!raw) return new Map()
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed)) throw new Error('Stored local login lockouts are invalid.')
  const failures = new Map<string, LoginFailureState>()
  for (const [key, value] of Object.entries(parsed)) {
    if (!isRecord(value) || !Number.isSafeInteger(value.count) ||
      !Number.isFinite(value.lockedUntil) || !Number.isFinite(value.updatedAt)) continue
    failures.set(key, {
      count: Number(value.count),
      lockedUntil: Number(value.lockedUntil),
      updatedAt: Number(value.updatedAt),
    })
  }
  pruneFailures(failures, now)
  return failures
}

export function serializeLoginFailures(
  failures: Map<string, LoginFailureState>,
  now = Date.now(),
): string {
  pruneFailures(failures, now)
  return JSON.stringify(Object.fromEntries(failures))
}

export function lockoutSeconds(failure: LoginFailureState | undefined, now = Date.now()): number {
  return failure && failure.lockedUntil > now
    ? Math.ceil((failure.lockedUntil - now) / 1000)
    : 0
}

export function recordLoginFailure(
  failures: Map<string, LoginFailureState>,
  key: string,
  now = Date.now(),
): number {
  const attempts = (failures.get(key)?.count ?? 0) + 1
  failures.set(key, {
    count: attempts >= MAX_LOGIN_ATTEMPTS ? 0 : attempts,
    lockedUntil: attempts >= MAX_LOGIN_ATTEMPTS ? now + LOCKOUT_MS : 0,
    updatedAt: now,
  })
  pruneFailures(failures, now)
  return attempts
}

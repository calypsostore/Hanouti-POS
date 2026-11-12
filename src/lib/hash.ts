const ITERATIONS = 120_000
const encoder = new TextEncoder()

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

export const isSecretHash = (value: string) =>
  /^pbkdf2\$\d+\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/.test(value)

export const hashSecret = async (value: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return `pbkdf2$${ITERATIONS}$${encode(salt)}$${encode(new Uint8Array(bits))}`
}

export const verifySecret = async (value: string, stored: string): Promise<boolean> => {
  const [, iterationsValue, saltValue, expectedValue] = stored.split('$')
  if (!iterationsValue || !saltValue || !expectedValue) return false
  const iterations = Number(iterationsValue)
  if (!Number.isInteger(iterations) || iterations < 1) return false
  let salt: ArrayBuffer
  let expected: Uint8Array
  try {
    const saltBytes = decode(saltValue)
    const saltBuffer = new ArrayBuffer(saltBytes.byteLength)
    new Uint8Array(saltBuffer).set(saltBytes)
    salt = saltBuffer
    expected = decode(expectedValue)
  } catch {
    return false
  }
  const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  const actual = new Uint8Array(bits)
  if (actual.length !== expected.length) return false
  let difference = 0
  for (let i = 0; i < actual.length; i += 1) difference |= actual[i] ^ expected[i]
  return difference === 0
}

// Hashing in this browser demo reduces casual exposure; real security requires the Phase 2 backend in docs/PRODUCTION_PLAN.md.

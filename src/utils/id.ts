let fallbackCounter = 0

export function createClientId(prefix: string, timestamp = Date.now()): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) return `${prefix}-${cryptoApi.randomUUID()}`

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(12)
    cryptoApi.getRandomValues(bytes)
    const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${prefix}-${timestamp}-${suffix}`
  }

  fallbackCounter += 1
  return `${prefix}-${timestamp}-${fallbackCounter}`
}

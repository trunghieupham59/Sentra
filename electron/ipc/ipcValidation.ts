export interface IpcInvalidInputResponse {
  success: false
  error: string
  errorCode: 'INVALID_INPUT'
}

export function invalidIpcInput(error: string): IpcInvalidInputResponse {
  return { success: false, error, errorCode: 'INVALID_INPUT' }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

export function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean'
}

export function isSafeLanguageCode(value: unknown): value is string {
  return typeof value === 'string' && /^(auto|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?)$/.test(value)
}


import { isValidProvider, type SupportedProvider, unknownProviderError } from './providers/types'

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

export interface ParsedProviderModel {
  provider: SupportedProvider
  model: string
}

export function parseProviderModel(
  rawParams: unknown,
  {
    payloadName,
    maxModelChars,
  }: {
    payloadName: string
    maxModelChars: number
  },
):
  | { ok: true; value: ParsedProviderModel; params: Record<string, unknown> }
  | { ok: false; response: { success: false; error: string; errorCode?: string } } {
  if (!isRecord(rawParams)) {
    return { ok: false, response: invalidIpcInput(`${payloadName} payload must be an object`) }
  }

  if (!isNonEmptyString(rawParams.provider)) {
    return { ok: false, response: invalidIpcInput('Provider is required') }
  }
  const provider = rawParams.provider.trim()
  if (!isValidProvider(provider)) {
    return { ok: false, response: unknownProviderError(provider) }
  }

  if (!isNonEmptyString(rawParams.model)) {
    return { ok: false, response: invalidIpcInput('Model is required') }
  }
  const model = rawParams.model.trim()
  if (model.length > maxModelChars) {
    return { ok: false, response: invalidIpcInput('Model is too long') }
  }

  return { ok: true, value: { provider, model }, params: rawParams }
}

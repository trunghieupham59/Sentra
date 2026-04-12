export type Provider = 'gemini' | 'claude' | 'openai'

export interface ProviderConfig {
  id: Provider
  name: string
  color: string
  emoji: string
  keyPrefix: string
  docsUrl: string
  models: ModelConfig[]
}

export interface ModelConfig {
  id: string
  name: string
  description: string
}

export interface Language {
  code: string
  name: string
  nativeName: string
}

export interface TranslateParams {
  provider: Provider
  model: string
  sourceText: string
  sourceLang: string
  targetLang: string
}

export interface TranslateResult {
  success: boolean
  translatedText?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | string
}

export interface KeychainResult {
  success?: boolean
  exists?: boolean
  masked?: string | null
  error?: string
}

export interface VerifyResult {
  success: boolean
  error?: string
  errorCode?: 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | string
  valid?: boolean
}

export interface FetchedModel {
  id: string
  name: string
  description: string
}

export interface FetchModelsResult {
  success: boolean
  models: FetchedModel[]
  error?: string
  errorCode?: 'NO_API_KEY' | string
}

export interface HistoryItem {
  id: string
  timestamp: number
  provider: Provider
  model: string
  sourceLang: string
  targetLang: string
  sourceText: string
  translatedText: string
}

// Window API (exposed via contextBridge)
export interface WindowApi {
  keychain: {
    save: (provider: string, key: string) => Promise<KeychainResult>
    get: (provider: string) => Promise<KeychainResult>
    delete: (provider: string) => Promise<KeychainResult>
    hasKey: (provider: string) => Promise<{ exists: boolean }>
  }
  fetchModels: (provider: string) => Promise<FetchModelsResult>
  verifyKey: (provider: string, apiKey: string) => Promise<VerifyResult>
  translate: (params: TranslateParams) => Promise<TranslateResult>
  platform: string
  version: string
}

declare global {
  interface Window {
    api: WindowApi
  }
}

import type { PhoneticMode, TranslationStyle } from './translateValidation'

export type TranslateFn = (
  apiKey: string,
  model: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  showFurigana: boolean,
  style: TranslationStyle,
  phoneticOnly: boolean,
  phoneticMode: PhoneticMode,
) => Promise<string>

export type RewriteFn = (
  apiKey: string,
  model: string,
  text: string,
  lang: string,
  style?: TranslationStyle,
) => Promise<string>

export type DetectFn = (apiKey: string, model: string, prompt: string) => Promise<string>
export type VerifyFn = (apiKey: string) => Promise<void>

export type StreamFn = (
  apiKey: string,
  model: string,
  prompt: string,
  onToken: (token: string) => void,
) => Promise<string>

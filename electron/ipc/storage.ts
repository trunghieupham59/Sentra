/**
 * Secure key storage using Electron's built-in safeStorage API.
 * Replaces keytar — no native module compilation required.
 * Data is encrypted with OS-level encryption and stored in the app's userData directory.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { app, safeStorage } from 'electron'

const KEYS_FILE_NAME = 'api-keys.enc'
const KEYCHAIN_SERVICE = 'TranslateApp'

function getKeysFilePath(): string {
  return path.join(app.getPath('userData'), KEYS_FILE_NAME)
}

function loadEncryptedKeys(): Record<string, string> {
  try {
    const filePath = getKeysFilePath()
    if (!fs.existsSync(filePath)) return {}
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveEncryptedKeys(data: Record<string, string>): void {
  const filePath = getKeysFilePath()
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8')
}

/**
 * Check if an API key exists WITHOUT decrypting it.
 * This avoids triggering the macOS Keychain password dialog on startup.
 */
export function hasStoredApiKey(provider: string): boolean {
  try {
    const encrypted = loadEncryptedKeys()
    const key = `${KEYCHAIN_SERVICE}:${provider}`
    return !!(encrypted[key] ?? encrypted[provider])
  } catch {
    return false
  }
}

export function getStoredApiKey(provider: string): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const encrypted = loadEncryptedKeys()
    const key = `${KEYCHAIN_SERVICE}:${provider}`
    const encoded = encrypted[key] ?? encrypted[provider]
    if (!encoded) return null
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch {
    return null
  }
}

export function setStoredApiKey(provider: string, apiKey: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system.')
  }
  const encrypted = loadEncryptedKeys()
  const key = `${KEYCHAIN_SERVICE}:${provider}`
  encrypted[key] = safeStorage.encryptString(apiKey).toString('base64')
  // Clean up old-format key if present
  delete encrypted[provider]
  saveEncryptedKeys(encrypted)
}

export function deleteStoredApiKey(provider: string): boolean {
  const encrypted = loadEncryptedKeys()
  const key = `${KEYCHAIN_SERVICE}:${provider}`
  const hadNew = key in encrypted
  const hadOld = provider in encrypted
  delete encrypted[key]
  delete encrypted[provider]
  if (hadNew || hadOld) {
    saveEncryptedKeys(encrypted)
    return true
  }
  return false
}

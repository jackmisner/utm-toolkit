/**
 * UTM Parameter Storage Utility
 *
 * Manages persistence of UTM parameters in browser storage.
 * Supports sessionStorage (ephemeral) and localStorage (persistent, optionally with TTL).
 * Data is stored in an envelope format: { params, iat, eat }.
 */

import type { KeyFormat, StorageType, UtmParameters } from '../types'
import { convertParams, isSnakeCaseUtmKey, isCamelCaseUtmKey, isUtmKey } from './keys'

/**
 * Default storage key for UTM parameters
 */
export const DEFAULT_STORAGE_KEY = 'utm_parameters'

/**
 * Options for storage operations
 */
export interface StorageOptions {
  /** Storage key to use (default: 'utm_parameters') */
  storageKey?: string

  /** Key format to store parameters in (default: 'snake_case') */
  keyFormat?: KeyFormat

  /** Storage backend: 'session' or 'local' (default: 'session') */
  storageType?: StorageType

  /** TTL in milliseconds (only applies to localStorage, ignored for sessionStorage) */
  ttl?: number
}

/**
 * Internal envelope format for stored data
 */
interface StoredUtmEnvelope {
  params: UtmParameters
  /** Issued at (timestamp in ms) */
  iat: number
  /** Expires at (timestamp in ms, or null for no expiry) */
  eat: number | null
}

/**
 * Get the browser storage backend for the given type
 */
function getStorageBackend(type: StorageType = 'session'): Storage | null {
  try {
    const storage = type === 'local' ? localStorage : sessionStorage
    if (typeof storage === 'undefined') {
      return null
    }
    // Test write/read to ensure it's actually functional
    const testKey = '__utm_test__'
    storage.setItem(testKey, 'test')
    storage.removeItem(testKey)
    return storage
  } catch {
    return null
  }
}

/**
 * Check if a storage backend is available
 *
 * @param type - Storage type to check (default: 'session')
 * @returns True if the storage backend is available and functional
 */
export function isStorageAvailable(type: StorageType = 'session'): boolean {
  return getStorageBackend(type) !== null
}

/**
 * Check if sessionStorage is available in the current environment
 *
 * @deprecated Use isStorageAvailable('session') instead
 * @returns True if sessionStorage is available and functional
 */
export function isSessionStorageAvailable(): boolean {
  return isStorageAvailable('session')
}

/**
 * Check if localStorage is available in the current environment
 *
 * @returns True if localStorage is available and functional
 */
export function isLocalStorageAvailable(): boolean {
  return isStorageAvailable('local')
}

/**
 * Detect whether stored data is in the new envelope format or the old flat format
 */
function isEnvelopeFormat(data: unknown): data is StoredUtmEnvelope {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false
  }
  const obj = data as Record<string, unknown>
  return (
    'params' in obj &&
    typeof obj.params === 'object' &&
    obj.params !== null &&
    'iat' in obj &&
    typeof obj.iat === 'number'
  )
}

/**
 * Validate that parsed data contains valid UTM parameters
 */
function isValidStoredData(data: unknown, keyFormat?: KeyFormat): data is UtmParameters {
  // Must be a non-null, non-array object
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false
  }

  const entries = Object.entries(data)

  // Empty object is valid
  if (entries.length === 0) {
    return true
  }

  return entries.every(([key, value]) => {
    // Value must be string or undefined
    if (value !== undefined && typeof value !== 'string') {
      return false
    }

    // Validate key format
    if (keyFormat === 'snake_case') {
      return isSnakeCaseUtmKey(key)
    }
    if (keyFormat === 'camelCase') {
      return isCamelCaseUtmKey(key)
    }

    // Accept either format if not specified
    return isUtmKey(key)
  })
}

/**
 * Stores UTM parameters in browser storage
 *
 * Serializes the parameters in envelope format { params, iat, eat } and stores them.
 * For sessionStorage, eat is always null (session handles expiry).
 * For localStorage, eat is calculated from TTL if provided, otherwise null.
 * If storage fails (quota exceeded, permissions, etc.), fails silently.
 * SSR-safe: returns early if storage is unavailable.
 *
 * @param params - UTM parameters to store
 * @param options - Storage options including key, format, type, and TTL
 *
 * @example
 * ```typescript
 * // Store in sessionStorage (default)
 * storeUtmParameters({ utm_source: 'linkedin' })
 *
 * // Store in localStorage
 * storeUtmParameters({ utm_source: 'linkedin' }, { storageType: 'local' })
 *
 * // Store in localStorage with 1-hour TTL
 * storeUtmParameters({ utm_source: 'linkedin' }, { storageType: 'local', ttl: 3600000 })
 * ```
 */
export function storeUtmParameters(params: UtmParameters, options: StorageOptions = {}): void {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    keyFormat = 'snake_case',
    storageType = 'session',
    ttl,
  } = options

  const storage = getStorageBackend(storageType)
  if (!storage) {
    return
  }

  try {
    // Skip storing if params is empty
    if (Object.keys(params).length === 0) {
      return
    }

    // Convert to target format before storing
    const paramsToStore = convertParams(params, keyFormat)

    // Build envelope — TTL only applies to localStorage
    const now = Date.now()
    const eat = storageType === 'local' && ttl ? now + ttl : null
    const envelope: StoredUtmEnvelope = {
      params: paramsToStore,
      iat: now,
      eat,
    }

    const serialized = JSON.stringify(envelope)
    storage.setItem(storageKey, serialized)
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Failed to store UTM parameters:', error)
    }
  }
}

/**
 * Retrieves stored UTM parameters from browser storage
 *
 * Returns null if no parameters are stored, data has expired, or deserialization fails.
 * Handles both envelope format (new) and flat format (backward compat).
 * Auto-clears expired data from storage.
 * SSR-safe: returns null if storage is unavailable.
 *
 * @param options - Storage options including key, format, and type
 * @returns Stored UTM parameters or null if not found/invalid/expired
 */
export function getStoredUtmParameters(options: StorageOptions = {}): UtmParameters | null {
  const { storageKey = DEFAULT_STORAGE_KEY, keyFormat, storageType = 'session' } = options

  const storage = getStorageBackend(storageType)
  if (!storage) {
    return null
  }

  try {
    const stored = storage.getItem(storageKey)

    if (stored === null) {
      return null
    }

    const parsed: unknown = JSON.parse(stored)

    // Handle envelope format
    if (isEnvelopeFormat(parsed)) {
      // Check TTL expiration
      if (parsed.eat !== null && Date.now() > parsed.eat) {
        // Expired — auto-clear
        try {
          storage.removeItem(storageKey)
        } catch {
          // Ignore cleanup errors
        }
        return null
      }

      // Validate the params inside the envelope
      if (!isValidStoredData(parsed.params)) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Stored UTM data is invalid, ignoring')
        }
        return null
      }

      if (keyFormat) {
        return convertParams(parsed.params, keyFormat)
      }
      return parsed.params
    }

    // Backward compatibility: flat format (pre-envelope data)
    if (!isValidStoredData(parsed)) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Stored UTM data is invalid, ignoring')
      }
      return null
    }

    if (keyFormat) {
      return convertParams(parsed, keyFormat)
    }
    return parsed
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Failed to retrieve stored UTM parameters:', error)
    }
    return null
  }
}

/**
 * Removes stored UTM parameters from browser storage
 *
 * @param storageKey - Storage key to clear (default: 'utm_parameters')
 * @param storageType - Storage backend to clear from (default: 'session')
 */
export function clearStoredUtmParameters(
  storageKey: string = DEFAULT_STORAGE_KEY,
  storageType: StorageType = 'session',
): void {
  const storage = getStorageBackend(storageType)
  if (!storage) {
    return
  }

  try {
    storage.removeItem(storageKey)
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Failed to clear UTM parameters:', error)
    }
  }
}

/**
 * Checks if valid, non-expired UTM parameters are currently stored
 *
 * @param storageKey - Storage key to check (default: 'utm_parameters')
 * @param storageType - Storage backend to check (default: 'session')
 * @returns True if valid UTM parameters are stored, false otherwise
 */
export function hasStoredUtmParameters(
  storageKey: string = DEFAULT_STORAGE_KEY,
  storageType: StorageType = 'session',
): boolean {
  const params = getStoredUtmParameters({ storageKey, storageType })
  return params !== null && Object.keys(params).length > 0
}

/**
 * Get the raw stored value without parsing or validation
 * Useful for debugging
 *
 * @param storageKey - Storage key to read (default: 'utm_parameters')
 * @param storageType - Storage backend to read from (default: 'session')
 * @returns Raw string value or null
 */
export function getRawStoredValue(
  storageKey: string = DEFAULT_STORAGE_KEY,
  storageType: StorageType = 'session',
): string | null {
  const storage = getStorageBackend(storageType)
  if (!storage) {
    return null
  }

  try {
    return storage.getItem(storageKey)
  } catch {
    return null
  }
}

/**
 * UTM Parameter Storage Utility
 *
 * Manages persistence of UTM parameters in sessionStorage.
 * UTM parameters are stored for the duration of the browser session and
 * cleared when the browser/tab is closed.
 */

import type { KeyFormat, UtmParameters } from '../types';
import { convertParams, isSnakeCaseUtmKey, isCamelCaseUtmKey, isUtmKey } from './keys';

/**
 * Default storage key for UTM parameters in sessionStorage
 */
export const DEFAULT_STORAGE_KEY = 'utm_parameters';

/**
 * Options for storage operations
 */
export interface StorageOptions {
  /** Storage key to use (default: 'utm_parameters') */
  storageKey?: string;

  /** Key format to store parameters in (default: 'snake_case') */
  keyFormat?: KeyFormat;
}

/**
 * Check if sessionStorage is available
 */
function isStorageAvailable(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') {
      return false;
    }
    // Test write/read to ensure it's actually functional
    const testKey = '__utm_test__';
    sessionStorage.setItem(testKey, 'test');
    sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that parsed data contains valid UTM parameters
 */
function isValidStoredData(data: unknown, keyFormat?: KeyFormat): data is UtmParameters {
  // Must be a non-null, non-array object
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }

  const entries = Object.entries(data);

  // Empty object is valid
  if (entries.length === 0) {
    return true;
  }

  return entries.every(([key, value]) => {
    // Value must be string or undefined
    if (value !== undefined && typeof value !== 'string') {
      return false;
    }

    // Validate key format
    if (keyFormat === 'snake_case') {
      return isSnakeCaseUtmKey(key);
    }
    if (keyFormat === 'camelCase') {
      return isCamelCaseUtmKey(key);
    }

    // Accept either format if not specified
    return isUtmKey(key);
  });
}

/**
 * Stores UTM parameters in sessionStorage
 *
 * Serializes the parameters as JSON and stores them for the duration of the session.
 * If storage fails (quota exceeded, permissions, etc.), fails silently to avoid
 * disrupting the user experience.
 * SSR-safe: returns early if sessionStorage is unavailable.
 *
 * @param params - UTM parameters to store
 * @param options - Storage options including key and format
 *
 * @example
 * ```typescript
 * // Store with default key
 * storeUtmParameters({
 *   utm_source: 'linkedin',
 *   utm_campaign: 'spring2025'
 * })
 *
 * // Store with custom key
 * storeUtmParameters(params, { storageKey: 'myapp_utm' })
 *
 * // Store in camelCase format
 * storeUtmParameters(
 *   { utmSource: 'linkedin' },
 *   { keyFormat: 'camelCase' }
 * )
 * ```
 */
export function storeUtmParameters(
  params: UtmParameters,
  options: StorageOptions = {}
): void {
  const { storageKey = DEFAULT_STORAGE_KEY, keyFormat = 'snake_case' } = options;

  // SSR safety
  if (!isStorageAvailable()) {
    return;
  }

  try {
    // Skip storing if params is empty
    if (Object.keys(params).length === 0) {
      return;
    }

    // Convert to target format before storing
    const paramsToStore = convertParams(params, keyFormat);
    const serialized = JSON.stringify(paramsToStore);
    sessionStorage.setItem(storageKey, serialized);
  } catch (error) {
    // Fail silently - storage errors should not break the app
    // Common causes:
    // - QuotaExceededError (storage full)
    // - SecurityError (storage access denied)
    // - Circular reference in params (JSON.stringify fails)
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Failed to store UTM parameters:', error);
    }
  }
}

/**
 * Retrieves stored UTM parameters from sessionStorage
 *
 * Returns null if no parameters are stored or if deserialization fails.
 * Validates that the stored data is a proper object with valid UTM keys.
 * SSR-safe: returns null if sessionStorage is unavailable.
 *
 * @param options - Storage options including key and expected format
 * @returns Stored UTM parameters or null if not found/invalid
 *
 * @example
 * ```typescript
 * // Get with default key
 * const params = getStoredUtmParameters()
 * if (params) {
 *   console.log('UTM Source:', params.utm_source)
 * }
 *
 * // Get with custom key
 * const params = getStoredUtmParameters({ storageKey: 'myapp_utm' })
 *
 * // Get and convert to camelCase
 * const params = getStoredUtmParameters({ keyFormat: 'camelCase' })
 * // Returns: { utmSource: '...', utmCampaign: '...' }
 * ```
 */
export function getStoredUtmParameters(
  options: StorageOptions = {}
): UtmParameters | null {
  const { storageKey = DEFAULT_STORAGE_KEY, keyFormat } = options;

  // SSR safety
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const stored = sessionStorage.getItem(storageKey);

    if (stored === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(stored);

    // Validate the parsed data
    if (!isValidStoredData(parsed)) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Stored UTM data is invalid, ignoring');
      }
      return null;
    }

    // Convert to requested format if specified
    if (keyFormat) {
      return convertParams(parsed, keyFormat);
    }

    return parsed;
  } catch (error) {
    // Fail silently and return null
    // Common causes:
    // - JSON.parse error (invalid JSON)
    // - SecurityError (storage access denied)
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Failed to retrieve stored UTM parameters:', error);
    }
    return null;
  }
}

/**
 * Removes stored UTM parameters from sessionStorage
 *
 * Fails silently if removal fails to avoid disrupting the user experience.
 * SSR-safe: returns early if sessionStorage is unavailable.
 *
 * @param storageKey - Storage key to clear (default: 'utm_parameters')
 *
 * @example
 * ```typescript
 * // Clear with default key
 * clearStoredUtmParameters()
 *
 * // Clear with custom key
 * clearStoredUtmParameters('myapp_utm')
 * ```
 */
export function clearStoredUtmParameters(storageKey: string = DEFAULT_STORAGE_KEY): void {
  // SSR safety
  if (!isStorageAvailable()) {
    return;
  }

  try {
    sessionStorage.removeItem(storageKey);
  } catch (error) {
    // Fail silently - removal errors should not break the app
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Failed to clear UTM parameters:', error);
    }
  }
}

/**
 * Checks if UTM parameters are currently stored
 *
 * Returns true only if valid UTM parameters are stored (not just any data).
 * Returns false if storage is empty, contains invalid data, or access fails.
 * SSR-safe: returns false if sessionStorage is unavailable.
 *
 * @param storageKey - Storage key to check (default: 'utm_parameters')
 * @returns True if valid UTM parameters are stored, false otherwise
 *
 * @example
 * ```typescript
 * if (hasStoredUtmParameters()) {
 *   const params = getStoredUtmParameters()
 *   // Use stored parameters
 * } else {
 *   // Capture new parameters
 * }
 * ```
 */
export function hasStoredUtmParameters(storageKey: string = DEFAULT_STORAGE_KEY): boolean {
  const params = getStoredUtmParameters({ storageKey });
  return params !== null && Object.keys(params).length > 0;
}

/**
 * Check if sessionStorage is available in the current environment
 *
 * @returns True if sessionStorage is available and functional
 */
export function isSessionStorageAvailable(): boolean {
  return isStorageAvailable();
}

/**
 * Get the raw stored value without parsing or validation
 * Useful for debugging
 *
 * @param storageKey - Storage key to read (default: 'utm_parameters')
 * @returns Raw string value or null
 */
export function getRawStoredValue(storageKey: string = DEFAULT_STORAGE_KEY): string | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    return sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

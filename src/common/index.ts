/**
 * Common exports
 *
 * Shared utilities used by both inbound and outbound pathways.
 */

// Storage utilities
export {
  storeUtmParameters,
  getStoredUtmParameters,
  clearStoredUtmParameters,
  hasStoredUtmParameters,
  isStorageAvailable,
  isSessionStorageAvailable,
  isLocalStorageAvailable,
  getRawStoredValue,
  DEFAULT_STORAGE_KEY,
  type StorageOptions,
  type ClearOptions,
} from './storage'

// Key conversion utilities
export {
  toSnakeCase,
  toCamelCase,
  toSnakeCaseParams,
  toCamelCaseParams,
  convertParams,
  isSnakeCaseUtmKey,
  isCamelCaseUtmKey,
  isUtmKey,
  isValidUtmParameters,
  detectKeyFormat,
  normalizeKey,
  toUrlKey,
  SNAKE_TO_CAMEL,
  CAMEL_TO_SNAKE,
  STANDARD_SNAKE_KEYS,
  STANDARD_CAMEL_KEYS,
} from './keys'

// Validator utilities
export {
  validateUrl,
  normalizeUrl,
  needsNormalization,
  validateAndNormalize,
  getDefaultProtocol,
  setDefaultProtocol,
  getAllowedProtocols,
  isProtocolAllowed,
  getErrorMessage,
  ERROR_MESSAGES,
} from './validator'

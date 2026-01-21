/**
 * Core exports
 *
 * Framework-agnostic utilities for UTM parameter management.
 */

// Capture utilities
export {
  captureUtmParameters,
  hasUtmParameters,
  captureFromCurrentUrl,
  captureWithReferrer,
  type CaptureOptions,
} from './capture';

// Storage utilities
export {
  storeUtmParameters,
  getStoredUtmParameters,
  clearStoredUtmParameters,
  hasStoredUtmParameters,
  isSessionStorageAvailable,
  getRawStoredValue,
  DEFAULT_STORAGE_KEY,
  type StorageOptions,
} from './storage';

// Appender utilities
export {
  appendUtmParameters,
  removeUtmParameters,
  extractUtmParameters,
} from './appender';

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
} from './keys';

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
} from './validator';

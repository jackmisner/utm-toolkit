/**
 * @jackmisner/utm-toolkit
 *
 * Capture, store, and append UTM tracking parameters.
 *
 * @packageDocumentation
 */

// Core utilities (framework-agnostic)
export {
  // Capture
  captureUtmParameters,
  hasUtmParameters,
  captureFromCurrentUrl,
  captureWithReferrer,
  type CaptureOptions,

  // Storage
  storeUtmParameters,
  getStoredUtmParameters,
  clearStoredUtmParameters,
  hasStoredUtmParameters,
  isSessionStorageAvailable,
  getRawStoredValue,
  DEFAULT_STORAGE_KEY,
  type StorageOptions,

  // Appender
  appendUtmParameters,
  removeUtmParameters,
  extractUtmParameters,

  // Keys
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

  // Validator
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
} from './core'

// Configuration
export {
  DEFAULT_CONFIG,
  STANDARD_UTM_PARAMETERS,
  getDefaultConfig,
  createConfig,
  mergeConfig,
  loadConfigFromJson,
  validateConfig,
} from './config'

// Debug utilities
export { getDiagnostics, debugUtmState, checkUtmTracking, installDebugHelpers } from './debug'

// Types
export type {
  KeyFormat,
  SnakeCaseUtmKey,
  StandardSnakeCaseUtmKey,
  StandardCamelCaseUtmKey,
  UtmParametersSnake,
  UtmParametersCamel,
  UtmParameters,
  SharePlatform,
  ShareContextParams,
  AppendOptions,
  ValidationResult,
  ValidationError,
  UtmConfig,
  ResolvedUtmConfig,
  UseUtmTrackingReturn,
  UtmProviderProps,
  DiagnosticInfo,
} from './types'

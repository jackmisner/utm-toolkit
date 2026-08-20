/**
 * @jackmisner/utm-toolkit
 *
 * Capture, store, and append UTM tracking parameters.
 *
 * @packageDocumentation
 */

// Inbound utilities (capture, sanitize, filter)
export {
  // Capture
  captureUtmParameters,
  hasUtmParameters,
  captureFromCurrentUrl,
  captureWithReferrer,
  type CaptureOptions,

  // Capture reporting
  captureUtmParametersWithReport,
  type UtmRejection,
  type UtmRejectionReason,
  type CaptureReport,

  // Sanitizer
  sanitizeValue,
  sanitizeParams,
  sanitizeValueWithReport,
  type SanitizeRejection,
  type SanitizeValueResult,

  // PII Filter
  detectPii,
  filterValue,
  filterParams,
  filterValueWithReport,
  type PiiRejection,
  type FilterValueResult,

  // Form field population
  populateFormFields,
  createUtmHiddenFields,
  type FormPopulateOptions,

  // Attribution
  storeWithAttribution,
  getAttributedParams,
  type AttributionStoreOptions,
  type AttributionGetOptions,
} from './inbound'

// Outbound utilities (append)
export {
  // Appender
  appendUtmParameters,
  removeUtmParameters,
  extractUtmParameters,

  // Builder
  buildUtmUrl,
  validateUtmValues,
  type BuildUtmUrlParams,
  type BuildUtmUrlOptions,
  type BuildResult,

  // Link decorator
  decorateLinks,
  observeAndDecorateLinks,
  type LinkDecoratorOptions,
} from './outbound'

// Common utilities (storage, keys, validator)
export {
  // Storage
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
} from './common'

// Configuration
export {
  DEFAULT_CONFIG,
  DEFAULT_SANITIZE_CONFIG,
  DEFAULT_PII_PATTERNS,
  DEFAULT_PII_FILTER_CONFIG,
  DEFAULT_ATTRIBUTION_CONFIG,
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
  StorageType,
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
  SanitizeConfig,
  PiiPattern,
  PiiFilterConfig,
  AttributionMode,
  TouchType,
  AttributionConfig,
} from './types'

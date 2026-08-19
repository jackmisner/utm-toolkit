/**
 * Key format options for UTM parameters
 * - 'snake_case': URL-style format (utm_source, utm_campaign)
 * - 'camelCase': TypeScript-style format (utmSource, utmCampaign)
 */
export type KeyFormat = 'snake_case' | 'camelCase'

/**
 * Storage backend options
 * - 'session': sessionStorage (cleared when tab/browser closes)
 * - 'local': localStorage (persists across sessions, optionally with TTL)
 */
export type StorageType = 'session' | 'local'

/**
 * Attribution mode for UTM parameter storage
 * - 'last': Only store last-touch (current behavior, default)
 * - 'first': Only store first-touch (write-once)
 * - 'both': Store both first-touch and last-touch
 */
export type AttributionMode = 'last' | 'first' | 'both'

/**
 * Touch type for reading attributed params
 */
export type TouchType = 'first' | 'last'

/**
 * Configuration for attribution behavior
 */
export interface AttributionConfig {
  /** Attribution mode (default: 'last') */
  mode: AttributionMode
  /** Storage key suffix for first-touch (default: '_first') */
  firstTouchSuffix?: string
  /** Storage key suffix for last-touch (default: '_last') */
  lastTouchSuffix?: string
}

/**
 * Standard UTM parameter keys in snake_case (URL format)
 */
export type StandardSnakeCaseUtmKey =
  'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content' | 'utm_id'

/**
 * Any UTM key in snake_case format (includes custom params like utm_team_id)
 */
export type SnakeCaseUtmKey = StandardSnakeCaseUtmKey | `utm_${string}`

/**
 * Standard UTM parameter keys in camelCase (TypeScript format)
 */
export type StandardCamelCaseUtmKey =
  'utmSource' | 'utmMedium' | 'utmCampaign' | 'utmTerm' | 'utmContent' | 'utmId'

/**
 * UTM parameters object using snake_case keys (URL format)
 */
export interface UtmParametersSnake {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  utm_id?: string
  [key: `utm_${string}`]: string | undefined
}

/**
 * UTM parameters object using camelCase keys (TypeScript format)
 */
export interface UtmParametersCamel {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  utmId?: string
  [key: string]: string | undefined
}

/**
 * Union type for UTM parameters - can be either format
 */
export type UtmParameters = UtmParametersSnake | UtmParametersCamel

/**
 * Platform identifiers for share context configuration
 */
export type SharePlatform = 'linkedin' | 'twitter' | 'facebook' | 'copy' | string

/**
 * Platform-specific UTM parameter overrides for sharing
 * - `default`: Applied to all shares as base
 * - Platform keys (linkedin, twitter, etc.): Override specific parameters per platform
 */
export type ShareContextParams = Partial<Record<SharePlatform, UtmParameters>> & {
  default?: UtmParameters
}

/**
 * Options for appending UTM parameters to URLs
 */
export interface AppendOptions {
  /** Add parameters to URL fragment (#) instead of query string (?) */
  toFragment?: boolean
  /** Keep existing UTM parameters instead of replacing them */
  preserveExisting?: boolean
  /** Fired after UTM params are appended to a URL */
  onAppend?: (url: string, params: UtmParameters) => void
}

/**
 * Result of URL validation
 */
export interface ValidationResult {
  /** Whether the URL is valid */
  valid: boolean
  /** Error identifier if invalid */
  error?: ValidationError
  /** Human-readable error message */
  message?: string
}

/**
 * Validation error types
 */
export type ValidationError = 'invalid_protocol' | 'invalid_domain' | 'malformed_url' | 'empty_url'

/**
 * Configuration for value sanitization
 */
export interface SanitizeConfig {
  /** Enable sanitization (default: false) */
  enabled: boolean

  /** Strip HTML-significant characters: < > " ' ` (default: true) */
  stripHtml: boolean

  /** Strip control characters \x00-\x1F except \t \n \r (default: true) */
  stripControlChars: boolean

  /** Maximum allowed length for parameter values (default: 200) */
  maxLength: number

  /** Optional additional regex pattern to strip from values */
  customPattern?: RegExp
}

/**
 * A named PII detection pattern
 */
export interface PiiPattern {
  /** Identifier for this pattern (e.g. 'email', 'phone_us') */
  name: string

  /** Regex to detect PII in a value */
  pattern: RegExp

  /** Whether this pattern is active */
  enabled: boolean
}

/**
 * Configuration for PII filtering
 */
export interface PiiFilterConfig {
  /** Enable PII filtering (default: false) */
  enabled: boolean

  /** How to handle detected PII: 'reject' discards the value, 'redact' replaces it with [REDACTED] */
  mode: 'reject' | 'redact'

  /** PII detection patterns (default: built-in email + phone patterns) */
  patterns: PiiPattern[]

  /** Optional strict allowlist — values must match this pattern to be accepted (takes precedence over PII patterns) */
  allowlistPattern?: RegExp

  /**
   * Optional callback fired when PII is detected.
   *
   * WARNING: The `value` parameter contains the raw detected PII.
   * Do NOT log or transmit this value to analytics services,
   * as that would defeat the purpose of PII filtering.
   * This callback is intended for counting/alerting only.
   */
  onPiiDetected?: (param: string, value: string, patternName: string) => void
}

/**
 * Main configuration interface for UTM toolkit
 */
export interface UtmConfig {
  /** Enable/disable UTM tracking entirely (default: true) */
  enabled?: boolean

  /** Key format for returned UTM parameters (default: 'snake_case') */
  keyFormat?: KeyFormat

  /** Storage key for browser storage (default: 'utm_parameters') */
  storageKey?: string

  /** Storage backend: 'session' for sessionStorage, 'local' for localStorage (default: 'session') */
  storageType?: StorageType

  /** Time-to-live in milliseconds for stored parameters (only applies to localStorage) */
  ttl?: number

  /** Auto-capture UTM params on React hook mount (default: true) */
  captureOnMount?: boolean

  /** Auto-append UTM params when generating share URLs (default: true) */
  appendToShares?: boolean

  /**
   * Allowlist of UTM parameters to capture (snake_case format)
   * Default: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id']
   */
  allowedParameters?: string[]

  /** Default UTM parameters when none are captured */
  defaultParams?: UtmParameters

  /** Platform-specific UTM overrides for share URLs */
  shareContextParams?: ShareContextParams

  /** Parameters to exclude when appending to share URLs (e.g., ['utm_team_id']) */
  excludeFromShares?: string[]

  /** Value sanitization configuration */
  sanitize?: Partial<SanitizeConfig>

  /** PII filtering configuration */
  piiFiltering?: Partial<PiiFilterConfig>

  /** Attribution configuration (first-touch / last-touch) */
  attribution?: Partial<AttributionConfig>

  /** Fired after UTM params are captured from a URL */
  onCapture?: (params: UtmParameters) => void
  /** Fired after UTM params are written to storage */
  onStore?: (
    params: UtmParameters,
    meta: { storageType: StorageType; touch?: 'first' | 'last' },
  ) => void
  /** Fired when stored params are cleared */
  onClear?: () => void
  /** Fired after UTM params are appended to a URL */
  onAppend?: (url: string, params: UtmParameters) => void
  /** Fired when stored params expire (TTL) and are auto-cleaned */
  onExpire?: (storageKey: string) => void
}

/**
 * Fully resolved configuration with all defaults applied
 */
export interface ResolvedUtmConfig {
  enabled: boolean
  keyFormat: KeyFormat
  storageKey: string
  storageType: StorageType
  ttl?: number
  captureOnMount: boolean
  appendToShares: boolean
  allowedParameters: string[]
  defaultParams: UtmParameters
  shareContextParams: ShareContextParams
  excludeFromShares: string[]
  sanitize: SanitizeConfig
  piiFiltering: PiiFilterConfig
  attribution: AttributionConfig
  onCapture?: (params: UtmParameters) => void
  onStore?: (
    params: UtmParameters,
    meta: { storageType: StorageType; touch?: 'first' | 'last' },
  ) => void
  onClear?: () => void
  onAppend?: (url: string, params: UtmParameters) => void
  onExpire?: (storageKey: string) => void
}

/**
 * Return type for the useUtmTracking React hook
 */
export interface UseUtmTrackingReturn {
  /** Currently captured/stored UTM parameters */
  utmParameters: UtmParameters | null

  /** Whether UTM tracking is enabled */
  isEnabled: boolean

  /** Whether any UTM parameters exist */
  hasParams: boolean

  /** Manually capture UTM parameters from current URL */
  capture: () => void

  /** Clear stored UTM parameters */
  clear: () => void

  /**
   * Append UTM parameters to a URL
   * @param url - Base URL to append parameters to
   * @param platform - Optional platform for context-specific params
   * @returns URL with UTM parameters appended
   */
  appendToUrl: (url: string, platform?: SharePlatform) => string

  /** First-touch UTM parameters (null when attribution mode is 'last') */
  firstTouchParams: UtmParameters | null
  /** Last-touch UTM parameters (null when attribution mode is 'first') */
  lastTouchParams: UtmParameters | null
}

/**
 * Props for UtmProvider component
 */
export interface UtmProviderProps {
  /** Configuration options */
  config?: Partial<UtmConfig>

  /** Child components */
  children: React.ReactNode
}

/**
 * Debug diagnostic information
 */
export interface DiagnosticInfo {
  /** Whether tracking is enabled */
  enabled: boolean

  /** Current configuration */
  config: ResolvedUtmConfig

  /** Current URL */
  currentUrl: string

  /** UTM parameters found in current URL */
  urlParams: UtmParameters

  /** UTM parameters in storage */
  storedParams: UtmParameters | null

  /** Storage key being used */
  storageKey: string

  /** Whether the configured storage backend is available */
  storageAvailable: boolean
}

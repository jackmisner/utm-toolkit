/**
 * Default Configuration Values
 *
 * Provides sensible defaults for UTM toolkit configuration.
 */

import type { PiiFilterConfig, PiiPattern, ResolvedUtmConfig, SanitizeConfig } from '../types'

/**
 * Default sanitization configuration
 * Sanitization is disabled by default but has safe defaults when enabled
 */
export const DEFAULT_SANITIZE_CONFIG: SanitizeConfig = {
  enabled: false,
  stripHtml: true,
  stripControlChars: true,
  maxLength: 200,
}

/**
 * Built-in PII detection patterns
 */
export const DEFAULT_PII_PATTERNS: PiiPattern[] = [
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    enabled: true,
  },
  {
    name: 'phone_international',
    pattern: /\+\d{10,15}\b/,
    enabled: true,
  },
  {
    name: 'phone_uk',
    pattern: /\b(?:0|\+44)\d{9,10}\b/,
    enabled: true,
  },
  {
    name: 'phone_us',
    pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    enabled: true,
  },
]

/**
 * Default PII filtering configuration
 * PII filtering is disabled by default but has sensible defaults when enabled
 */
export const DEFAULT_PII_FILTER_CONFIG: PiiFilterConfig = {
  enabled: false,
  mode: 'reject',
  patterns: [...DEFAULT_PII_PATTERNS],
}

/**
 * Standard UTM parameters (snake_case format for URLs)
 */
export const STANDARD_UTM_PARAMETERS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
] as const

/**
 * Default configuration with all values set
 * This is used as the base when merging with user-provided config
 */
export const DEFAULT_CONFIG: ResolvedUtmConfig = {
  /** UTM tracking is enabled by default */
  enabled: true,

  /** Use snake_case format by default (matches URL query params) */
  keyFormat: 'snake_case',

  /** Default storage key for browser storage */
  storageKey: 'utm_parameters',

  /** Use sessionStorage by default (ephemeral, cleared on tab close) */
  storageType: 'session',

  /** Auto-capture UTM params when React hook mounts */
  captureOnMount: true,

  /** Append UTM params to share URLs by default */
  appendToShares: true,

  /** Capture standard UTM parameters by default */
  allowedParameters: [...STANDARD_UTM_PARAMETERS],

  /** No default parameters set */
  defaultParams: {},

  /** No platform-specific share context by default */
  shareContextParams: {},

  /** No parameters excluded from shares by default */
  excludeFromShares: [],

  /** Sanitization disabled by default */
  sanitize: { ...DEFAULT_SANITIZE_CONFIG },

  /** PII filtering disabled by default (deep copy to prevent shared references) */
  piiFiltering: { ...DEFAULT_PII_FILTER_CONFIG, patterns: [...DEFAULT_PII_PATTERNS] },
}

/**
 * Get a copy of the default configuration
 * Use this to avoid accidentally mutating the defaults
 */
export function getDefaultConfig(): ResolvedUtmConfig {
  return {
    ...DEFAULT_CONFIG,
    allowedParameters: [...DEFAULT_CONFIG.allowedParameters],
    defaultParams: { ...DEFAULT_CONFIG.defaultParams },
    shareContextParams: { ...DEFAULT_CONFIG.shareContextParams },
    excludeFromShares: [...DEFAULT_CONFIG.excludeFromShares],
    sanitize: { ...DEFAULT_CONFIG.sanitize },
    piiFiltering: {
      ...DEFAULT_CONFIG.piiFiltering,
      patterns: DEFAULT_CONFIG.piiFiltering.patterns.map((p) => ({ ...p })),
    },
  }
}

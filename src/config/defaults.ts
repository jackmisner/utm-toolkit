/**
 * Default Configuration Values
 *
 * Provides sensible defaults for UTM toolkit configuration.
 */

import type { ResolvedUtmConfig } from '../types'

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

  /** Default storage key for sessionStorage */
  storageKey: 'utm_parameters',

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
  }
}

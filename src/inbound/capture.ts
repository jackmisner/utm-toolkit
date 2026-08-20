/**
 * UTM Parameter Capture Utility
 *
 * Extracts UTM tracking parameters from URLs.
 * Supports standard UTM parameters and custom utm_ prefixed parameters.
 */

import type { KeyFormat, PiiFilterConfig, SanitizeConfig, UtmParameters } from '../types'
import { DEFAULT_PII_FILTER_CONFIG, DEFAULT_SANITIZE_CONFIG } from '../config/defaults'
import { convertParams, isSnakeCaseUtmKey } from '../common/keys'
import { filterParams } from './pii-filter'
import { sanitizeParams } from './sanitizer'

/**
 * Options for capturing UTM parameters
 */
export interface CaptureOptions {
  /** Target key format for returned parameters (default: 'snake_case') */
  keyFormat?: KeyFormat

  /** Allowlist of parameters to capture (snake_case format, e.g., ['utm_source', 'utm_campaign']) */
  allowedParameters?: string[]

  /**
   * Lowercase all captured values (default: false)
   *
   * Mirrors `BuildUtmUrlOptions.lowercaseValues` on the outbound side. Applied
   * before sanitization and PII filtering, so every downstream gate —
   * `sanitize.customPattern`, `sanitize.valuePattern` and
   * `piiFiltering.allowlistPattern` — sees the folded value and can be written
   * without allowing uppercase.
   *
   * Keys are unaffected; only values are folded.
   */
  lowercaseValues?: boolean

  /** Sanitization configuration — when enabled, strips dangerous characters from values */
  sanitize?: Partial<SanitizeConfig>

  /** PII filtering configuration — when enabled, detects and filters PII from values */
  piiFiltering?: Partial<PiiFilterConfig>

  /** Fired after UTM params are captured from a URL */
  onCapture?: (params: UtmParameters) => void
}

/**
 * Check if we're in a browser environment with access to window
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined'
}

/**
 * Extracts UTM parameters from a URL
 *
 * Captures all parameters that start with 'utm_' (case-sensitive).
 * Optionally filters to only allowed parameter names.
 * SSR-safe: returns empty object when window is unavailable.
 *
 * @param url - The URL to extract UTM parameters from (defaults to window.location.href)
 * @param options - Capture options including key format and allowed parameters
 * @returns Object containing extracted UTM parameters
 *
 * @example
 * ```typescript
 * // Extract all UTM parameters (snake_case by default)
 * captureUtmParameters('https://example.com?utm_source=linkedin&utm_campaign=spring2025')
 * // Returns: { utm_source: 'linkedin', utm_campaign: 'spring2025' }
 *
 * // Extract with camelCase keys
 * captureUtmParameters(
 *   'https://example.com?utm_source=linkedin&utm_campaign=spring2025',
 *   { keyFormat: 'camelCase' }
 * )
 * // Returns: { utmSource: 'linkedin', utmCampaign: 'spring2025' }
 *
 * // Extract only specific parameters
 * captureUtmParameters(
 *   'https://example.com?utm_source=linkedin&utm_campaign=test&utm_term=ignored',
 *   { allowedParameters: ['utm_source', 'utm_campaign'] }
 * )
 * // Returns: { utm_source: 'linkedin', utm_campaign: 'test' }
 * ```
 */
export function captureUtmParameters(url?: string, options: CaptureOptions = {}): UtmParameters {
  const {
    keyFormat = 'snake_case',
    allowedParameters,
    lowercaseValues = false,
    sanitize,
    piiFiltering,
    onCapture,
  } = options

  // Get URL, defaulting to current page URL in browser
  const urlString = url ?? (isBrowser() ? window.location.href : '')

  // SSR safety: return empty object if no URL available
  if (!urlString) {
    return {}
  }

  try {
    // Parse the URL to extract query parameters
    const urlObj = new URL(urlString)
    const params: Record<string, string> = {}

    // Create a set of allowed parameters for O(1) lookup
    const allowedSet =
      allowedParameters && allowedParameters.length > 0 ? new Set(allowedParameters) : null

    // Iterate through all query parameters
    for (const [key, value] of urlObj.searchParams.entries()) {
      // Only capture parameters that start with 'utm_' (case-sensitive)
      if (isSnakeCaseUtmKey(key)) {
        // If allowedParameters is provided, check if this parameter is allowed
        if (allowedSet === null || allowedSet.has(key)) {
          // toLowerCase(), never toLocaleLowerCase(): folding must not depend on
          // the host locale. 'I'.toLocaleLowerCase() is a dotless i under tr-TR.
          params[key] = lowercaseValues ? value.toLowerCase() : value
        }
      }
    }

    // Apply sanitization if configured and enabled
    const resolvedSanitize: SanitizeConfig = { ...DEFAULT_SANITIZE_CONFIG, ...sanitize }
    const sanitized: UtmParameters = resolvedSanitize.enabled
      ? sanitizeParams(params as UtmParameters, resolvedSanitize)
      : (params as UtmParameters)

    // Apply PII filtering if configured and enabled
    const resolvedPiiFilter: PiiFilterConfig = {
      ...DEFAULT_PII_FILTER_CONFIG,
      ...piiFiltering,
      patterns: piiFiltering?.patterns ?? [...DEFAULT_PII_FILTER_CONFIG.patterns],
    }
    const captured: UtmParameters = resolvedPiiFilter.enabled
      ? filterParams(sanitized, resolvedPiiFilter)
      : sanitized

    // Convert to target format if needed
    const result = keyFormat === 'camelCase' ? convertParams(captured, 'camelCase') : captured

    // Fire onCapture callback if params were found
    if (onCapture && Object.keys(result).length > 0) {
      try {
        onCapture(result)
      } catch {
        // Callbacks must not break the pipeline
      }
    }

    return result
  } catch (error) {
    // If URL parsing fails, return empty object
    // This ensures the function is robust and doesn't break the app
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        'Failed to parse URL for UTM parameters:',
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
    return {}
  }
}

/**
 * Check if a UTM parameters object has any non-empty values
 *
 * @param params - UTM parameters object to check
 * @returns True if at least one parameter has a non-empty value
 *
 * @example
 * ```typescript
 * hasUtmParameters({}) // false
 * hasUtmParameters({ utm_source: '' }) // false
 * hasUtmParameters({ utm_source: undefined }) // false
 * hasUtmParameters({ utm_source: 'linkedin' }) // true
 * ```
 */
export function hasUtmParameters(params: UtmParameters | null | undefined): boolean {
  if (!params || typeof params !== 'object') {
    return false
  }

  return Object.values(params).some(
    (value) => value !== undefined && value !== null && value !== '',
  )
}

/**
 * Get UTM parameters from the current page URL
 * Convenience function that captures from window.location.href
 *
 * @param options - Capture options
 * @returns UTM parameters from current URL, or empty object if SSR
 */
export function captureFromCurrentUrl(options: CaptureOptions = {}): UtmParameters {
  return captureUtmParameters(undefined, options)
}

/**
 * Extract UTM parameters from URL and also capture the referrer
 * Useful for tracking both the landing page UTMs and where the user came from
 *
 * @param options - Capture options
 * @returns Object with utm parameters and referrer
 */
export function captureWithReferrer(options: CaptureOptions = {}): {
  params: UtmParameters
  referrer: string | null
} {
  const params = captureFromCurrentUrl(options)
  const referrer =
    isBrowser() && typeof document !== 'undefined' && document.referrer ? document.referrer : null

  return { params, referrer }
}

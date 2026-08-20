/**
 * UTM Parameter Value Sanitizer
 *
 * Strips dangerous characters from UTM parameter values to prevent XSS
 * when values are rendered in HTML or used in URL construction.
 */

import type { SanitizeConfig, UtmParameters } from '../types'

/**
 * Sanitize a single UTM parameter value
 *
 * Applies rules in order: HTML chars → control chars → custom pattern → trim →
 * value pattern gate → maxLength handling.
 *
 * @param value - The raw parameter value
 * @param config - Sanitization configuration
 * @returns Sanitized value
 */
export function sanitizeValue(value: string, config: SanitizeConfig): string {
  return sanitizeValueWithReport(value, config).value
}

/**
 * Why `sanitizeValue` discarded a value outright.
 *
 * Only covers the two gates that reject a whole value. A value reduced to `''`
 * by ordinary stripping is not a rejection — that has always been possible and
 * reporting it would hand every consumer spurious rejections from behaviour
 * that predates the report.
 */
export type SanitizeRejection = 'maxLength' | 'valuePattern'

/**
 * Result of sanitizing a value, with the reason it was dropped if it was.
 */
export interface SanitizeValueResult {
  /** The sanitized value, or `''` if a gate rejected it */
  value: string
  /** Set only when a gate rejected the value outright */
  rejected?: SanitizeRejection
}

/**
 * Sanitize a value and report which gate, if any, rejected it
 *
 * Same rules and ordering as {@link sanitizeValue}; this variant additionally
 * distinguishes "dropped by a gate" from "reduced to empty by stripping".
 *
 * @param value - The raw parameter value
 * @param config - Sanitization configuration
 * @returns The sanitized value plus an optional rejection reason
 */
export function sanitizeValueWithReport(
  value: string,
  config: SanitizeConfig,
): SanitizeValueResult {
  if (!config.enabled) {
    return { value }
  }

  let result = value

  if (config.stripHtml) {
    result = result.replace(/[<>"'`]/g, '')
  }

  if (config.stripControlChars) {
    // Strip control characters \x00-\x1F except tab (\x09), newline (\x0A), carriage return (\x0D)
    // oxlint-disable-next-line no-control-regex
    result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  }

  if (config.customPattern) {
    config.customPattern.lastIndex = 0
    result = result.replace(config.customPattern, '')
  }

  result = result.trim()

  // Gate on the trimmed value. Testing before the trim would reject values whose
  // only offence is surrounding whitespace that this function was about to remove.
  if (config.valuePattern) {
    config.valuePattern.lastIndex = 0
    if (!config.valuePattern.test(result)) {
      return { value: '', rejected: 'valuePattern' }
    }
  }

  if (result.length > config.maxLength) {
    // '' rather than removing the key: hasUtmParameters already treats '' as
    // absent, so it is the established sentinel for "no value".
    if (config.onMaxLength === 'drop') {
      return { value: '', rejected: 'maxLength' }
    }
    result = result.slice(0, config.maxLength)
  }

  return { value: result }
}

/**
 * Sanitize all values in a UTM parameters object
 *
 * Applies sanitization to every non-undefined value. Keys are preserved unchanged.
 *
 * @param params - UTM parameters object
 * @param config - Sanitization configuration
 * @returns New object with sanitized values
 */
export function sanitizeParams(params: UtmParameters, config: SanitizeConfig): UtmParameters {
  if (!config.enabled) {
    return { ...params }
  }

  const result: Record<string, string | undefined> = {}

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      result[key] = undefined
    } else {
      result[key] = sanitizeValue(value, config)
    }
  }

  return result as UtmParameters
}

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
  if (!config.enabled) {
    return value
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
      return ''
    }
  }

  if (result.length > config.maxLength) {
    // '' rather than removing the key: hasUtmParameters already treats '' as
    // absent, so it is the established sentinel for "no value".
    result = config.onMaxLength === 'drop' ? '' : result.slice(0, config.maxLength)
  }

  return result
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

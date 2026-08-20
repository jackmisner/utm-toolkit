/**
 * PII Filter
 *
 * Detects and filters personally identifiable information from UTM parameter values.
 * Prevents email addresses, phone numbers, and other PII from leaking into analytics.
 */

import type { PiiFilterConfig, PiiPattern, UtmParameters } from '../types'

/**
 * Detect PII in a value by testing against enabled patterns
 *
 * @param value - The value to check
 * @param patterns - PII patterns to test against
 * @returns The first matching pattern, or null if no PII detected
 */
export function detectPii(value: string, patterns: PiiPattern[]): PiiPattern | null {
  for (const pattern of patterns) {
    if (!pattern.enabled) {
      continue
    }
    pattern.pattern.lastIndex = 0
    if (pattern.pattern.test(value)) {
      return pattern
    }
  }
  return null
}

/**
 * Filter a single UTM parameter value for PII
 *
 * Checks allowlist first (if configured), then pattern-based detection.
 * In reject mode, returns undefined for PII values.
 * In redact mode, returns '[REDACTED]' for PII values.
 *
 * @param key - The parameter key (for callback reporting)
 * @param value - The parameter value to check
 * @param config - PII filter configuration
 * @returns The original value if clean, undefined (reject) or '[REDACTED]' (redact) if PII detected
 */
export function filterValue(
  key: string,
  value: string,
  config: PiiFilterConfig,
): string | undefined {
  return filterValueWithReport(key, value, config).value
}

/**
 * Why the PII filter rejected a value.
 *
 * `'allowlist'` means the value failed `allowlistPattern`; `'pii'` means a
 * detection pattern matched, and `patternName` names it.
 */
export interface PiiRejection {
  reason: 'pii' | 'allowlist'
  patternName?: string
}

/**
 * Result of PII-filtering a value, with the reason it was rejected if it was.
 */
export interface FilterValueResult {
  /** The value, `undefined` in reject mode, or `'[REDACTED]'` in redact mode */
  value: string | undefined
  /** Set only when the filter rejected the value */
  rejected?: PiiRejection
}

/**
 * Filter a value for PII and report why it was rejected
 *
 * Same rules as {@link filterValue}; this variant additionally reports which
 * check rejected the value. The rejected value itself is never included in the
 * result — see the warning on `PiiFilterConfig.onPiiDetected`.
 *
 * @param key - The parameter key (for callback reporting)
 * @param value - The parameter value to check
 * @param config - PII filter configuration
 * @returns The filtered value plus an optional rejection reason
 */
export function filterValueWithReport(
  key: string,
  value: string,
  config: PiiFilterConfig,
): FilterValueResult {
  if (!config.enabled) {
    return { value }
  }

  // Allowlist check takes precedence
  if (config.allowlistPattern) {
    config.allowlistPattern.lastIndex = 0
    if (!config.allowlistPattern.test(value)) {
      try {
        config.onPiiDetected?.(key, value, 'allowlist')
      } catch {
        // Callback errors should not break the filter pipeline
      }
      return {
        value: config.mode === 'redact' ? '[REDACTED]' : undefined,
        rejected: { reason: 'allowlist' },
      }
    }
    // Value passes allowlist — no further checks needed
    return { value }
  }

  // Pattern-based PII detection
  const detected = detectPii(value, config.patterns)
  if (detected) {
    try {
      config.onPiiDetected?.(key, value, detected.name)
    } catch {
      // Callback errors should not break the filter pipeline
    }
    return {
      value: config.mode === 'redact' ? '[REDACTED]' : undefined,
      rejected: { reason: 'pii', patternName: detected.name },
    }
  }

  return { value }
}

/**
 * Filter all values in a UTM parameters object for PII
 *
 * In reject mode, keys with PII values are removed from the result.
 * In redact mode, PII values are replaced with '[REDACTED]'.
 *
 * @param params - UTM parameters object
 * @param config - PII filter configuration
 * @returns New object with PII values filtered
 */
export function filterParams(params: UtmParameters, config: PiiFilterConfig): UtmParameters {
  if (!config.enabled) {
    return { ...params }
  }

  const result: Record<string, string | undefined> = {}

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      result[key] = undefined
      continue
    }

    const filtered = filterValue(key, value, config)
    if (filtered !== undefined) {
      result[key] = filtered
    }
    // In reject mode, undefined means the key is omitted entirely
  }

  return result as UtmParameters
}

/**
 * UTM Capture Reporting
 *
 * Captures UTM parameters and reports what was rejected on the way, so a
 * consumer can tell "no campaign" apart from "campaign rejected".
 *
 * An empty result means both things today: genuine direct traffic, and a
 * misconfigured campaign link whose every parameter was filtered. Collapsing
 * them inflates the direct-traffic denominator that every campaign share is
 * measured against.
 */

import type { PiiFilterConfig, SanitizeConfig, UtmParameters } from '../types'
import { DEFAULT_PII_FILTER_CONFIG, DEFAULT_SANITIZE_CONFIG } from '../config/defaults'
import { convertParams, isSnakeCaseUtmKey } from '../common/keys'
import { filterValueWithReport } from './pii-filter'
import { sanitizeValueWithReport } from './sanitizer'
// Type-only: erased at build time, so this does not create an import cycle with
// capture.ts, which imports this module's runtime function.
import type { CaptureOptions } from './capture'

/**
 * Why a UTM parameter was discarded during capture
 *
 * - `allowedParameters` — the key was not in the configured allowlist
 * - `valuePattern` — the value failed `sanitize.valuePattern`
 * - `maxLength` — the value exceeded `sanitize.maxLength` under `onMaxLength: 'drop'`
 * - `allowlist` — the value failed `piiFiltering.allowlistPattern`
 * - `pii` — a PII detection pattern matched; see `patternName`
 * - `notAString` — the value was not a string (server-side only; a URL's
 *   search parameters are always strings, so this cannot arise from capture)
 */
export type UtmRejectionReason =
  'allowedParameters' | 'valuePattern' | 'maxLength' | 'allowlist' | 'pii' | 'notAString'

/**
 * A single rejected UTM parameter
 *
 * Carries the key and the reason only. The rejected VALUE is deliberately
 * absent: `PiiFilterConfig.onPiiDetected` already warns that raw values must
 * not be logged or transmitted, and a report struct carrying one would be
 * handed straight to a logger by most consumers who use it.
 */
export interface UtmRejection {
  /**
   * The parameter key, e.g. 'utm_content'.
   *
   * UNTRUSTED. Any `utm_`-prefixed query parameter is captured, so this comes
   * straight from the URL and an attacker controls it — `?utm_someone@example.com=1`
   * yields a rejection whose key contains an email address. Filter to the keys
   * you expect before logging a report.
   */
  key: string

  /** Why the parameter was discarded */
  reason: UtmRejectionReason

  /** For reason 'pii', the name of the matching pattern ('email', 'phone_uk', …) */
  patternName?: string
}

/**
 * The result of a capture, plus what was rejected getting there
 */
export interface CaptureReport {
  /** The parameters that survived the pipeline */
  params: UtmParameters

  /**
   * Every parameter discarded during capture, in pipeline order.
   *
   * Unbounded: a URL carrying 500 offending parameters produces 500 entries.
   * Cap it before logging or emitting metrics keyed on its contents.
   */
  rejected: UtmRejection[]

  /**
   * True when the URL could not be parsed at all.
   *
   * Distinct from an empty `rejected` list: an unparseable URL is neither
   * direct traffic nor a rejected campaign, and reporting it as either would be
   * wrong.
   */
  invalidUrl: boolean
}

/**
 * Check if we're in a browser environment with access to window
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined'
}

/**
 * Extract UTM parameters from a URL and report what was rejected
 *
 * Applies the same pipeline as `captureUtmParameters` — allowlist → lowercase →
 * sanitize → PII filter → key format — and additionally records every parameter
 * discarded along the way.
 *
 * @param url - The URL to extract UTM parameters from (defaults to window.location.href)
 * @param options - Capture options, identical to `captureUtmParameters`
 * @returns The surviving parameters, the rejections, and whether the URL parsed
 *
 * @example
 * ```typescript
 * const { params, rejected } = captureUtmParametersWithReport(url, {
 *   piiFiltering: { enabled: true },
 * })
 * if (Object.keys(params).length === 0 && rejected.length > 0) {
 *   // A campaign link arrived but every parameter was filtered —
 *   // this is NOT direct traffic.
 * }
 * ```
 */
export function captureUtmParametersWithReport(
  url?: string,
  options: CaptureOptions = {},
): CaptureReport {
  const {
    keyFormat = 'snake_case',
    allowedParameters,
    lowercaseValues = false,
    sanitize,
    piiFiltering,
    onCapture,
  } = options

  const rejected: UtmRejection[] = []

  // Get URL, defaulting to current page URL in browser
  const urlString = url ?? (isBrowser() ? window.location.href : '')

  // SSR safety: no URL is absence, not a parse failure
  if (!urlString) {
    return { params: {}, rejected, invalidUrl: false }
  }

  let urlObj: URL
  try {
    urlObj = new URL(urlString)
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        'Failed to parse URL for UTM parameters:',
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
    return { params: {}, rejected, invalidUrl: true }
  }

  const resolvedSanitize: SanitizeConfig = { ...DEFAULT_SANITIZE_CONFIG, ...sanitize }
  const resolvedPiiFilter: PiiFilterConfig = {
    ...DEFAULT_PII_FILTER_CONFIG,
    ...piiFiltering,
    patterns: piiFiltering?.patterns ?? [...DEFAULT_PII_FILTER_CONFIG.patterns],
  }

  const allowedSet =
    allowedParameters && allowedParameters.length > 0 ? new Set(allowedParameters) : null

  // Everything past the URL parse runs inside one guard. A malformed
  // caller-supplied regex or PII pattern is a consumer bug, but capture runs on
  // a page-load path, so it must degrade to "no parameters" rather than throw —
  // the behaviour the pre-refactor implementation had, and callers rely on.
  try {
    // PHASE 1: collect, last-wins. Duplicated query parameters must resolve
    // BEFORE the gates run, so that a rejected later occurrence takes the key
    // with it rather than leaving an earlier accepted duplicate standing, and so
    // that onPiiDetected fires only for the value that actually survives.
    const collected: Record<string, string> = {}
    const reportedKeys = new Set<string>()

    for (const [key, rawValue] of urlObj.searchParams.entries()) {
      // Only capture parameters that start with 'utm_' (case-sensitive)
      if (!isSnakeCaseUtmKey(key)) {
        continue
      }

      if (allowedSet !== null && !allowedSet.has(key)) {
        // Report a disallowed key once, however many times it appears.
        if (!reportedKeys.has(key)) {
          reportedKeys.add(key)
          rejected.push({ key, reason: 'allowedParameters' })
        }
        continue
      }

      // Fold before every gate below, so patterns can assume lowercase input.
      // toLowerCase(), never toLocaleLowerCase(): folding must not depend on locale.
      collected[key] = lowercaseValues ? rawValue.toLowerCase() : rawValue
    }

    // PHASE 2: gate the surviving value for each key.
    const captured: Record<string, string> = {}

    for (const [key, initialValue] of Object.entries(collected)) {
      let value = initialValue

      if (resolvedSanitize.enabled) {
        const result = sanitizeValueWithReport(value, resolvedSanitize)
        if (result.rejected) {
          rejected.push({ key, reason: result.rejected })
        }
        // The key stays, carrying ''. hasUtmParameters already treats '' as absent,
        // so it is the established "no value" sentinel; dropping the key here would
        // be a second, inconsistent one. (PII reject mode does drop the key — that
        // is pre-existing behaviour and is preserved below.)
        value = result.value
      }

      if (resolvedPiiFilter.enabled) {
        const result = filterValueWithReport(key, value, resolvedPiiFilter)
        if (result.rejected) {
          rejected.push({ key, reason: result.rejected.reason, ...pattern(result.rejected) })
        }
        // In redact mode a rejected value survives as '[REDACTED]'; in reject mode
        // it is undefined and the key is dropped entirely.
        if (result.value === undefined) {
          continue
        }
        value = result.value
      }

      captured[key] = value
    }

    const params: UtmParameters =
      keyFormat === 'camelCase'
        ? convertParams(captured as UtmParameters, 'camelCase')
        : (captured as UtmParameters)

    if (onCapture && Object.keys(params).length > 0) {
      try {
        onCapture(params)
      } catch {
        // Callbacks must not break the pipeline
      }
    }

    return { params, rejected, invalidUrl: false }
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        'Failed to capture UTM parameters:',
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
    // invalidUrl stays false: the URL parsed fine, the pipeline did not.
    return { params: {}, rejected, invalidUrl: false }
  }
}

/**
 * Spread helper that omits `patternName` entirely when there isn't one, so the
 * rejection object stays free of `undefined` keys that would surface in JSON.
 */
function pattern(rejection: { patternName?: string }): { patternName?: string } {
  return rejection.patternName === undefined ? {} : { patternName: rejection.patternName }
}

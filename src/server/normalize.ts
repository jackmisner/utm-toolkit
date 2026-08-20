/**
 * Server-side UTM normalisation
 *
 * A DOM-free surface for applying the same folding rules server-side that the
 * browser applies client-side. A public ingest endpoint cannot trust the
 * client-side pass — anyone can POST to it directly — so the rules have to run
 * again on input that is entirely untrusted.
 *
 * Three properties make this different from `captureUtmParameters`:
 *
 * 1. **Total output.** Every allowed key is always present. A consumer writing
 *    these into a composite primary key needs "absent" to be a value that
 *    groups; `undefined`/`NULL` does not deduplicate, so a nullable column
 *    fragments one campaign into as many rows as it has absent parameters.
 * 2. **Never throws, for any input.** The argument is an untrusted HTTP body.
 *    A throw here is a 500 on somebody's first page load.
 * 3. **Server-appropriate defaults.** Lowercasing on, over-length dropped, PII
 *    filtering on. The browser defaults are lenient because losing a campaign
 *    label client-side is cheap; a server keying a store needs determinism.
 */

import type { PiiFilterConfig, SanitizeConfig } from '../types'
import type { UtmRejection } from '../inbound/capture-report'
import { DEFAULT_PII_FILTER_CONFIG, STANDARD_UTM_PARAMETERS } from '../config/defaults'
import { filterValueWithReport } from '../inbound/pii-filter'
import { sanitizeValueWithReport } from '../inbound/sanitizer'

/**
 * Options for server-side normalisation
 *
 * Every default here is stated explicitly because several differ from the
 * browser defaults on purpose.
 */
export interface ServerNormalizeOptions {
  /**
   * Keys to produce. Default: all six `STANDARD_UTM_PARAMETERS`, including
   * `utm_id` — the same set the browser defaults to.
   *
   * Narrow it if you key fewer columns. A consumer keying five columns against
   * a library producing six gets a mystery extra row, so this is stated rather
   * than left to be discovered.
   */
  allowedParameters?: string[]

  /** Maximum value length. Default: 200. */
  maxLength?: number

  /**
   * What to do with an over-length value. Default: `'drop'`.
   *
   * Differs from the browser default (`'truncate'`) deliberately: a truncated
   * value is one nobody sent, and two campaigns sharing a long prefix collapse
   * into a single row.
   */
  onMaxLength?: 'truncate' | 'drop'

  /**
   * Fold values to lowercase. Default: `true`.
   *
   * Differs from the browser default (`false`) deliberately: `LinkedIn` and
   * `linkedin` are one campaign, and a store keyed on the raw value gets two rows.
   */
  lowercase?: boolean

  /** Positive allowlist for values. Default: undefined (accept anything that survives the rest). */
  valuePattern?: RegExp

  /**
   * PII filtering. Default: enabled.
   *
   * Differs from the browser default (disabled) deliberately, because the
   * endpoint is public. `mode` is deliberately not configurable: `'[REDACTED]'`
   * stored as a campaign value is a campaign nobody ran, which is worse than
   * dropping it. Rejection is always used server-side.
   */
  piiFiltering?: Partial<Omit<PiiFilterConfig, 'mode'>>

  /**
   * What an absent or rejected parameter becomes. Default: `''`.
   *
   * Configurable because a consumer may want an unforgeable sentinel that no
   * real campaign value could collide with.
   */
  absentValue?: string
}

/**
 * Result of server-side normalisation
 */
export interface ServerNormalizeResult {
  /**
   * TOTAL: every key in `allowedParameters` is present. Absent and rejected
   * parameters carry `absentValue`.
   */
  params: Record<string, string>

  /** Every parameter that was rejected, with the reason. Never carries the value. */
  rejected: UtmRejection[]
}

/**
 * True for objects that can be safely iterated as a string-keyed record.
 *
 * Arrays are excluded: an array body is not a parameter map, and treating it as
 * one would silently read numeric indices as keys.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Assign a key without tripping over inherited setters.
 *
 * A plain `params[key] = value` for the key `'__proto__'` sets the prototype
 * instead of creating an own property, which would silently break totality.
 * `defineProperty` always creates the own property.
 */
function setParam(params: Record<string, string>, key: string, value: string): void {
  Object.defineProperty(params, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  })
}

/**
 * Normalize UTM parameters from an untrusted request body
 *
 * Accepts input of any shape and never throws. Values that are not strings are
 * rejected rather than coerced — `String(['a','b'])` is `'a,b'`, a value nobody
 * sent.
 *
 * @param input - An untrusted request body, of any shape
 * @param options - Normalisation options; see {@link ServerNormalizeOptions}
 * @returns Total params keyed by `allowedParameters`, plus any rejections
 *
 * @example
 * ```typescript
 * const { params, rejected } = normalizeUtmParams(request.body)
 * await db.insert(params) // every column present, safe to key on
 * if (rejected.length > 0) metrics.increment('utm.rejected', rejected.length)
 * ```
 */
export function normalizeUtmParams(
  input: unknown,
  options: ServerNormalizeOptions = {},
): ServerNormalizeResult {
  const {
    allowedParameters = [...STANDARD_UTM_PARAMETERS],
    maxLength = 200,
    onMaxLength = 'drop',
    lowercase = true,
    valuePattern,
    piiFiltering,
    absentValue = '',
  } = options

  const sanitizeConfig: SanitizeConfig = {
    enabled: true,
    stripHtml: true,
    stripControlChars: true,
    maxLength,
    onMaxLength,
    valuePattern,
  }

  const piiConfig: PiiFilterConfig = {
    ...DEFAULT_PII_FILTER_CONFIG,
    enabled: true,
    ...piiFiltering,
    patterns: piiFiltering?.patterns ?? [...DEFAULT_PII_FILTER_CONFIG.patterns],
    // After the spread: redact mode is never used server-side.
    mode: 'reject',
  }

  const rejected: UtmRejection[] = []
  const params: Record<string, string> = {}
  const source = isPlainRecord(input) ? input : {}

  // Iterate the ALLOWED keys, not the input. This gives totality and sidesteps
  // prototype pollution in one move: a key the caller did not allow can never
  // become an output key, whatever the body contains.
  for (const key of allowedParameters) {
    const raw = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined

    if (raw === undefined || raw === null) {
      setParam(params, key, absentValue)
      continue
    }

    if (typeof raw !== 'string') {
      setParam(params, key, absentValue)
      rejected.push({ key, reason: 'notAString' })
      continue
    }

    // Fold before every gate below, so patterns can assume lowercase input.
    // toLowerCase(), never toLocaleLowerCase(): folding must not depend on locale.
    const folded = lowercase ? raw.toLowerCase() : raw

    const sanitized = sanitizeValueWithReport(folded, sanitizeConfig)
    if (sanitized.rejected) {
      setParam(params, key, absentValue)
      rejected.push({ key, reason: sanitized.rejected })
      continue
    }

    const filtered = filterValueWithReport(key, sanitized.value, piiConfig)
    if (filtered.rejected) {
      setParam(params, key, absentValue)
      rejected.push({
        key,
        reason: filtered.rejected.reason,
        ...(filtered.rejected.patternName === undefined
          ? {}
          : { patternName: filtered.rejected.patternName }),
      })
      continue
    }

    // A value stripped to nothing is absent, not rejected — that outcome
    // predates this module and is not a new rejection reason.
    setParam(
      params,
      key,
      filtered.value === undefined || filtered.value === '' ? absentValue : filtered.value,
    )
  }

  return { params, rejected }
}

/**
 * Normalize UTM parameters from a URL string
 *
 * For servers that have a URL — a `Referer` header, a redirect target — rather
 * than a parsed body. Never throws: a malformed URL yields a total result with
 * every parameter absent.
 *
 * Duplicate query parameters are last-wins, matching `URLSearchParams`
 * iteration and the browser-side behaviour.
 *
 * @param url - The URL to read parameters from
 * @param options - Normalisation options; see {@link ServerNormalizeOptions}
 * @returns Total params keyed by `allowedParameters`, plus any rejections
 */
export function normalizeUtmUrl(
  url: string,
  options: ServerNormalizeOptions = {},
): ServerNormalizeResult {
  if (typeof url !== 'string' || url === '') {
    return normalizeUtmParams({}, options)
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    // A URL we cannot parse carries no parameters. Reported as absence rather
    // than rejection: nothing was filtered, there was nothing to filter.
    return normalizeUtmParams({}, options)
  }

  const collected: Record<string, string> = {}
  for (const [key, value] of parsed.searchParams.entries()) {
    // Last-wins on duplicates, matching URLSearchParams iteration order.
    setParam(collected, key, value)
  }

  return normalizeUtmParams(collected, options)
}

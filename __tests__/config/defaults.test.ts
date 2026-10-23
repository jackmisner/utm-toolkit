import { describe, it, expect, afterEach } from 'vitest'
import {
  DEFAULT_CONFIG,
  DEFAULT_SANITIZE_CONFIG,
  DEFAULT_PII_FILTER_CONFIG,
  DEFAULT_PII_PATTERNS,
  DEFAULT_ATTRIBUTION_CONFIG,
  STANDARD_UTM_PARAMETERS,
} from '../../src/config/defaults'
import {
  SNAKE_TO_CAMEL,
  CAMEL_TO_SNAKE,
  STANDARD_SNAKE_KEYS,
  STANDARD_CAMEL_KEYS,
} from '../../src/common/keys'

/**
 * Every constant here is exported from the root entry, so one of them aliasing
 * another would let a consumer mutating one default silently change a second.
 */
describe('exported defaults are independent of each other', () => {
  it('DEFAULT_CONFIG holds copies of the sibling default objects', () => {
    expect(DEFAULT_CONFIG.sanitize).not.toBe(DEFAULT_SANITIZE_CONFIG)
    expect(DEFAULT_CONFIG.piiFiltering).not.toBe(DEFAULT_PII_FILTER_CONFIG)
    expect(DEFAULT_CONFIG.attribution).not.toBe(DEFAULT_ATTRIBUTION_CONFIG)
    expect(DEFAULT_CONFIG.allowedParameters).not.toBe(STANDARD_UTM_PARAMETERS)
    expect(DEFAULT_CONFIG.piiFiltering.patterns).not.toBe(DEFAULT_PII_PATTERNS)
    expect(DEFAULT_PII_FILTER_CONFIG.patterns).not.toBe(DEFAULT_PII_PATTERNS)
  })

  it('DEFAULT_CONFIG still equals the defaults it copies', () => {
    expect(DEFAULT_CONFIG.sanitize).toEqual(DEFAULT_SANITIZE_CONFIG)
    expect(DEFAULT_CONFIG.attribution).toEqual(DEFAULT_ATTRIBUTION_CONFIG)
    expect(DEFAULT_CONFIG.allowedParameters).toEqual(STANDARD_UTM_PARAMETERS)
    expect(DEFAULT_CONFIG.piiFiltering.patterns).toEqual(DEFAULT_PII_PATTERNS)
  })
})

describe('mutating one exported default does not reach another', () => {
  const originalSanitizeEnabled = DEFAULT_SANITIZE_CONFIG.enabled
  const originalPatternCount = DEFAULT_PII_PATTERNS.length
  const originalParameterCount = DEFAULT_CONFIG.allowedParameters.length

  afterEach(() => {
    DEFAULT_SANITIZE_CONFIG.enabled = originalSanitizeEnabled
    DEFAULT_CONFIG.sanitize.enabled = originalSanitizeEnabled
    DEFAULT_PII_PATTERNS.length = originalPatternCount
    DEFAULT_CONFIG.piiFiltering.patterns.length = originalPatternCount
    DEFAULT_PII_FILTER_CONFIG.patterns.length = originalPatternCount
    DEFAULT_CONFIG.allowedParameters.length = originalParameterCount
  })

  it('writing through DEFAULT_CONFIG.sanitize leaves DEFAULT_SANITIZE_CONFIG alone', () => {
    DEFAULT_CONFIG.sanitize.enabled = !originalSanitizeEnabled
    expect(DEFAULT_SANITIZE_CONFIG.enabled).toBe(originalSanitizeEnabled)
  })

  it('pushing to DEFAULT_CONFIG.allowedParameters leaves STANDARD_UTM_PARAMETERS alone', () => {
    DEFAULT_CONFIG.allowedParameters.push('utm_injected')
    expect(STANDARD_UTM_PARAMETERS).not.toContain('utm_injected')
  })

  it('pushing to DEFAULT_CONFIG.piiFiltering.patterns leaves DEFAULT_PII_PATTERNS alone', () => {
    DEFAULT_CONFIG.piiFiltering.patterns.push({ name: 'injected', pattern: /x/, enabled: true })
    expect(DEFAULT_PII_PATTERNS.map((p) => p.name)).not.toContain('injected')
  })

  it('pushing to DEFAULT_PII_FILTER_CONFIG.patterns leaves DEFAULT_PII_PATTERNS alone', () => {
    DEFAULT_PII_FILTER_CONFIG.patterns.push({ name: 'injected', pattern: /x/, enabled: true })
    expect(DEFAULT_PII_PATTERNS.map((p) => p.name)).not.toContain('injected')
  })
})

/**
 * These lists are derived from the maps above them. Pinning the relationship
 * keeps a literal rewrite of either from drifting out of step.
 */
describe('standard key lists match the maps they come from', () => {
  it('STANDARD_SNAKE_KEYS lists the keys of SNAKE_TO_CAMEL', () => {
    expect(STANDARD_SNAKE_KEYS).toEqual(Object.keys(SNAKE_TO_CAMEL))
  })

  it('STANDARD_CAMEL_KEYS lists the keys of CAMEL_TO_SNAKE', () => {
    expect(STANDARD_CAMEL_KEYS).toEqual(Object.keys(CAMEL_TO_SNAKE))
  })
})

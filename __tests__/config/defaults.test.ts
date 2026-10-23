import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONFIG,
  DEFAULT_SANITIZE_CONFIG,
  DEFAULT_PII_FILTER_CONFIG,
  DEFAULT_PII_PATTERNS,
  DEFAULT_ATTRIBUTION_CONFIG,
  STANDARD_UTM_PARAMETERS,
} from '../../src/config/defaults'

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
    expect(DEFAULT_CONFIG.piiFiltering).toEqual(DEFAULT_PII_FILTER_CONFIG)
    expect(DEFAULT_CONFIG.attribution).toEqual(DEFAULT_ATTRIBUTION_CONFIG)
    expect(DEFAULT_CONFIG.allowedParameters).toEqual(STANDARD_UTM_PARAMETERS)
    expect(DEFAULT_CONFIG.piiFiltering.patterns).toEqual(DEFAULT_PII_PATTERNS)
  })

  it('copies the patterns array without copying the patterns themselves', () => {
    expect(DEFAULT_CONFIG.piiFiltering.patterns[0]).toBe(DEFAULT_PII_PATTERNS[0])
  })
})

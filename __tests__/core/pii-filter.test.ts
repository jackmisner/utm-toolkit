import { describe, it, expect, vi } from 'vitest'
import { detectPii, filterValue, filterParams } from '../../src/core/pii-filter'
import type { PiiFilterConfig, PiiPattern } from '../../src/types'

const defaultPatterns: PiiPattern[] = [
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, enabled: true },
  { name: 'phone_international', pattern: /\+\d{10,15}\b/, enabled: true },
  { name: 'phone_uk', pattern: /\b(?:0|\+44)\d{9,10}\b/, enabled: true },
  { name: 'phone_us', pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/, enabled: true },
]

const defaultConfig: PiiFilterConfig = {
  enabled: true,
  mode: 'reject',
  patterns: defaultPatterns,
}

describe('detectPii', () => {
  it('detects email addresses', () => {
    const result = detectPii('john@example.com', defaultPatterns)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('email')
  })

  it('detects email with plus addressing', () => {
    const result = detectPii('john+tag@example.com', defaultPatterns)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('email')
  })

  it('detects international phone numbers', () => {
    const result = detectPii('+447911123456', defaultPatterns)
    expect(result).not.toBeNull()
  })

  it('detects UK phone numbers', () => {
    const result = detectPii('07911123456', defaultPatterns)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('phone_uk')
  })

  it('detects US phone numbers', () => {
    const result = detectPii('(555) 123-4567', defaultPatterns)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('phone_us')
  })

  it('detects US phone with dots', () => {
    const result = detectPii('555.123.4567', defaultPatterns)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('phone_us')
  })

  it('returns null for clean campaign values', () => {
    const result = detectPii('spring-2025_campaign', defaultPatterns)
    expect(result).toBeNull()
  })

  it('returns null for typical utm_source values', () => {
    const result = detectPii('linkedin', defaultPatterns)
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = detectPii('', defaultPatterns)
    expect(result).toBeNull()
  })

  it('does not flag numeric campaign IDs as phone numbers', () => {
    const result = detectPii('campaign_20250101_12345', defaultPatterns)
    expect(result).toBeNull()
  })

  it('does not flag short numeric tracking codes', () => {
    const result = detectPii('track12345', defaultPatterns)
    expect(result).toBeNull()
  })

  it('skips disabled patterns', () => {
    const patterns: PiiPattern[] = [
      { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, enabled: false },
    ]
    const result = detectPii('john@example.com', patterns)
    expect(result).toBeNull()
  })

  it('returns first matching pattern', () => {
    const value = 'john@example.com'
    const patterns: PiiPattern[] = [
      { name: 'custom_first', pattern: /@/, enabled: true },
      { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, enabled: true },
    ]
    const result = detectPii(value, patterns)
    expect(result!.name).toBe('custom_first')
  })
})

describe('filterValue', () => {
  describe('reject mode', () => {
    it('returns undefined for PII values', () => {
      const result = filterValue('utm_source', 'john@example.com', defaultConfig)
      expect(result).toBeUndefined()
    })

    it('passes through clean values', () => {
      const result = filterValue('utm_source', 'linkedin', defaultConfig)
      expect(result).toBe('linkedin')
    })
  })

  describe('redact mode', () => {
    const redactConfig: PiiFilterConfig = { ...defaultConfig, mode: 'redact' }

    it('replaces entire value with [REDACTED] for PII', () => {
      const result = filterValue('utm_source', 'john@example.com', redactConfig)
      expect(result).toBe('[REDACTED]')
    })

    it('passes through clean values', () => {
      const result = filterValue('utm_source', 'linkedin', redactConfig)
      expect(result).toBe('linkedin')
    })
  })

  describe('allowlist mode', () => {
    const allowlistConfig: PiiFilterConfig = {
      ...defaultConfig,
      allowlistPattern: /^[a-z0-9_-]+$/,
    }

    it('accepts values matching the allowlist', () => {
      const result = filterValue('utm_source', 'spring-2025_campaign', allowlistConfig)
      expect(result).toBe('spring-2025_campaign')
    })

    it('rejects values not matching the allowlist', () => {
      const result = filterValue('utm_source', 'My Campaign!', allowlistConfig)
      expect(result).toBeUndefined()
    })

    it('allowlist takes precedence over PII patterns (clean value with special chars rejected)', () => {
      const result = filterValue('utm_source', 'Campaign With Spaces', allowlistConfig)
      expect(result).toBeUndefined()
    })

    it('allowlist rejects PII values too', () => {
      const result = filterValue('utm_source', 'john@example.com', allowlistConfig)
      expect(result).toBeUndefined()
    })

    it('uses redact mode with allowlist', () => {
      const config: PiiFilterConfig = { ...allowlistConfig, mode: 'redact' }
      const result = filterValue('utm_source', 'My Campaign!', config)
      expect(result).toBe('[REDACTED]')
    })
  })

  describe('onPiiDetected callback', () => {
    it('calls callback when PII is detected via pattern', () => {
      const onPiiDetected = vi.fn()
      const config: PiiFilterConfig = { ...defaultConfig, onPiiDetected }
      filterValue('utm_source', 'john@example.com', config)
      expect(onPiiDetected).toHaveBeenCalledWith('utm_source', 'john@example.com', 'email')
    })

    it('calls callback when value fails allowlist', () => {
      const onPiiDetected = vi.fn()
      const config: PiiFilterConfig = {
        ...defaultConfig,
        allowlistPattern: /^[a-z0-9_-]+$/,
        onPiiDetected,
      }
      filterValue('utm_campaign', 'Bad Value!', config)
      expect(onPiiDetected).toHaveBeenCalledWith('utm_campaign', 'Bad Value!', 'allowlist')
    })

    it('does not call callback for clean values', () => {
      const onPiiDetected = vi.fn()
      const config: PiiFilterConfig = { ...defaultConfig, onPiiDetected }
      filterValue('utm_source', 'linkedin', config)
      expect(onPiiDetected).not.toHaveBeenCalled()
    })

    it('does not break when callback throws', () => {
      const onPiiDetected = vi.fn(() => {
        throw new Error('callback error')
      })
      const config: PiiFilterConfig = { ...defaultConfig, onPiiDetected }
      const result = filterValue('utm_source', 'john@example.com', config)
      expect(result).toBeUndefined()
      expect(onPiiDetected).toHaveBeenCalled()
    })

    it('does not break when allowlist callback throws', () => {
      const onPiiDetected = vi.fn(() => {
        throw new Error('callback error')
      })
      const config: PiiFilterConfig = {
        ...defaultConfig,
        allowlistPattern: /^[a-z]+$/,
        onPiiDetected,
      }
      const result = filterValue('utm_source', 'Bad Value!', config)
      expect(result).toBeUndefined()
      expect(onPiiDetected).toHaveBeenCalled()
    })
  })

  describe('enabled flag', () => {
    it('returns value unchanged when enabled is false', () => {
      const config: PiiFilterConfig = { ...defaultConfig, enabled: false }
      const result = filterValue('utm_source', 'john@example.com', config)
      expect(result).toBe('john@example.com')
    })
  })
})

describe('filterParams', () => {
  it('filters PII from all values in reject mode', () => {
    const params = {
      utm_source: 'john@example.com',
      utm_medium: 'email',
      utm_campaign: 'spring-2025',
    }
    const result = filterParams(params, defaultConfig)
    expect(result).toEqual({
      utm_medium: 'email',
      utm_campaign: 'spring-2025',
    })
    expect(result).not.toHaveProperty('utm_source')
  })

  it('redacts PII values in redact mode', () => {
    const config: PiiFilterConfig = { ...defaultConfig, mode: 'redact' }
    const params = {
      utm_source: 'john@example.com',
      utm_medium: 'email',
    }
    const result = filterParams(params, config)
    expect(result).toEqual({
      utm_source: '[REDACTED]',
      utm_medium: 'email',
    })
  })

  it('preserves clean values', () => {
    const params = {
      utm_source: 'linkedin',
      utm_medium: 'cpc',
      utm_campaign: 'spring-2025',
    }
    const result = filterParams(params, defaultConfig)
    expect(result).toEqual(params)
  })

  it('handles undefined values', () => {
    const params = {
      utm_source: 'linkedin',
      utm_medium: undefined,
    }
    const result = filterParams(params, defaultConfig)
    expect(result).toEqual({
      utm_source: 'linkedin',
      utm_medium: undefined,
    })
  })

  it('returns empty object for empty input', () => {
    const result = filterParams({}, defaultConfig)
    expect(result).toEqual({})
  })

  it('returns params unchanged when enabled is false', () => {
    const config: PiiFilterConfig = { ...defaultConfig, enabled: false }
    const params = {
      utm_source: 'john@example.com',
      utm_medium: 'email',
    }
    const result = filterParams(params, config)
    expect(result).toEqual({
      utm_source: 'john@example.com',
      utm_medium: 'email',
    })
  })

  it('works with camelCase keys', () => {
    const params = {
      utmSource: 'john@example.com',
      utmMedium: 'cpc',
    }
    const result = filterParams(params, defaultConfig)
    expect(result).toEqual({
      utmMedium: 'cpc',
    })
    expect(result).not.toHaveProperty('utmSource')
  })
})

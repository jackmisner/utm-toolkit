import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  captureUtmParameters,
  hasUtmParameters,
  captureFromCurrentUrl,
} from '../../src/core/capture'

describe('captureUtmParameters', () => {
  describe('basic extraction', () => {
    it('extracts UTM parameters from URL', () => {
      const result = captureUtmParameters(
        'https://example.com?utm_source=linkedin&utm_campaign=spring2025',
      )
      expect(result).toEqual({
        utm_source: 'linkedin',
        utm_campaign: 'spring2025',
      })
    })

    it('extracts all standard UTM parameters', () => {
      const result = captureUtmParameters(
        'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=sale&utm_term=keyword&utm_content=banner&utm_id=123',
      )
      expect(result).toEqual({
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'sale',
        utm_term: 'keyword',
        utm_content: 'banner',
        utm_id: '123',
      })
    })

    it('extracts custom UTM parameters', () => {
      const result = captureUtmParameters('https://example.com?utm_source=test&utm_team_id=team123')
      expect(result).toEqual({
        utm_source: 'test',
        utm_team_id: 'team123',
      })
    })

    it('ignores non-UTM parameters', () => {
      const result = captureUtmParameters('https://example.com?ref=abc&utm_source=test&page=1')
      expect(result).toEqual({
        utm_source: 'test',
      })
    })

    it('returns empty object for URL without UTM params', () => {
      const result = captureUtmParameters('https://example.com?ref=abc&page=1')
      expect(result).toEqual({})
    })

    it('returns empty object for URL without query string', () => {
      const result = captureUtmParameters('https://example.com')
      expect(result).toEqual({})
    })
  })

  describe('key format conversion', () => {
    it('returns snake_case by default', () => {
      const result = captureUtmParameters('https://example.com?utm_source=test', {
        keyFormat: 'snake_case',
      })
      expect(result).toEqual({ utm_source: 'test' })
    })

    it('converts to camelCase when specified', () => {
      const result = captureUtmParameters('https://example.com?utm_source=test&utm_campaign=sale', {
        keyFormat: 'camelCase',
      })
      expect(result).toEqual({ utmSource: 'test', utmCampaign: 'sale' })
    })
  })

  describe('allowed parameters filtering', () => {
    it('filters to allowed parameters only', () => {
      const result = captureUtmParameters(
        'https://example.com?utm_source=test&utm_campaign=sale&utm_term=keyword',
        { allowedParameters: ['utm_source', 'utm_campaign'] },
      )
      expect(result).toEqual({
        utm_source: 'test',
        utm_campaign: 'sale',
      })
    })

    it('returns empty when no allowed params found', () => {
      const result = captureUtmParameters('https://example.com?utm_source=test', {
        allowedParameters: ['utm_campaign'],
      })
      expect(result).toEqual({})
    })

    it('captures all when no allowedParameters specified', () => {
      const result = captureUtmParameters('https://example.com?utm_source=test&utm_custom=value')
      expect(result).toEqual({
        utm_source: 'test',
        utm_custom: 'value',
      })
    })
  })

  describe('URL encoding', () => {
    it('decodes URL-encoded values', () => {
      const result = captureUtmParameters(
        'https://example.com?utm_source=my%20source&utm_campaign=test%26demo',
      )
      expect(result).toEqual({
        utm_source: 'my source',
        utm_campaign: 'test&demo',
      })
    })

    it('handles special characters', () => {
      const result = captureUtmParameters('https://example.com?utm_source=test%2Bvalue')
      expect(result).toEqual({ utm_source: 'test+value' })
    })
  })

  describe('edge cases', () => {
    it('handles empty UTM values', () => {
      const result = captureUtmParameters('https://example.com?utm_source=&utm_campaign=test')
      expect(result).toEqual({
        utm_source: '',
        utm_campaign: 'test',
      })
    })

    it('handles URL with fragment', () => {
      const result = captureUtmParameters('https://example.com?utm_source=test#section')
      expect(result).toEqual({ utm_source: 'test' })
    })

    it('handles URL with port', () => {
      const result = captureUtmParameters('https://example.com:8080?utm_source=test')
      expect(result).toEqual({ utm_source: 'test' })
    })

    it('returns empty object for invalid URL', () => {
      const result = captureUtmParameters('not a valid url')
      expect(result).toEqual({})
    })

    it('returns empty object for empty string', () => {
      const result = captureUtmParameters('')
      expect(result).toEqual({})
    })

    it('case sensitive - ignores UTM_ (uppercase)', () => {
      const result = captureUtmParameters('https://example.com?UTM_SOURCE=test&utm_source=correct')
      expect(result).toEqual({ utm_source: 'correct' })
    })
  })
})

describe('hasUtmParameters', () => {
  it('returns true when params have values', () => {
    expect(hasUtmParameters({ utm_source: 'test' })).toBe(true)
    expect(hasUtmParameters({ utmSource: 'test' })).toBe(true)
  })

  it('returns false for empty object', () => {
    expect(hasUtmParameters({})).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(hasUtmParameters(null)).toBe(false)
    expect(hasUtmParameters(undefined)).toBe(false)
  })

  it('returns false when all values are empty', () => {
    expect(hasUtmParameters({ utm_source: '' })).toBe(false)
    expect(hasUtmParameters({ utm_source: '', utm_medium: '' })).toBe(false)
  })

  it('returns false when all values are undefined', () => {
    expect(hasUtmParameters({ utm_source: undefined })).toBe(false)
  })

  it('returns true when at least one value exists', () => {
    expect(hasUtmParameters({ utm_source: '', utm_medium: 'email' })).toBe(true)
  })
})

describe('captureFromCurrentUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('location', {
      href: 'https://example.com?utm_source=window_test',
      search: '?utm_source=window_test',
    })
  })

  it('captures from window.location.href', () => {
    const result = captureFromCurrentUrl()
    expect(result).toEqual({ utm_source: 'window_test' })
  })

  it('applies options', () => {
    const result = captureFromCurrentUrl({ keyFormat: 'camelCase' })
    expect(result).toEqual({ utmSource: 'window_test' })
  })
})

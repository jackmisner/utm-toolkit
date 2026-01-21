import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateUrl,
  normalizeUrl,
  needsNormalization,
  validateAndNormalize,
  getDefaultProtocol,
  setDefaultProtocol,
  getAllowedProtocols,
  isProtocolAllowed,
  getErrorMessage,
} from '../../src/core/validator'

describe('validateUrl', () => {
  describe('valid URLs', () => {
    it('accepts HTTPS URLs with TLD', () => {
      expect(validateUrl('https://example.com')).toEqual({ valid: true })
      expect(validateUrl('https://example.co.uk')).toEqual({ valid: true })
      expect(validateUrl('https://sub.example.com')).toEqual({ valid: true })
    })

    it('accepts HTTP URLs with TLD', () => {
      expect(validateUrl('http://example.com')).toEqual({ valid: true })
      expect(validateUrl('http://www.example.org')).toEqual({ valid: true })
    })

    it('accepts URLs with paths', () => {
      expect(validateUrl('https://example.com/path/to/page')).toEqual({ valid: true })
    })

    it('accepts URLs with query strings', () => {
      expect(validateUrl('https://example.com?foo=bar')).toEqual({ valid: true })
    })

    it('accepts URLs with fragments', () => {
      expect(validateUrl('https://example.com#section')).toEqual({ valid: true })
    })

    it('accepts URLs with ports', () => {
      expect(validateUrl('https://example.com:8080')).toEqual({ valid: true })
    })
  })

  describe('invalid URLs', () => {
    it('rejects empty URLs', () => {
      const result = validateUrl('')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('empty_url')
    })

    it('rejects whitespace-only URLs', () => {
      const result = validateUrl('   ')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('empty_url')
    })

    it('rejects non-HTTP/HTTPS protocols', () => {
      const ftpResult = validateUrl('ftp://example.com')
      expect(ftpResult.valid).toBe(false)
      expect(ftpResult.error).toBe('invalid_protocol')

      const fileResult = validateUrl('file:///path/to/file')
      expect(fileResult.valid).toBe(false)
      expect(fileResult.error).toBe('invalid_protocol')
    })

    it('rejects URLs without TLD', () => {
      const result = validateUrl('https://localhost')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('invalid_domain')
    })

    it('rejects malformed URLs', () => {
      const result = validateUrl('not a url at all')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('malformed_url')
    })

    it('rejects URLs with only dots in domain', () => {
      const result = validateUrl('https://....')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('invalid_domain')
    })
  })

  describe('error messages', () => {
    it('includes human-readable message', () => {
      const result = validateUrl('ftp://example.com')
      expect(result.message).toBeDefined()
      expect(typeof result.message).toBe('string')
    })
  })
})

describe('normalizeUrl', () => {
  it('adds https:// to URLs without protocol', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
    expect(normalizeUrl('www.example.com')).toBe('https://www.example.com')
  })

  it('preserves existing HTTPS protocol', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
  })

  it('preserves existing HTTP protocol', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com')
  })

  it('preserves other protocols', () => {
    expect(normalizeUrl('ftp://example.com')).toBe('ftp://example.com')
  })

  it('trims whitespace', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com')
  })

  it('handles non-string input', () => {
    // @ts-expect-error testing runtime behavior
    expect(normalizeUrl(123)).toBe(123)
    // @ts-expect-error testing runtime behavior
    expect(normalizeUrl(null)).toBe(null)
  })
})

describe('needsNormalization', () => {
  it('returns true for URLs without protocol', () => {
    expect(needsNormalization('example.com')).toBe(true)
    expect(needsNormalization('www.example.com')).toBe(true)
  })

  it('returns false for URLs with protocol', () => {
    expect(needsNormalization('https://example.com')).toBe(false)
    expect(needsNormalization('http://example.com')).toBe(false)
    expect(needsNormalization('ftp://example.com')).toBe(false)
  })

  it('handles whitespace', () => {
    expect(needsNormalization('  example.com  ')).toBe(true)
    expect(needsNormalization('  https://example.com  ')).toBe(false)
  })

  it('returns false for non-strings', () => {
    // @ts-expect-error testing runtime behavior
    expect(needsNormalization(123)).toBe(false)
    // @ts-expect-error testing runtime behavior
    expect(needsNormalization(null)).toBe(false)
  })
})

describe('validateAndNormalize', () => {
  it('normalizes and validates valid URL without protocol', () => {
    const result = validateAndNormalize('example.com')
    expect(result.valid).toBe(true)
    expect(result.normalizedUrl).toBe('https://example.com')
  })

  it('returns invalid result for invalid domain after normalization', () => {
    const result = validateAndNormalize('localhost')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid_domain')
    expect(result.normalizedUrl).toBe('https://localhost')
  })

  it('validates URLs that already have protocol', () => {
    const result = validateAndNormalize('https://example.com')
    expect(result.valid).toBe(true)
    expect(result.normalizedUrl).toBe('https://example.com')
  })
})

describe('getDefaultProtocol / setDefaultProtocol', () => {
  beforeEach(() => {
    setDefaultProtocol('https://')
  })

  it('returns current default protocol', () => {
    expect(getDefaultProtocol()).toBe('https://')
  })

  it('allows setting custom default protocol', () => {
    setDefaultProtocol('http://')
    expect(getDefaultProtocol()).toBe('http://')
    expect(normalizeUrl('example.com')).toBe('http://example.com')
  })

  it('throws for invalid protocol format', () => {
    expect(() => setDefaultProtocol('https')).toThrow()
    expect(() => setDefaultProtocol('https:')).toThrow()
    // @ts-expect-error testing runtime behavior
    expect(() => setDefaultProtocol(123)).toThrow()
  })
})

describe('getAllowedProtocols', () => {
  it('returns array of allowed protocols', () => {
    const protocols = getAllowedProtocols()
    expect(Array.isArray(protocols)).toBe(true)
    expect(protocols).toContain('http:')
    expect(protocols).toContain('https:')
  })
})

describe('isProtocolAllowed', () => {
  it('returns true for HTTP and HTTPS', () => {
    expect(isProtocolAllowed('http:')).toBe(true)
    expect(isProtocolAllowed('https:')).toBe(true)
  })

  it('returns false for other protocols', () => {
    expect(isProtocolAllowed('ftp:')).toBe(false)
    expect(isProtocolAllowed('file:')).toBe(false)
    expect(isProtocolAllowed('data:')).toBe(false)
  })
})

describe('getErrorMessage', () => {
  it('returns message for known error types', () => {
    expect(getErrorMessage('invalid_protocol')).toContain('HTTP')
    expect(getErrorMessage('invalid_domain')).toContain('domain')
    expect(getErrorMessage('malformed_url')).toContain('malformed')
    expect(getErrorMessage('empty_url')).toContain('empty')
  })

  it('returns fallback for unknown error', () => {
    // @ts-expect-error testing runtime behavior
    expect(getErrorMessage('unknown_error')).toBe('Unknown validation error')
  })
})

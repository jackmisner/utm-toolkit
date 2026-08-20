import { describe, it, expect } from 'vitest'
import { sanitizeValue, sanitizeParams } from '../../src/inbound/sanitizer'
import type { SanitizeConfig } from '../../src/types'

const defaultConfig: SanitizeConfig = {
  enabled: true,
  stripHtml: true,
  stripControlChars: true,
  maxLength: 200,
}

describe('sanitizeValue', () => {
  describe('stripHtml', () => {
    it('strips HTML-significant characters', () => {
      const result = sanitizeValue('<script>alert("xss")</script>', defaultConfig)
      expect(result).toBe('scriptalert(xss)/script')
    })

    it('strips backticks', () => {
      const result = sanitizeValue('value`with`backticks', defaultConfig)
      expect(result).toBe('valuewithbackticks')
    })

    it('strips single quotes', () => {
      const result = sanitizeValue("it's a test", defaultConfig)
      expect(result).toBe('its a test')
    })

    it('does not strip HTML characters when stripHtml is false', () => {
      const config: SanitizeConfig = { ...defaultConfig, stripHtml: false }
      const result = sanitizeValue('<b>bold</b>', config)
      expect(result).toBe('<b>bold</b>')
    })
  })

  describe('stripControlChars', () => {
    it('strips null bytes and control characters', () => {
      const result = sanitizeValue('hello\x00world\x01test', defaultConfig)
      expect(result).toBe('helloworldtest')
    })

    it('preserves tab, newline, and carriage return in middle of string', () => {
      const result = sanitizeValue('hello\tworld\ntest\rend', defaultConfig)
      expect(result).toBe('hello\tworld\ntest\rend')
    })

    it('does not strip control characters when stripControlChars is false', () => {
      const config: SanitizeConfig = { ...defaultConfig, stripControlChars: false }
      const result = sanitizeValue('hello\x00world', config)
      expect(result).toBe('hello\x00world')
    })
  })

  describe('maxLength', () => {
    it('truncates values exceeding maxLength', () => {
      const config: SanitizeConfig = { ...defaultConfig, maxLength: 10 }
      const result = sanitizeValue('this is a long value', config)
      expect(result).toBe('this is a ')
    })

    it('does not truncate values within maxLength', () => {
      const config: SanitizeConfig = { ...defaultConfig, maxLength: 50 }
      const result = sanitizeValue('short', config)
      expect(result).toBe('short')
    })

    it('truncates after stripping (not before)', () => {
      const config: SanitizeConfig = { ...defaultConfig, maxLength: 5 }
      // After stripping < and >, "ab" remains, which is within limit
      const result = sanitizeValue('<>ab', config)
      expect(result).toBe('ab')
    })
  })

  describe('customPattern', () => {
    it('strips characters matching custom pattern', () => {
      const config: SanitizeConfig = {
        ...defaultConfig,
        customPattern: /[!@#$%^&*]/g,
      }
      const result = sanitizeValue('hello!@#world', config)
      expect(result).toBe('helloworld')
    })

    it('applies custom pattern after built-in stripping', () => {
      const config: SanitizeConfig = {
        ...defaultConfig,
        customPattern: /\d+/g,
      }
      const result = sanitizeValue('<tag>abc123</tag>', config)
      expect(result).toBe('tagabc/tag')
    })
  })

  describe('whitespace trimming', () => {
    it('trims leading and trailing whitespace', () => {
      const result = sanitizeValue('  hello world  ', defaultConfig)
      expect(result).toBe('hello world')
    })

    it('trims whitespace left after stripping', () => {
      const result = sanitizeValue('  <> ', defaultConfig)
      expect(result).toBe('')
    })
  })

  describe('enabled flag', () => {
    it('returns value unchanged when enabled is false', () => {
      const config: SanitizeConfig = { ...defaultConfig, enabled: false }
      const result = sanitizeValue('<script>alert("xss")</script>', config)
      expect(result).toBe('<script>alert("xss")</script>')
    })
  })

  describe('onMaxLength', () => {
    it('truncates by default, preserving current behaviour', () => {
      const result = sanitizeValue('a'.repeat(250), defaultConfig)
      expect(result).toBe('a'.repeat(200))
    })

    it('truncates when explicitly set to truncate', () => {
      const config: SanitizeConfig = { ...defaultConfig, onMaxLength: 'truncate' }
      const result = sanitizeValue('a'.repeat(250), config)
      expect(result).toBe('a'.repeat(200))
    })

    it('drops the whole value when set to drop', () => {
      const config: SanitizeConfig = { ...defaultConfig, onMaxLength: 'drop' }
      const result = sanitizeValue('a'.repeat(250), config)
      expect(result).toBe('')
    })

    it('leaves a value exactly at maxLength untouched under truncate', () => {
      const config: SanitizeConfig = { ...defaultConfig, maxLength: 10, onMaxLength: 'truncate' }
      expect(sanitizeValue('a'.repeat(10), config)).toBe('a'.repeat(10))
    })

    it('leaves a value exactly at maxLength untouched under drop', () => {
      const config: SanitizeConfig = { ...defaultConfig, maxLength: 10, onMaxLength: 'drop' }
      expect(sanitizeValue('a'.repeat(10), config)).toBe('a'.repeat(10))
    })

    it('drops a value one character over maxLength', () => {
      const config: SanitizeConfig = { ...defaultConfig, maxLength: 10, onMaxLength: 'drop' }
      expect(sanitizeValue('a'.repeat(11), config)).toBe('')
    })
  })

  describe('valuePattern', () => {
    it('keeps a value that matches the pattern', () => {
      const config: SanitizeConfig = { ...defaultConfig, valuePattern: /^[a-z0-9_-]+$/ }
      expect(sanitizeValue('spring-2025_campaign', config)).toBe('spring-2025_campaign')
    })

    it('drops a value that does not match the pattern', () => {
      const config: SanitizeConfig = { ...defaultConfig, valuePattern: /^[a-z]+$/ }
      expect(sanitizeValue('has spaces and 123', config)).toBe('')
    })

    it('is undefined by default, so any value survives', () => {
      expect(sanitizeValue('anything at all !@#', defaultConfig)).toBe('anything at all !@#')
    })

    it('gives the same answer twice with a g-flagged pattern', () => {
      const config: SanitizeConfig = { ...defaultConfig, valuePattern: /^[a-z]+$/g }
      const first = sanitizeValue('linkedin', config)
      const second = sanitizeValue('linkedin', config)
      expect(first).toBe('linkedin')
      expect(second).toBe(first)
    })

    it('tests the trimmed value, not the raw one', () => {
      const config: SanitizeConfig = { ...defaultConfig, valuePattern: /^[a-z]+$/ }
      expect(sanitizeValue('  linkedin  ', config)).toBe('linkedin')
    })
  })

  describe('edge cases', () => {
    it('returns empty string when everything is stripped', () => {
      const result = sanitizeValue('<>"\'`', defaultConfig)
      expect(result).toBe('')
    })

    it('returns empty string for empty input', () => {
      const result = sanitizeValue('', defaultConfig)
      expect(result).toBe('')
    })

    it('is idempotent', () => {
      const input = '<script>alert("xss")</script>'
      const once = sanitizeValue(input, defaultConfig)
      const twice = sanitizeValue(once, defaultConfig)
      expect(once).toBe(twice)
    })

    it('handles normal UTM values without modification', () => {
      const result = sanitizeValue('linkedin', defaultConfig)
      expect(result).toBe('linkedin')
    })

    it('handles typical campaign names', () => {
      const result = sanitizeValue('spring-2025_campaign', defaultConfig)
      expect(result).toBe('spring-2025_campaign')
    })
  })
})

describe('sanitizeParams', () => {
  it('sanitizes all values in a params object', () => {
    const params = {
      utm_source: '<script>bad</script>',
      utm_medium: 'email',
    }
    const result = sanitizeParams(params, defaultConfig)
    expect(result).toEqual({
      utm_source: 'scriptbad/script',
      utm_medium: 'email',
    })
  })

  it('preserves keys unchanged', () => {
    const params = {
      utm_source: 'test<>value',
      utm_campaign: 'normal',
    }
    const result = sanitizeParams(params, defaultConfig)
    expect(result).toHaveProperty('utm_source')
    expect(result).toHaveProperty('utm_campaign')
  })

  it('skips undefined values', () => {
    const params = {
      utm_source: 'linkedin',
      utm_medium: undefined,
    }
    const result = sanitizeParams(params, defaultConfig)
    expect(result).toEqual({
      utm_source: 'linkedin',
      utm_medium: undefined,
    })
  })

  it('returns empty object for empty input', () => {
    const result = sanitizeParams({}, defaultConfig)
    expect(result).toEqual({})
  })

  it('returns params unchanged when enabled is false', () => {
    const config: SanitizeConfig = { ...defaultConfig, enabled: false }
    const params = {
      utm_source: '<script>bad</script>',
      utm_medium: 'email',
    }
    const result = sanitizeParams(params, config)
    expect(result).toEqual({
      utm_source: '<script>bad</script>',
      utm_medium: 'email',
    })
  })

  it('works with camelCase keys', () => {
    const params = {
      utmSource: '<b>bold</b>',
      utmMedium: 'cpc',
    }
    const result = sanitizeParams(params, defaultConfig)
    expect(result).toEqual({
      utmSource: 'bbold/b',
      utmMedium: 'cpc',
    })
  })
})

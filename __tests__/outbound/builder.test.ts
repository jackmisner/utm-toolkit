import { describe, it, expect, vi } from 'vitest'
import { buildUtmUrl, validateUtmValues } from '../../src/outbound/builder'

describe('buildUtmUrl', () => {
  describe('valid builds', () => {
    it('builds a URL with required source param', () => {
      const result = buildUtmUrl({ url: 'https://example.com', source: 'google' })
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.url).toContain('utm_source=google')
    })

    it('builds a URL with all standard params', () => {
      const result = buildUtmUrl({
        url: 'https://example.com',
        source: 'google',
        medium: 'cpc',
        campaign: 'spring2025',
        term: 'shoes',
        content: 'banner1',
        id: '123',
      })
      expect(result.valid).toBe(true)
      expect(result.url).toContain('utm_source=google')
      expect(result.url).toContain('utm_medium=cpc')
      expect(result.url).toContain('utm_campaign=spring2025')
      expect(result.url).toContain('utm_term=shoes')
      expect(result.url).toContain('utm_content=banner1')
      expect(result.url).toContain('utm_id=123')
    })

    it('preserves existing query params on the base URL', () => {
      const result = buildUtmUrl({
        url: 'https://example.com?page=1',
        source: 'google',
      })
      expect(result.url).toContain('page=1')
      expect(result.url).toContain('utm_source=google')
    })
  })

  describe('URL normalization', () => {
    it('adds https:// if missing when normalize is true (default)', () => {
      const result = buildUtmUrl({ url: 'example.com', source: 'google' })
      expect(result.valid).toBe(true)
      expect(result.url).toMatch(/^https:\/\//)
    })

    it('does not normalize when normalize is false', () => {
      const result = buildUtmUrl({ url: 'example.com', source: 'google' }, { normalize: false })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('url is invalid')
    })
  })

  describe('validation', () => {
    it('returns error when source is empty', () => {
      const result = buildUtmUrl({ url: 'https://example.com', source: '' })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('source is required')
    })

    it('returns error when URL is invalid', () => {
      const result = buildUtmUrl({ url: 'not a url', source: 'google' }, { normalize: false })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('url is invalid')
    })

    it('returns error when param values contain unsafe characters', () => {
      const result = buildUtmUrl({
        url: 'https://example.com',
        source: 'goo&gle',
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('source'))).toBe(true)
    })

    it('returns errors for multiple unsafe params', () => {
      const result = buildUtmUrl({
        url: 'https://example.com',
        source: 'goo=gle',
        medium: 'cp?c',
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('warnings', () => {
    it('warns about uppercase characters in values', () => {
      const result = buildUtmUrl({
        url: 'https://example.com',
        source: 'Google',
      })
      expect(result.valid).toBe(true)
      expect(result.warnings.some((w) => w.includes('uppercase'))).toBe(true)
    })

    it('no warnings for lowercase values', () => {
      const result = buildUtmUrl({
        url: 'https://example.com',
        source: 'google',
      })
      expect(result.warnings).toEqual([])
    })
  })

  describe('options', () => {
    it('lowercases values when lowercaseValues is true', () => {
      const result = buildUtmUrl(
        { url: 'https://example.com', source: 'Google', campaign: 'Spring2025' },
        { lowercaseValues: true },
      )
      expect(result.url).toContain('utm_source=google')
      expect(result.url).toContain('utm_campaign=spring2025')
      expect(result.warnings).toEqual([])
    })

    it('skips URL validation when validate is false', () => {
      const result = buildUtmUrl(
        { url: 'anything', source: 'google' },
        { validate: false, normalize: false },
      )
      // Should still try to build (may fail at URL construction)
      expect(result.errors.every((e) => e !== 'url is invalid')).toBe(true)
    })

    it('fires onAppend callback with final URL and params', () => {
      const onAppend = vi.fn()
      const result = buildUtmUrl({ url: 'https://example.com', source: 'google' }, { onAppend })
      expect(onAppend).toHaveBeenCalledOnce()
      expect(onAppend).toHaveBeenCalledWith(
        result.url,
        expect.objectContaining({ utm_source: 'google' }),
      )
    })

    it('does not fire onAppend when build fails', () => {
      const onAppend = vi.fn()
      buildUtmUrl({ url: 'https://example.com', source: '' }, { onAppend })
      expect(onAppend).not.toHaveBeenCalled()
    })
  })
})

describe('validateUtmValues', () => {
  it('returns no errors for valid values', () => {
    const result = validateUtmValues({ source: 'google', medium: 'cpc' })
    expect(result.errors).toEqual([])
  })

  it('returns errors for unsafe characters', () => {
    const result = validateUtmValues({ source: 'goo&gle' })
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('returns warnings for uppercase values', () => {
    const result = validateUtmValues({ source: 'Google' })
    expect(result.warnings.some((w) => w.includes('uppercase'))).toBe(true)
  })

  it('handles empty/undefined values gracefully', () => {
    const result = validateUtmValues({})
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })
})

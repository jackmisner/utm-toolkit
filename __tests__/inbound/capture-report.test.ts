import { describe, it, expect } from 'vitest'
import { captureUtmParameters } from '../../src/inbound/capture'
import { captureUtmParametersWithReport } from '../../src/inbound/capture-report'

const EMAIL = 'someone@example.com'

describe('captureUtmParametersWithReport', () => {
  describe('absence versus rejection', () => {
    it('reports zero rejections for a URL with no UTM parameters', () => {
      const report = captureUtmParametersWithReport('https://example.com/page')
      expect(report.params).toEqual({})
      expect(report.rejected).toEqual([])
      expect(report.invalidUrl).toBe(false)
    })

    it('reports a rejection when the only parameter is filtered as PII', () => {
      const report = captureUtmParametersWithReport(
        `https://example.com?utm_source=${encodeURIComponent(EMAIL)}`,
        { piiFiltering: { enabled: true } },
      )
      expect(report.params).toEqual({})
      expect(report.rejected).toHaveLength(1)
      expect(report.rejected[0].key).toBe('utm_source')
      expect(report.rejected[0].reason).toBe('pii')
    })

    it('distinguishes the two: both produce empty params but different reports', () => {
      const absent = captureUtmParametersWithReport('https://example.com/page')
      const rejected = captureUtmParametersWithReport(
        `https://example.com?utm_source=${encodeURIComponent(EMAIL)}`,
        { piiFiltering: { enabled: true } },
      )
      expect(absent.params).toEqual(rejected.params)
      expect(absent.rejected).toHaveLength(0)
      expect(rejected.rejected).toHaveLength(1)
    })
  })

  describe('rejection reasons', () => {
    it('names the matching PII pattern', () => {
      const report = captureUtmParametersWithReport(
        `https://example.com?utm_content=${encodeURIComponent(EMAIL)}`,
        { piiFiltering: { enabled: true } },
      )
      expect(report.rejected[0].patternName).toBe('email')
    })

    it('reports maxLength when an over-length value is dropped', () => {
      const report = captureUtmParametersWithReport(
        `https://example.com?utm_source=${'a'.repeat(50)}`,
        { sanitize: { enabled: true, maxLength: 10, onMaxLength: 'drop' } },
      )
      expect(report.rejected).toEqual([{ key: 'utm_source', reason: 'maxLength' }])
    })

    it('does not report a rejection when an over-length value is merely truncated', () => {
      const report = captureUtmParametersWithReport(
        `https://example.com?utm_source=${'a'.repeat(50)}`,
        { sanitize: { enabled: true, maxLength: 10, onMaxLength: 'truncate' } },
      )
      expect(report.rejected).toEqual([])
      expect(report.params.utm_source).toBe('a'.repeat(10))
    })

    it('reports valuePattern when a value fails the gate', () => {
      const report = captureUtmParametersWithReport('https://example.com?utm_source=has%20spaces', {
        sanitize: { enabled: true, valuePattern: /^[a-z]+$/ },
      })
      expect(report.rejected).toEqual([{ key: 'utm_source', reason: 'valuePattern' }])
    })

    it('reports allowlist when the PII allowlist pattern rejects a value', () => {
      const report = captureUtmParametersWithReport('https://example.com?utm_source=UPPER', {
        piiFiltering: { enabled: true, allowlistPattern: /^[a-z]+$/ },
      })
      expect(report.rejected).toEqual([{ key: 'utm_source', reason: 'allowlist' }])
    })

    it('reports allowedParameters when a utm_ key is not in the allowlist', () => {
      const report = captureUtmParametersWithReport(
        'https://example.com?utm_source=linkedin&utm_term=ignored',
        { allowedParameters: ['utm_source'] },
      )
      expect(report.params).toEqual({ utm_source: 'linkedin' })
      expect(report.rejected).toEqual([{ key: 'utm_term', reason: 'allowedParameters' }])
    })

    it('does not report a value that becomes empty through ordinary stripping', () => {
      const report = captureUtmParametersWithReport(
        'https://example.com?utm_source=%3C%3E%22%27%60',
        { sanitize: { enabled: true } },
      )
      expect(report.rejected).toEqual([])
    })
  })

  describe('malformed URLs', () => {
    it('flags an unparseable URL rather than reporting it as no campaign', () => {
      const report = captureUtmParametersWithReport('not a url at all')
      expect(report.invalidUrl).toBe(true)
      expect(report.params).toEqual({})
    })

    it('does not flag a well-formed URL', () => {
      const report = captureUtmParametersWithReport('https://example.com?utm_source=linkedin')
      expect(report.invalidUrl).toBe(false)
    })
  })

  describe('rejection is per-parameter, not per-request', () => {
    it('keeps a good parameter while reporting a bad sibling', () => {
      const report = captureUtmParametersWithReport(
        `https://example.com?utm_source=linkedin&utm_content=${encodeURIComponent(EMAIL)}`,
        { piiFiltering: { enabled: true } },
      )
      expect(report.params).toEqual({ utm_source: 'linkedin' })
      expect(report.rejected).toHaveLength(1)
      expect(report.rejected[0].key).toBe('utm_content')
    })
  })

  describe('the report never carries the rejected value', () => {
    it('does not contain the email anywhere in the serialised report', () => {
      const report = captureUtmParametersWithReport(
        `https://example.com?utm_content=${encodeURIComponent(EMAIL)}`,
        { piiFiltering: { enabled: true } },
      )
      const serialised = JSON.stringify(report)
      expect(serialised).not.toContain(EMAIL)
      expect(serialised).not.toContain('someone')
      expect(serialised).not.toContain('example.com')
    })

    it('does not contain an over-length value that was dropped', () => {
      const secret = 'z'.repeat(50)
      const report = captureUtmParametersWithReport(`https://example.com?utm_source=${secret}`, {
        sanitize: { enabled: true, maxLength: 10, onMaxLength: 'drop' },
      })
      expect(JSON.stringify(report)).not.toContain(secret)
    })
  })

  describe('captureUtmParameters delegates without changing behaviour', () => {
    const cases: Array<[string, string, Parameters<typeof captureUtmParameters>[1]]> = [
      ['plain capture', 'https://example.com?utm_source=linkedin', undefined],
      ['camelCase keys', 'https://example.com?utm_source=linkedin', { keyFormat: 'camelCase' }],
      [
        'allowlist filtering',
        'https://example.com?utm_source=a&utm_term=b',
        { allowedParameters: ['utm_source'] },
      ],
      [
        'sanitisation',
        'https://example.com?utm_source=%3Cb%3Ebold%3C%2Fb%3E',
        { sanitize: { enabled: true } },
      ],
      [
        'pii filtering',
        `https://example.com?utm_source=${encodeURIComponent(EMAIL)}`,
        { piiFiltering: { enabled: true } },
      ],
      ['lowercasing', 'https://example.com?utm_source=LinkedIn', { lowercaseValues: true }],
      ['no utm params', 'https://example.com/page', undefined],
      ['malformed url', 'not a url', undefined],
    ]

    it.each(cases)('matches captureUtmParameters for %s', (_name, url, options) => {
      expect(captureUtmParameters(url, options)).toEqual(
        captureUtmParametersWithReport(url, options).params,
      )
    })
  })

  describe('callbacks', () => {
    it('fires onCapture exactly once with the surviving params', () => {
      const seen: unknown[] = []
      captureUtmParametersWithReport('https://example.com?utm_source=linkedin', {
        onCapture: (p) => seen.push(p),
      })
      expect(seen).toEqual([{ utm_source: 'linkedin' }])
    })

    it('does not fire onCapture when everything was rejected', () => {
      const seen: unknown[] = []
      captureUtmParametersWithReport(
        `https://example.com?utm_source=${encodeURIComponent(EMAIL)}`,
        { piiFiltering: { enabled: true }, onCapture: (p) => seen.push(p) },
      )
      expect(seen).toEqual([])
    })
  })
})

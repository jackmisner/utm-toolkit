import { describe, it, expect, vi } from 'vitest'
import { getDiagnostics } from '../../src/debug'
import { createConfig } from '../../src/config/loader'

/**
 * getDiagnostics exists to answer "why is the stored value not what I expect".
 * It can only do that if it captures through the same options the real pipeline
 * uses — otherwise it reports a value nobody's pipeline ever produced, and the
 * tool that is supposed to resolve the confusion becomes the cause of it.
 */
describe('getDiagnostics urlParams reflects the configured pipeline', () => {
  const stubUrl = (href: string): void => {
    vi.stubGlobal('location', { href, search: href.slice(href.indexOf('?')) })
  }

  it('applies lowercaseValues from config', () => {
    stubUrl('https://example.com?utm_source=LinkedIn')
    const diagnostics = getDiagnostics(createConfig({ lowercaseValues: true }))
    expect(diagnostics.urlParams.utm_source).toBe('linkedin')
  })

  it('leaves case alone when lowercaseValues is off', () => {
    stubUrl('https://example.com?utm_source=LinkedIn')
    const diagnostics = getDiagnostics(createConfig({}))
    expect(diagnostics.urlParams.utm_source).toBe('LinkedIn')
  })

  it('applies sanitize from config', () => {
    stubUrl('https://example.com?utm_source=%3Cb%3Ebold%3C%2Fb%3E')
    const diagnostics = getDiagnostics(createConfig({ sanitize: { enabled: true } }))
    expect(diagnostics.urlParams.utm_source).toBe('bbold/b')
  })

  it('applies PII filtering from config', () => {
    stubUrl('https://example.com?utm_source=someone%40example.com')
    const diagnostics = getDiagnostics(createConfig({ piiFiltering: { enabled: true } }))
    expect(diagnostics.urlParams).toEqual({})
  })

  it('still honours keyFormat and allowedParameters', () => {
    stubUrl('https://example.com?utm_source=x&utm_term=y')
    const diagnostics = getDiagnostics(
      createConfig({ keyFormat: 'camelCase', allowedParameters: ['utm_source'] }),
    )
    expect(diagnostics.urlParams).toEqual({ utmSource: 'x' })
  })
})

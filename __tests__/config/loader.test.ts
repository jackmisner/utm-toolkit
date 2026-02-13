import { describe, it, expect } from 'vitest'
import {
  createConfig,
  mergeConfig,
  loadConfigFromJson,
  validateConfig,
  DEFAULT_CONFIG,
  getDefaultConfig,
} from '../../src/config/loader'

describe('createConfig', () => {
  it('returns default config when no options provided', () => {
    const config = createConfig()
    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it('merges user config with defaults', () => {
    const config = createConfig({
      keyFormat: 'camelCase',
      storageKey: 'custom_key',
    })

    expect(config.keyFormat).toBe('camelCase')
    expect(config.storageKey).toBe('custom_key')
    expect(config.enabled).toBe(true) // Default
    expect(config.captureOnMount).toBe(true) // Default
  })

  it('overrides allowedParameters completely', () => {
    const config = createConfig({
      allowedParameters: ['utm_source'],
    })

    expect(config.allowedParameters).toEqual(['utm_source'])
  })

  it('merges defaultParams', () => {
    const config = createConfig({
      defaultParams: { utm_source: 'default' },
    })

    expect(config.defaultParams).toEqual({ utm_source: 'default' })
  })

  it('merges shareContextParams', () => {
    const config = createConfig({
      shareContextParams: {
        linkedin: { utm_content: 'linkedin_share' },
      },
    })

    expect(config.shareContextParams.linkedin).toEqual({ utm_content: 'linkedin_share' })
  })

  it('handles excludeFromShares', () => {
    const config = createConfig({
      excludeFromShares: ['utm_team_id'],
    })

    expect(config.excludeFromShares).toEqual(['utm_team_id'])
  })

  it('handles boolean options', () => {
    const config = createConfig({
      enabled: false,
      captureOnMount: false,
      appendToShares: false,
    })

    expect(config.enabled).toBe(false)
    expect(config.captureOnMount).toBe(false)
    expect(config.appendToShares).toBe(false)
  })
})

describe('mergeConfig', () => {
  it('merges override into base config', () => {
    const base = getDefaultConfig()
    const merged = mergeConfig(base, {
      keyFormat: 'camelCase',
      enabled: false,
    })

    expect(merged.keyFormat).toBe('camelCase')
    expect(merged.enabled).toBe(false)
    expect(merged.storageKey).toBe(base.storageKey) // Unchanged
  })

  it('completely replaces arrays when overridden', () => {
    const base = getDefaultConfig()
    const merged = mergeConfig(base, {
      allowedParameters: ['utm_source'],
      excludeFromShares: ['utm_team_id'],
    })

    expect(merged.allowedParameters).toEqual(['utm_source'])
    expect(merged.excludeFromShares).toEqual(['utm_team_id'])
  })

  it('merges shareContextParams deeply', () => {
    const base = getDefaultConfig()
    base.shareContextParams = { default: { utm_medium: 'share' } }

    const merged = mergeConfig(base, {
      shareContextParams: {
        linkedin: { utm_content: 'linkedin' },
      },
    })

    expect(merged.shareContextParams.default).toEqual({ utm_medium: 'share' })
    expect(merged.shareContextParams.linkedin).toEqual({ utm_content: 'linkedin' })
  })
})

describe('loadConfigFromJson', () => {
  it('loads valid JSON config', () => {
    const json = {
      enabled: true,
      keyFormat: 'camelCase',
      storageKey: 'my_utm',
    }

    const config = loadConfigFromJson(json)
    expect(config.enabled).toBe(true)
    expect(config.keyFormat).toBe('camelCase')
    expect(config.storageKey).toBe('my_utm')
  })

  it('returns defaults for invalid JSON', () => {
    const config = loadConfigFromJson(null)
    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it('returns defaults for non-object', () => {
    expect(loadConfigFromJson('string')).toEqual(DEFAULT_CONFIG)
    expect(loadConfigFromJson(123)).toEqual(DEFAULT_CONFIG)
    expect(loadConfigFromJson([])).toEqual(DEFAULT_CONFIG)
  })

  it('handles partial JSON config', () => {
    const json = { keyFormat: 'camelCase' }
    const config = loadConfigFromJson(json)

    expect(config.keyFormat).toBe('camelCase')
    expect(config.enabled).toBe(true) // Default
  })
})

describe('validateConfig', () => {
  it('returns empty array for valid config', () => {
    const errors = validateConfig({
      enabled: true,
      keyFormat: 'snake_case',
      storageKey: 'utm_params',
      captureOnMount: true,
      appendToShares: true,
      allowedParameters: ['utm_source'],
      excludeFromShares: [],
      defaultParams: {},
      shareContextParams: {},
    })

    expect(errors).toEqual([])
  })

  it('returns empty array for empty object', () => {
    const errors = validateConfig({})
    expect(errors).toEqual([])
  })

  it('validates enabled is boolean', () => {
    const errors = validateConfig({ enabled: 'true' })
    expect(errors).toContain('enabled must be a boolean')
  })

  it('validates keyFormat values', () => {
    const errors = validateConfig({ keyFormat: 'invalid' })
    expect(errors).toContain('keyFormat must be "snake_case" or "camelCase"')
  })

  it('validates storageKey is string', () => {
    const errors = validateConfig({ storageKey: 123 })
    expect(errors).toContain('storageKey must be a string')
  })

  it('validates captureOnMount is boolean', () => {
    const errors = validateConfig({ captureOnMount: 'yes' })
    expect(errors).toContain('captureOnMount must be a boolean')
  })

  it('validates appendToShares is boolean', () => {
    const errors = validateConfig({ appendToShares: 1 })
    expect(errors).toContain('appendToShares must be a boolean')
  })

  it('validates allowedParameters is array of strings', () => {
    expect(validateConfig({ allowedParameters: 'not array' })).toContain(
      'allowedParameters must be an array',
    )
    expect(validateConfig({ allowedParameters: [1, 2, 3] })).toContain(
      'allowedParameters must contain only strings',
    )
  })

  it('validates excludeFromShares is array of strings', () => {
    expect(validateConfig({ excludeFromShares: {} })).toContain(
      'excludeFromShares must be an array',
    )
    expect(validateConfig({ excludeFromShares: [true, false] })).toContain(
      'excludeFromShares must contain only strings',
    )
  })

  it('validates defaultParams is object', () => {
    const errors = validateConfig({ defaultParams: 'not object' })
    expect(errors).toContain('defaultParams must be an object')
  })

  it('validates shareContextParams is object', () => {
    const errors = validateConfig({ shareContextParams: [] })
    expect(errors).toContain('shareContextParams must be an object')
  })

  it('returns error for non-object config', () => {
    expect(validateConfig(null)).toEqual(['Config must be a non-null object'])
    expect(validateConfig('string')).toEqual(['Config must be a non-null object'])
    expect(validateConfig([])).toEqual(['Config must be a non-null object'])
  })

  it('returns multiple errors', () => {
    const errors = validateConfig({
      enabled: 'yes',
      keyFormat: 'invalid',
      storageKey: 123,
    })

    expect(errors.length).toBe(3)
  })
})

describe('sanitize config', () => {
  it('createConfig includes sanitize defaults when not provided', () => {
    const config = createConfig()
    expect(config.sanitize).toEqual({
      enabled: false,
      stripHtml: true,
      stripControlChars: true,
      maxLength: 200,
    })
  })

  it('createConfig merges partial sanitize config with defaults', () => {
    const config = createConfig({
      sanitize: { enabled: true, maxLength: 100 },
    })
    expect(config.sanitize.enabled).toBe(true)
    expect(config.sanitize.maxLength).toBe(100)
    expect(config.sanitize.stripHtml).toBe(true) // default preserved
    expect(config.sanitize.stripControlChars).toBe(true) // default preserved
  })

  it('createConfig preserves customPattern when provided', () => {
    const pattern = /[!@#]/g
    const config = createConfig({
      sanitize: { enabled: true, customPattern: pattern },
    })
    expect(config.sanitize.customPattern).toBe(pattern)
  })

  it('mergeConfig merges sanitize overrides', () => {
    const base = getDefaultConfig()
    const merged = mergeConfig(base, {
      sanitize: { enabled: true },
    })
    expect(merged.sanitize.enabled).toBe(true)
    expect(merged.sanitize.stripHtml).toBe(true) // preserved from base
  })

  it('validateConfig validates sanitize.enabled is boolean', () => {
    const errors = validateConfig({ sanitize: { enabled: 'yes' } })
    expect(errors).toContain('sanitize.enabled must be a boolean')
  })

  it('validateConfig validates sanitize.stripHtml is boolean', () => {
    const errors = validateConfig({ sanitize: { stripHtml: 123 } })
    expect(errors).toContain('sanitize.stripHtml must be a boolean')
  })

  it('validateConfig validates sanitize.stripControlChars is boolean', () => {
    const errors = validateConfig({ sanitize: { stripControlChars: null } })
    expect(errors).toContain('sanitize.stripControlChars must be a boolean')
  })

  it('validateConfig validates sanitize.maxLength is number', () => {
    const errors = validateConfig({ sanitize: { maxLength: 'big' } })
    expect(errors).toContain('sanitize.maxLength must be a positive finite number')
  })

  it('validateConfig validates sanitize.maxLength is positive', () => {
    const errors = validateConfig({ sanitize: { maxLength: -1 } })
    expect(errors).toContain('sanitize.maxLength must be a positive finite number')
  })

  it('validateConfig rejects NaN as sanitize.maxLength', () => {
    const errors = validateConfig({ sanitize: { maxLength: NaN } })
    expect(errors).toContain('sanitize.maxLength must be a positive finite number')
  })

  it('validateConfig rejects Infinity as sanitize.maxLength', () => {
    const errors = validateConfig({ sanitize: { maxLength: Infinity } })
    expect(errors).toContain('sanitize.maxLength must be a positive finite number')
  })

  it('validateConfig validates sanitize.customPattern is a RegExp', () => {
    const errors = validateConfig({ sanitize: { customPattern: 'not a regex' } })
    expect(errors).toContain('sanitize.customPattern must be a RegExp')
  })

  it('validateConfig accepts valid customPattern RegExp', () => {
    const errors = validateConfig({ sanitize: { customPattern: /[!@#]/g } })
    expect(errors).toEqual([])
  })

  it('validateConfig validates sanitize is an object', () => {
    const errors = validateConfig({ sanitize: 'not an object' })
    expect(errors).toContain('sanitize must be an object')
  })

  it('validateConfig accepts valid sanitize config', () => {
    const errors = validateConfig({
      sanitize: { enabled: true, stripHtml: true, stripControlChars: true, maxLength: 100 },
    })
    expect(errors).toEqual([])
  })
})

describe('piiFiltering config', () => {
  it('createConfig includes default piiFiltering', () => {
    const config = createConfig()
    expect(config.piiFiltering).toBeDefined()
    expect(config.piiFiltering.enabled).toBe(false)
    expect(config.piiFiltering.mode).toBe('reject')
    expect(config.piiFiltering.patterns.length).toBeGreaterThan(0)
  })

  it('createConfig merges partial piiFiltering override', () => {
    const config = createConfig({ piiFiltering: { enabled: true } })
    expect(config.piiFiltering.enabled).toBe(true)
    expect(config.piiFiltering.mode).toBe('reject')
  })

  it('createConfig preserves custom patterns', () => {
    const customPatterns = [{ name: 'custom', pattern: /test/, enabled: true }]
    const config = createConfig({ piiFiltering: { patterns: customPatterns } })
    expect(config.piiFiltering.patterns).toEqual(customPatterns)
  })

  it('mergeConfig merges piiFiltering', () => {
    const base = createConfig()
    const merged = mergeConfig(base, { piiFiltering: { enabled: true, mode: 'redact' } })
    expect(merged.piiFiltering.enabled).toBe(true)
    expect(merged.piiFiltering.mode).toBe('redact')
    expect(merged.piiFiltering.patterns).toEqual(base.piiFiltering.patterns)
  })

  it('validateConfig validates piiFiltering.enabled is boolean', () => {
    const errors = validateConfig({ piiFiltering: { enabled: 'yes' } })
    expect(errors).toContain('piiFiltering.enabled must be a boolean')
  })

  it('validateConfig validates piiFiltering.mode is valid', () => {
    const errors = validateConfig({ piiFiltering: { mode: 'delete' } })
    expect(errors).toContain('piiFiltering.mode must be "reject" or "redact"')
  })

  it('validateConfig validates piiFiltering.patterns is an array', () => {
    const errors = validateConfig({ piiFiltering: { patterns: 'not an array' } })
    expect(errors).toContain('piiFiltering.patterns must be an array')
  })

  it('validateConfig validates piiFiltering is an object', () => {
    const errors = validateConfig({ piiFiltering: 'not an object' })
    expect(errors).toContain('piiFiltering must be an object')
  })

  it('validateConfig validates individual pattern objects', () => {
    const errors = validateConfig({
      piiFiltering: {
        patterns: [{ name: 123, pattern: 'not a regex', enabled: 'yes' }],
      },
    })
    expect(errors).toContain('piiFiltering.patterns[0].name must be a string')
    expect(errors).toContain('piiFiltering.patterns[0].pattern must be a RegExp')
    expect(errors).toContain('piiFiltering.patterns[0].enabled must be a boolean')
  })

  it('validateConfig validates non-object pattern entries', () => {
    const errors = validateConfig({
      piiFiltering: { patterns: ['not an object'] },
    })
    expect(errors).toContain('piiFiltering.patterns[0] must be an object')
  })

  it('validateConfig validates allowlistPattern is a RegExp', () => {
    const errors = validateConfig({
      piiFiltering: { allowlistPattern: 'not a regex' },
    })
    expect(errors).toContain('piiFiltering.allowlistPattern must be a RegExp')
  })

  it('validateConfig accepts valid allowlistPattern RegExp', () => {
    const errors = validateConfig({
      piiFiltering: { allowlistPattern: /^[a-z]+$/ },
    })
    expect(errors).toEqual([])
  })

  it('validateConfig validates onPiiDetected is a function', () => {
    const errors = validateConfig({
      piiFiltering: { onPiiDetected: 'not a function' },
    })
    expect(errors).toContain('piiFiltering.onPiiDetected must be a function')
  })

  it('validateConfig accepts valid onPiiDetected function', () => {
    const errors = validateConfig({
      piiFiltering: { onPiiDetected: () => {} },
    })
    expect(errors).toEqual([])
  })

  it('validateConfig accepts valid piiFiltering config', () => {
    const errors = validateConfig({
      piiFiltering: { enabled: true, mode: 'redact' },
    })
    expect(errors).toEqual([])
  })
})

describe('getDefaultConfig', () => {
  it('returns a copy of default config', () => {
    const config1 = getDefaultConfig()
    const config2 = getDefaultConfig()

    expect(config1).toEqual(config2)
    expect(config1).not.toBe(config2) // Different objects
  })

  it('returns config that can be modified without affecting defaults', () => {
    const config = getDefaultConfig()
    config.enabled = false
    config.allowedParameters.push('custom')

    const freshConfig = getDefaultConfig()
    expect(freshConfig.enabled).toBe(true)
    expect(freshConfig.allowedParameters).not.toContain('custom')
  })
})

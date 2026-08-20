import { describe, it, expect } from 'vitest'
import { normalizeUtmParams, normalizeUtmUrl } from '../../src/server/normalize'
import { STANDARD_UTM_PARAMETERS } from '../../src/config/defaults'

const EMAIL = 'someone@example.com'
const ALL_KEYS = [...STANDARD_UTM_PARAMETERS]

describe('normalizeUtmParams', () => {
  describe('totality', () => {
    it('returns every allowed key for a full input', () => {
      const { params } = normalizeUtmParams({ utm_source: 'linkedin' })
      expect(Object.keys(params).sort()).toEqual([...ALL_KEYS].sort())
    })

    it('returns every allowed key for an empty object', () => {
      const { params } = normalizeUtmParams({})
      expect(Object.keys(params).sort()).toEqual([...ALL_KEYS].sort())
    })

    it("defaults absent parameters to '' so a composite key groups", () => {
      const { params } = normalizeUtmParams({ utm_source: 'linkedin' })
      expect(params.utm_source).toBe('linkedin')
      expect(params.utm_medium).toBe('')
      expect(params.utm_campaign).toBe('')
      expect(params.utm_term).toBe('')
      expect(params.utm_content).toBe('')
      expect(params.utm_id).toBe('')
    })

    it('honours a custom absentValue', () => {
      const { params } = normalizeUtmParams({ utm_source: 'linkedin' }, { absentValue: '(none)' })
      expect(params.utm_source).toBe('linkedin')
      expect(params.utm_medium).toBe('(none)')
    })

    it('honours a narrowed allowedParameters list', () => {
      const { params } = normalizeUtmParams(
        { utm_source: 'linkedin', utm_id: 'abc' },
        { allowedParameters: ['utm_source', 'utm_medium'] },
      )
      expect(Object.keys(params).sort()).toEqual(['utm_medium', 'utm_source'])
    })

    it('never returns undefined for any allowed key', () => {
      const { params } = normalizeUtmParams(undefined)
      for (const key of ALL_KEYS) {
        expect(params[key]).toBeDefined()
        expect(typeof params[key]).toBe('string')
      }
    })
  })

  describe('hostile input never throws', () => {
    const hostile: Array<[string, unknown]> = [
      ['undefined', undefined],
      ['null', null],
      ['a number', 42],
      ['a string', 'utm_source=linkedin'],
      ['an array', []],
      ['a populated array', [1, 2, 3]],
      ['a nested array value', { utm_source: ['a', 'b'] }],
      ['a null value', { utm_source: null }],
      ['an undefined value', { utm_source: undefined }],
      ['an object value', { utm_source: { nested: true } }],
      ['a numeric value', { utm_source: 42 }],
      ['a boolean value', { utm_source: true }],
      ['a function value', { utm_source: () => 'x' }],
      ['a prototype-polluting key', JSON.parse('{"__proto__":{"polluted":true}}')],
      ['a constructor key', { constructor: 'x', utm_source: 'linkedin' }],
      ['a symbol-keyed object', { [Symbol('s')]: 'x', utm_source: 'linkedin' }],
    ]

    it.each(hostile)('does not throw on %s', (_name, input) => {
      expect(() => normalizeUtmParams(input)).not.toThrow()
    })

    it.each(hostile)('returns a total result for %s', (_name, input) => {
      const { params } = normalizeUtmParams(input)
      expect(Object.keys(params).sort()).toEqual([...ALL_KEYS].sort())
    })

    // JSON.parse cannot produce these, but "untrusted HTTP body" reaches this
    // function through custom content parsers, ORM entities and framework
    // reactive proxies too. The docblock promises any input, so it must mean it.
    describe('exotic objects', () => {
      it('does not throw on a throwing getter', () => {
        const body = {}
        Object.defineProperty(body, 'utm_source', {
          get() {
            throw new Error('hostile getter')
          },
          enumerable: true,
          configurable: true,
        })
        expect(() => normalizeUtmParams(body)).not.toThrow()
      })

      it('treats a throwing getter as absent', () => {
        const body = {}
        Object.defineProperty(body, 'utm_source', {
          get() {
            throw new Error('hostile getter')
          },
          enumerable: true,
          configurable: true,
        })
        const { params } = normalizeUtmParams(body)
        expect(params.utm_source).toBe('')
        expect(Object.keys(params).sort()).toEqual([...ALL_KEYS].sort())
      })

      it('does not throw on a proxy with a hostile trap', () => {
        const hostile = new Proxy(
          {},
          {
            getOwnPropertyDescriptor() {
              throw new Error('hostile trap')
            },
            get() {
              throw new Error('hostile trap')
            },
          },
        )
        expect(() => normalizeUtmParams(hostile)).not.toThrow()
      })

      it('does not throw on a revoked proxy', () => {
        const { proxy, revoke } = Proxy.revocable({}, {})
        revoke()
        expect(() => normalizeUtmParams(proxy)).not.toThrow()
      })

      it('returns a total result for a revoked proxy', () => {
        const { proxy, revoke } = Proxy.revocable({}, {})
        revoke()
        const { params } = normalizeUtmParams(proxy)
        expect(Object.keys(params).sort()).toEqual([...ALL_KEYS].sort())
      })
    })

    describe('malformed options', () => {
      it('does not throw when a PII pattern entry has no regex', () => {
        expect(() =>
          normalizeUtmParams(
            { utm_source: 'x' },
            { piiFiltering: { patterns: [{ name: 'broken', enabled: true } as unknown as never] } },
          ),
        ).not.toThrow()
      })

      it('does not throw when valuePattern is not a RegExp', () => {
        expect(() =>
          normalizeUtmParams({ utm_source: 'x' }, { valuePattern: 42 as unknown as RegExp }),
        ).not.toThrow()
      })

      it('stays total when a key fails to process', () => {
        const { params } = normalizeUtmParams(
          { utm_source: 'x' },
          { piiFiltering: { patterns: [{ name: 'broken', enabled: true } as unknown as never] } },
        )
        expect(Object.keys(params).sort()).toEqual([...ALL_KEYS].sort())
      })

      it.each([
        ['null', null],
        ['a number', 42],
        ['a string', 'utm_source'],
        ['an object', {}],
      ])('falls back to the standard keys when allowedParameters is %s', (_name, bad) => {
        const { params } = normalizeUtmParams(
          { utm_source: 'linkedin' },
          { allowedParameters: bad as unknown as string[] },
        )
        expect(Object.keys(params).sort()).toEqual([...ALL_KEYS].sort())
        expect(params.utm_source).toBe('linkedin')
      })

      it('ignores non-string entries inside allowedParameters', () => {
        const { params } = normalizeUtmParams(
          { utm_source: 'linkedin' },
          { allowedParameters: ['utm_source', 42 as unknown as string] },
        )
        expect(Object.keys(params)).toEqual(['utm_source'])
      })
    })

    it('does not pollute Object.prototype', () => {
      normalizeUtmParams(JSON.parse('{"__proto__":{"polluted":true}}'))
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('coerces a non-string value to absent rather than stringifying it', () => {
      // String(['a','b']) is 'a,b' — a value nobody sent.
      const { params } = normalizeUtmParams({ utm_source: ['a', 'b'] })
      expect(params.utm_source).toBe('')
    })

    it('reports a non-string value as rejected', () => {
      const { rejected } = normalizeUtmParams({ utm_source: ['a', 'b'] })
      expect(rejected).toEqual([{ key: 'utm_source', reason: 'notAString' }])
    })

    it('does not report a merely absent parameter as rejected', () => {
      const { rejected } = normalizeUtmParams({})
      expect(rejected).toEqual([])
    })
  })

  describe('folding', () => {
    it('folds case and trims whitespace by default', () => {
      const { params } = normalizeUtmParams({ utm_source: '  LinkedIn  ' })
      expect(params.utm_source).toBe('linkedin')
    })

    it('produces identical output for equivalent inputs', () => {
      const a = normalizeUtmParams({ utm_source: '  LinkedIn  ' })
      const b = normalizeUtmParams({ utm_source: 'linkedin' })
      expect(a.params).toEqual(b.params)
    })

    it('can have folding disabled', () => {
      const { params } = normalizeUtmParams({ utm_source: 'LinkedIn' }, { lowercase: false })
      expect(params.utm_source).toBe('LinkedIn')
    })
  })

  describe('server defaults differ from browser defaults, deliberately', () => {
    it('filters PII by default', () => {
      const { params, rejected } = normalizeUtmParams({ utm_source: EMAIL })
      expect(params.utm_source).toBe('')
      expect(rejected).toEqual([{ key: 'utm_source', reason: 'pii', patternName: 'email' }])
    })

    it('lowercases by default', () => {
      expect(normalizeUtmParams({ utm_source: 'LinkedIn' }).params.utm_source).toBe('linkedin')
    })

    it('drops rather than truncates an over-length value by default', () => {
      const { params, rejected } = normalizeUtmParams(
        { utm_source: 'a'.repeat(50) },
        { maxLength: 10 },
      )
      expect(params.utm_source).toBe('')
      expect(rejected).toEqual([{ key: 'utm_source', reason: 'maxLength' }])
    })

    it('can be told to truncate instead', () => {
      const { params } = normalizeUtmParams(
        { utm_source: 'a'.repeat(50) },
        { maxLength: 10, onMaxLength: 'truncate' },
      )
      expect(params.utm_source).toBe('a'.repeat(10))
    })

    it('applies a valuePattern gate when given one', () => {
      const { params, rejected } = normalizeUtmParams(
        { utm_source: 'has spaces' },
        { valuePattern: /^[a-z0-9_-]+$/ },
      )
      expect(params.utm_source).toBe('')
      expect(rejected).toEqual([{ key: 'utm_source', reason: 'valuePattern' }])
    })

    it('reports allowlist when piiFiltering.allowlistPattern rejects a value', () => {
      const { params, rejected } = normalizeUtmParams(
        { utm_source: 'has spaces' },
        { piiFiltering: { allowlistPattern: /^[a-z]+$/ } },
      )
      expect(params.utm_source).toBe('')
      expect(rejected).toEqual([{ key: 'utm_source', reason: 'allowlist' }])
    })

    it('can have PII filtering disabled', () => {
      const { params } = normalizeUtmParams(
        { utm_source: EMAIL },
        { piiFiltering: { enabled: false } },
      )
      expect(params.utm_source).toBe(EMAIL.toLowerCase())
    })
  })

  describe('rejection is per-parameter, not per-request', () => {
    it('keeps a good parameter while rejecting a bad sibling', () => {
      const { params, rejected } = normalizeUtmParams({
        utm_source: 'linkedin',
        utm_content: EMAIL,
      })
      expect(params.utm_source).toBe('linkedin')
      expect(params.utm_content).toBe('')
      expect(rejected).toHaveLength(1)
      expect(rejected[0].key).toBe('utm_content')
    })
  })

  describe('the result never carries a rejected value', () => {
    it('does not contain the email anywhere in the serialised result', () => {
      const result = normalizeUtmParams({ utm_content: EMAIL })
      const serialised = JSON.stringify(result)
      expect(serialised).not.toContain(EMAIL)
      expect(serialised).not.toContain('someone')
    })
  })

  describe('unknown keys', () => {
    it('ignores keys outside allowedParameters without reporting them', () => {
      const { params, rejected } = normalizeUtmParams({
        utm_source: 'linkedin',
        unrelated: 'x',
        utm_custom: 'y',
      })
      expect(params.utm_source).toBe('linkedin')
      expect(Object.keys(params)).not.toContain('unrelated')
      expect(Object.keys(params)).not.toContain('utm_custom')
      expect(rejected).toEqual([])
    })
  })
})

describe('normalizeUtmUrl', () => {
  it('extracts and normalizes from a URL', () => {
    const { params } = normalizeUtmUrl('https://example.com/?utm_source=LinkedIn&utm_medium=Social')
    expect(params.utm_source).toBe('linkedin')
    expect(params.utm_medium).toBe('social')
  })

  it('is total, like normalizeUtmParams', () => {
    const { params } = normalizeUtmUrl('https://example.com/')
    expect(Object.keys(params).sort()).toEqual([...ALL_KEYS].sort())
  })

  it('does not throw on a malformed URL', () => {
    expect(() => normalizeUtmUrl('not a url')).not.toThrow()
  })

  it('returns a total result for a malformed URL', () => {
    const { params } = normalizeUtmUrl('not a url')
    expect(Object.keys(params).sort()).toEqual([...ALL_KEYS].sort())
    expect(params.utm_source).toBe('')
  })

  it('does not throw on non-string input', () => {
    expect(() => normalizeUtmUrl(undefined as unknown as string)).not.toThrow()
    expect(() => normalizeUtmUrl(null as unknown as string)).not.toThrow()
    expect(() => normalizeUtmUrl(42 as unknown as string)).not.toThrow()
  })

  it('applies PII filtering like normalizeUtmParams', () => {
    const { params, rejected } = normalizeUtmUrl(
      `https://example.com/?utm_source=${encodeURIComponent(EMAIL)}`,
    )
    expect(params.utm_source).toBe('')
    expect(rejected[0].reason).toBe('pii')
  })

  it('last-wins on duplicate query parameters, matching URLSearchParams', () => {
    const { params } = normalizeUtmUrl('https://example.com/?utm_source=a&utm_source=b')
    expect(params.utm_source).toBe('b')
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { storeWithAttribution, getAttributedParams } from '../../src/inbound/attribution'
import { getStoredUtmParameters } from '../../src/common/storage'
import type { AttributionConfig } from '../../src/types'

describe('storeWithAttribution', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  describe('mode: last (default behavior)', () => {
    const config: AttributionConfig = {
      mode: 'last',
      firstTouchSuffix: '_first',
      lastTouchSuffix: '_last',
    }

    it('stores params to main key (same as current behavior)', () => {
      storeWithAttribution(
        { utm_source: 'google' },
        {
          attribution: config,
          storageKey: 'utm_parameters',
          storageType: 'session',
          keyFormat: 'snake_case',
        },
      )
      const stored = getStoredUtmParameters({
        storageKey: 'utm_parameters',
        keyFormat: 'snake_case',
      })
      expect(stored).toEqual({ utm_source: 'google' })
    })

    it('overwrites existing params on subsequent calls', () => {
      const opts = {
        attribution: config,
        storageKey: 'utm_parameters',
        storageType: 'session' as const,
        keyFormat: 'snake_case' as const,
      }
      storeWithAttribution({ utm_source: 'google' }, opts)
      storeWithAttribution({ utm_source: 'facebook' }, opts)
      const stored = getStoredUtmParameters({
        storageKey: 'utm_parameters',
        keyFormat: 'snake_case',
      })
      expect(stored).toEqual({ utm_source: 'facebook' })
    })

    it('does not write to first-touch or last-touch suffixed keys', () => {
      storeWithAttribution(
        { utm_source: 'google' },
        {
          attribution: config,
          storageKey: 'utm_parameters',
          storageType: 'session',
          keyFormat: 'snake_case',
        },
      )
      expect(getStoredUtmParameters({ storageKey: 'utm_parameters_first' })).toBeNull()
      expect(getStoredUtmParameters({ storageKey: 'utm_parameters_last' })).toBeNull()
    })
  })

  describe('mode: first', () => {
    const config: AttributionConfig = {
      mode: 'first',
      firstTouchSuffix: '_first',
      lastTouchSuffix: '_last',
    }

    it('writes to first-touch key on first visit', () => {
      storeWithAttribution(
        { utm_source: 'google' },
        {
          attribution: config,
          storageKey: 'utm_parameters',
          storageType: 'session',
          keyFormat: 'snake_case',
        },
      )
      const first = getStoredUtmParameters({
        storageKey: 'utm_parameters_first',
        keyFormat: 'snake_case',
      })
      expect(first).toEqual({ utm_source: 'google' })
    })

    it('does not overwrite first-touch on subsequent visits (write-once)', () => {
      const opts = {
        attribution: config,
        storageKey: 'utm_parameters',
        storageType: 'session' as const,
        keyFormat: 'snake_case' as const,
      }
      storeWithAttribution({ utm_source: 'google' }, opts)
      storeWithAttribution({ utm_source: 'facebook' }, opts)
      const first = getStoredUtmParameters({
        storageKey: 'utm_parameters_first',
        keyFormat: 'snake_case',
      })
      expect(first).toEqual({ utm_source: 'google' })
    })

    it('also writes to main key', () => {
      storeWithAttribution(
        { utm_source: 'google' },
        {
          attribution: config,
          storageKey: 'utm_parameters',
          storageType: 'session',
          keyFormat: 'snake_case',
        },
      )
      const main = getStoredUtmParameters({ storageKey: 'utm_parameters', keyFormat: 'snake_case' })
      expect(main).toEqual({ utm_source: 'google' })
    })
  })

  describe('mode: both', () => {
    const config: AttributionConfig = {
      mode: 'both',
      firstTouchSuffix: '_first',
      lastTouchSuffix: '_last',
    }

    it('writes to both first-touch and last-touch keys', () => {
      storeWithAttribution(
        { utm_source: 'google' },
        {
          attribution: config,
          storageKey: 'utm_parameters',
          storageType: 'session',
          keyFormat: 'snake_case',
        },
      )
      const first = getStoredUtmParameters({
        storageKey: 'utm_parameters_first',
        keyFormat: 'snake_case',
      })
      const last = getStoredUtmParameters({
        storageKey: 'utm_parameters_last',
        keyFormat: 'snake_case',
      })
      expect(first).toEqual({ utm_source: 'google' })
      expect(last).toEqual({ utm_source: 'google' })
    })

    it('first-touch is write-once, last-touch always updates', () => {
      const opts = {
        attribution: config,
        storageKey: 'utm_parameters',
        storageType: 'session' as const,
        keyFormat: 'snake_case' as const,
      }
      storeWithAttribution({ utm_source: 'google' }, opts)
      storeWithAttribution({ utm_source: 'facebook' }, opts)
      const first = getStoredUtmParameters({
        storageKey: 'utm_parameters_first',
        keyFormat: 'snake_case',
      })
      const last = getStoredUtmParameters({
        storageKey: 'utm_parameters_last',
        keyFormat: 'snake_case',
      })
      expect(first).toEqual({ utm_source: 'google' })
      expect(last).toEqual({ utm_source: 'facebook' })
    })

    it('also writes to main key (last-touch)', () => {
      const opts = {
        attribution: config,
        storageKey: 'utm_parameters',
        storageType: 'session' as const,
        keyFormat: 'snake_case' as const,
      }
      storeWithAttribution({ utm_source: 'google' }, opts)
      storeWithAttribution({ utm_source: 'facebook' }, opts)
      const main = getStoredUtmParameters({ storageKey: 'utm_parameters', keyFormat: 'snake_case' })
      expect(main).toEqual({ utm_source: 'facebook' })
    })
  })

  describe('custom suffixes', () => {
    it('uses custom first and last touch suffixes', () => {
      const config: AttributionConfig = {
        mode: 'both',
        firstTouchSuffix: '.ft',
        lastTouchSuffix: '.lt',
      }
      storeWithAttribution(
        { utm_source: 'google' },
        { attribution: config, storageKey: 'utm', storageType: 'session', keyFormat: 'snake_case' },
      )
      expect(getStoredUtmParameters({ storageKey: 'utm.ft', keyFormat: 'snake_case' })).toEqual({
        utm_source: 'google',
      })
      expect(getStoredUtmParameters({ storageKey: 'utm.lt', keyFormat: 'snake_case' })).toEqual({
        utm_source: 'google',
      })
    })
  })

  describe('onStore callback', () => {
    it('fires with touch type for first mode', () => {
      const onStore = vi.fn()
      storeWithAttribution(
        { utm_source: 'google' },
        {
          attribution: { mode: 'first', firstTouchSuffix: '_first', lastTouchSuffix: '_last' },
          storageKey: 'utm_parameters',
          storageType: 'session',
          keyFormat: 'snake_case',
          onStore,
        },
      )
      expect(onStore).toHaveBeenCalledWith(
        { utm_source: 'google' },
        { storageType: 'session', touch: 'first' },
      )
    })

    it('fires with touch type for both mode', () => {
      const onStore = vi.fn()
      storeWithAttribution(
        { utm_source: 'google' },
        {
          attribution: { mode: 'both', firstTouchSuffix: '_first', lastTouchSuffix: '_last' },
          storageKey: 'utm_parameters',
          storageType: 'session',
          keyFormat: 'snake_case',
          onStore,
        },
      )
      // Should fire twice - once for first, once for last
      expect(onStore).toHaveBeenCalledTimes(2)
      expect(onStore).toHaveBeenCalledWith(
        { utm_source: 'google' },
        { storageType: 'session', touch: 'first' },
      )
      expect(onStore).toHaveBeenCalledWith(
        { utm_source: 'google' },
        { storageType: 'session', touch: 'last' },
      )
    })
  })
})

describe('getAttributedParams', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('returns main key params with no touch specified (default last mode)', () => {
    const config: AttributionConfig = {
      mode: 'last',
      firstTouchSuffix: '_first',
      lastTouchSuffix: '_last',
    }
    storeWithAttribution(
      { utm_source: 'google' },
      {
        attribution: config,
        storageKey: 'utm_parameters',
        storageType: 'session',
        keyFormat: 'snake_case',
      },
    )
    const result = getAttributedParams({
      attribution: config,
      storageKey: 'utm_parameters',
      storageType: 'session',
      keyFormat: 'snake_case',
    })
    expect(result).toEqual({ utm_source: 'google' })
  })

  it('returns first-touch params when touch=first', () => {
    const config: AttributionConfig = {
      mode: 'both',
      firstTouchSuffix: '_first',
      lastTouchSuffix: '_last',
    }
    const opts = {
      attribution: config,
      storageKey: 'utm_parameters',
      storageType: 'session' as const,
      keyFormat: 'snake_case' as const,
    }
    storeWithAttribution({ utm_source: 'google' }, opts)
    storeWithAttribution({ utm_source: 'facebook' }, opts)
    const result = getAttributedParams({ ...opts, touch: 'first' })
    expect(result).toEqual({ utm_source: 'google' })
  })

  it('returns last-touch params when touch=last', () => {
    const config: AttributionConfig = {
      mode: 'both',
      firstTouchSuffix: '_first',
      lastTouchSuffix: '_last',
    }
    const opts = {
      attribution: config,
      storageKey: 'utm_parameters',
      storageType: 'session' as const,
      keyFormat: 'snake_case' as const,
    }
    storeWithAttribution({ utm_source: 'google' }, opts)
    storeWithAttribution({ utm_source: 'facebook' }, opts)
    const result = getAttributedParams({ ...opts, touch: 'last' })
    expect(result).toEqual({ utm_source: 'facebook' })
  })

  it('defaults to first-touch when mode is first', () => {
    const config: AttributionConfig = {
      mode: 'first',
      firstTouchSuffix: '_first',
      lastTouchSuffix: '_last',
    }
    storeWithAttribution(
      { utm_source: 'google' },
      {
        attribution: config,
        storageKey: 'utm_parameters',
        storageType: 'session',
        keyFormat: 'snake_case',
      },
    )
    const result = getAttributedParams({
      attribution: config,
      storageKey: 'utm_parameters',
      storageType: 'session',
      keyFormat: 'snake_case',
    })
    expect(result).toEqual({ utm_source: 'google' })
  })

  it('defaults to last-touch when mode is both', () => {
    const config: AttributionConfig = {
      mode: 'both',
      firstTouchSuffix: '_first',
      lastTouchSuffix: '_last',
    }
    const opts = {
      attribution: config,
      storageKey: 'utm_parameters',
      storageType: 'session' as const,
      keyFormat: 'snake_case' as const,
    }
    storeWithAttribution({ utm_source: 'google' }, opts)
    storeWithAttribution({ utm_source: 'facebook' }, opts)
    const result = getAttributedParams(opts)
    expect(result).toEqual({ utm_source: 'facebook' })
  })
})

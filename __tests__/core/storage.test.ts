import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  storeUtmParameters,
  getStoredUtmParameters,
  clearStoredUtmParameters,
  hasStoredUtmParameters,
  isSessionStorageAvailable,
  isLocalStorageAvailable,
  isStorageAvailable,
  getRawStoredValue,
  DEFAULT_STORAGE_KEY,
} from '../../src/core/storage'

describe('storeUtmParameters', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('stores UTM parameters in sessionStorage', () => {
    storeUtmParameters({ utm_source: 'test', utm_campaign: 'sale' })

    const stored = sessionStorage.getItem(DEFAULT_STORAGE_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.params).toEqual({ utm_source: 'test', utm_campaign: 'sale' })
    expect(parsed).toHaveProperty('iat')
    expect(parsed).toHaveProperty('eat')
  })

  it('uses default storage key', () => {
    storeUtmParameters({ utm_source: 'test' })
    expect(sessionStorage.getItem(DEFAULT_STORAGE_KEY)).not.toBeNull()
  })

  it('uses custom storage key when provided', () => {
    storeUtmParameters({ utm_source: 'test' }, { storageKey: 'custom_key' })

    expect(sessionStorage.getItem('custom_key')).not.toBeNull()
    expect(sessionStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull()
  })

  it('skips storing empty objects', () => {
    storeUtmParameters({})
    expect(sessionStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull()
  })

  it('converts to specified key format before storing', () => {
    storeUtmParameters({ utmSource: 'test', utmCampaign: 'sale' }, { keyFormat: 'snake_case' })

    const stored = sessionStorage.getItem(DEFAULT_STORAGE_KEY)
    const parsed = JSON.parse(stored!)
    expect(parsed.params).toEqual({ utm_source: 'test', utm_campaign: 'sale' })
  })

  it('stores in camelCase when specified', () => {
    storeUtmParameters({ utm_source: 'test' }, { keyFormat: 'camelCase' })

    const stored = sessionStorage.getItem(DEFAULT_STORAGE_KEY)
    const parsed = JSON.parse(stored!)
    expect(parsed.params).toEqual({ utmSource: 'test' })
  })

  it('fails silently on storage error', () => {
    // Mock sessionStorage to throw
    vi.spyOn(sessionStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceeded')
    })

    // Should not throw
    expect(() => {
      storeUtmParameters({ utm_source: 'test' })
    }).not.toThrow()
  })
})

describe('getStoredUtmParameters', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('retrieves stored UTM parameters', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}')

    const result = getStoredUtmParameters()
    expect(result).toEqual({ utm_source: 'test' })
  })

  it('returns null when no data stored', () => {
    const result = getStoredUtmParameters()
    expect(result).toBeNull()
  })

  it('uses custom storage key when provided', () => {
    sessionStorage.setItem('custom_key', '{"utm_source":"custom"}')

    const result = getStoredUtmParameters({ storageKey: 'custom_key' })
    expect(result).toEqual({ utm_source: 'custom' })
  })

  it('converts to specified key format', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}')

    const result = getStoredUtmParameters({ keyFormat: 'camelCase' })
    expect(result).toEqual({ utmSource: 'test' })
  })

  it('returns null for invalid JSON', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, 'not valid json')

    const result = getStoredUtmParameters()
    expect(result).toBeNull()
  })

  it('returns null for non-object values', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '"string"')
    expect(getStoredUtmParameters()).toBeNull()

    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '123')
    expect(getStoredUtmParameters()).toBeNull()

    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '[]')
    expect(getStoredUtmParameters()).toBeNull()

    sessionStorage.setItem(DEFAULT_STORAGE_KEY, 'null')
    expect(getStoredUtmParameters()).toBeNull()
  })

  it('returns null for objects with non-UTM keys', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"invalid_key":"value"}')
    expect(getStoredUtmParameters()).toBeNull()
  })

  it('returns null for objects with non-string values', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":123}')
    expect(getStoredUtmParameters()).toBeNull()
  })

  it('accepts valid objects with undefined values', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}')
    const result = getStoredUtmParameters()
    expect(result).toEqual({ utm_source: 'test' })
  })
})

describe('clearStoredUtmParameters', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('removes stored UTM parameters', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}')
    clearStoredUtmParameters()
    expect(sessionStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull()
  })

  it('uses custom storage key when provided', () => {
    sessionStorage.setItem('custom_key', '{"utm_source":"test"}')
    clearStoredUtmParameters('custom_key')
    expect(sessionStorage.getItem('custom_key')).toBeNull()
  })

  it('does nothing if no data stored', () => {
    expect(() => clearStoredUtmParameters()).not.toThrow()
  })

  it('fails silently on storage error', () => {
    vi.spyOn(sessionStorage, 'removeItem').mockImplementationOnce(() => {
      throw new Error('Access denied')
    })

    expect(() => clearStoredUtmParameters()).not.toThrow()
  })
})

describe('hasStoredUtmParameters', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('returns true when valid UTM params stored', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}')
    expect(hasStoredUtmParameters()).toBe(true)
  })

  it('returns false when no data stored', () => {
    expect(hasStoredUtmParameters()).toBe(false)
  })

  it('returns false for empty object', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{}')
    expect(hasStoredUtmParameters()).toBe(false)
  })

  it('returns false for invalid data', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, 'invalid')
    expect(hasStoredUtmParameters()).toBe(false)
  })

  it('uses custom storage key', () => {
    sessionStorage.setItem('custom_key', '{"utm_source":"test"}')
    expect(hasStoredUtmParameters('custom_key')).toBe(true)
    expect(hasStoredUtmParameters()).toBe(false)
  })
})

describe('isSessionStorageAvailable', () => {
  it('returns true when sessionStorage is available', () => {
    expect(isSessionStorageAvailable()).toBe(true)
  })
})

describe('getRawStoredValue', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('returns raw stored value', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}')
    expect(getRawStoredValue()).toBe('{"utm_source":"test"}')
  })

  it('returns null when no value stored', () => {
    expect(getRawStoredValue()).toBeNull()
  })

  it('uses custom storage key', () => {
    sessionStorage.setItem('custom_key', 'custom_value')
    expect(getRawStoredValue('custom_key')).toBe('custom_value')
  })
})

describe('integration: store and retrieve', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('round-trips UTM parameters correctly', () => {
    const original = { utm_source: 'test', utm_medium: 'email', utm_campaign: 'sale' }

    storeUtmParameters(original)
    const retrieved = getStoredUtmParameters()

    expect(retrieved).toEqual(original)
  })

  it('round-trips with key format conversion', () => {
    const original = { utmSource: 'test', utmMedium: 'email' }

    // Store as camelCase
    storeUtmParameters(original, { keyFormat: 'camelCase' })

    // Retrieve as camelCase
    const retrievedCamel = getStoredUtmParameters({ keyFormat: 'camelCase' })
    expect(retrievedCamel).toEqual(original)

    // Retrieve as snake_case
    const retrievedSnake = getStoredUtmParameters({ keyFormat: 'snake_case' })
    expect(retrievedSnake).toEqual({ utm_source: 'test', utm_medium: 'email' })
  })
})

describe('localStorage backend', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('stores UTM parameters in localStorage when storageType is local', () => {
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local' })

    const stored = localStorage.getItem(DEFAULT_STORAGE_KEY)
    expect(stored).not.toBeNull()
    expect(sessionStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull()
  })

  it('retrieves UTM parameters from localStorage', () => {
    storeUtmParameters({ utm_source: 'test', utm_campaign: 'sale' }, { storageType: 'local' })

    const result = getStoredUtmParameters({ storageType: 'local' })
    expect(result).toEqual({ utm_source: 'test', utm_campaign: 'sale' })
  })

  it('clears UTM parameters from localStorage', () => {
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local' })
    clearStoredUtmParameters(DEFAULT_STORAGE_KEY, 'local')

    expect(localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull()
  })

  it('hasStoredUtmParameters checks localStorage', () => {
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local' })
    expect(hasStoredUtmParameters(DEFAULT_STORAGE_KEY, 'local')).toBe(true)
    expect(hasStoredUtmParameters(DEFAULT_STORAGE_KEY)).toBe(false)
  })

  it('getRawStoredValue reads from localStorage', () => {
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local' })
    const raw = getRawStoredValue(DEFAULT_STORAGE_KEY, 'local')
    expect(raw).not.toBeNull()
  })

  it('round-trips with key format conversion via localStorage', () => {
    storeUtmParameters({ utmSource: 'test' }, { storageType: 'local', keyFormat: 'camelCase' })

    const result = getStoredUtmParameters({ storageType: 'local', keyFormat: 'camelCase' })
    expect(result).toEqual({ utmSource: 'test' })
  })

  it('defaults to sessionStorage when storageType not specified', () => {
    storeUtmParameters({ utm_source: 'test' })

    expect(sessionStorage.getItem(DEFAULT_STORAGE_KEY)).not.toBeNull()
    expect(localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull()
  })
})

describe('envelope format', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('stores data in envelope format with iat and eat fields', () => {
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local' })

    const raw = localStorage.getItem(DEFAULT_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveProperty('params')
    expect(parsed).toHaveProperty('iat')
    expect(parsed.params).toEqual({ utm_source: 'test' })
    expect(typeof parsed.iat).toBe('number')
  })

  it('stores envelope with eat: null when no TTL', () => {
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local' })

    const raw = localStorage.getItem(DEFAULT_STORAGE_KEY)
    const parsed = JSON.parse(raw!)
    expect(parsed.eat).toBeNull()
  })

  it('stores envelope with calculated eat when TTL is provided', () => {
    const ttl = 3600000 // 1 hour
    const before = Date.now()
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local', ttl })

    const raw = localStorage.getItem(DEFAULT_STORAGE_KEY)
    const parsed = JSON.parse(raw!)
    expect(parsed.eat).toBeGreaterThanOrEqual(before + ttl)
    expect(parsed.eat).toBeLessThanOrEqual(Date.now() + ttl)
  })

  it('stores sessionStorage data in envelope format too', () => {
    storeUtmParameters({ utm_source: 'test' })

    const raw = sessionStorage.getItem(DEFAULT_STORAGE_KEY)
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveProperty('params')
    expect(parsed).toHaveProperty('iat')
    expect(parsed.eat).toBeNull()
    expect(parsed.params).toEqual({ utm_source: 'test' })
  })
})

describe('TTL expiration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns params when TTL has not expired', () => {
    const ttl = 3600000 // 1 hour
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local', ttl })

    // Advance 30 minutes (not expired)
    vi.advanceTimersByTime(1800000)

    const result = getStoredUtmParameters({ storageType: 'local' })
    expect(result).toEqual({ utm_source: 'test' })
  })

  it('returns null when TTL has expired', () => {
    const ttl = 3600000 // 1 hour
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local', ttl })

    // Advance past TTL
    vi.advanceTimersByTime(3600001)

    const result = getStoredUtmParameters({ storageType: 'local' })
    expect(result).toBeNull()
  })

  it('auto-clears storage when TTL has expired', () => {
    const ttl = 3600000 // 1 hour
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local', ttl })

    // Advance past TTL
    vi.advanceTimersByTime(3600001)

    // Read triggers auto-clear
    getStoredUtmParameters({ storageType: 'local' })
    expect(localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull()
  })

  it('returns params indefinitely when no TTL (eat is null)', () => {
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local' })

    // Advance a very long time
    vi.advanceTimersByTime(365 * 24 * 3600000)

    const result = getStoredUtmParameters({ storageType: 'local' })
    expect(result).toEqual({ utm_source: 'test' })
  })

  it('hasStoredUtmParameters returns false when TTL expired', () => {
    const ttl = 60000 // 1 minute
    storeUtmParameters({ utm_source: 'test' }, { storageType: 'local', ttl })

    vi.advanceTimersByTime(60001)

    expect(hasStoredUtmParameters(DEFAULT_STORAGE_KEY, 'local')).toBe(false)
  })

  it('TTL is ignored for sessionStorage (eat is always null)', () => {
    storeUtmParameters({ utm_source: 'test' }, { ttl: 1000 })

    const raw = sessionStorage.getItem(DEFAULT_STORAGE_KEY)
    const parsed = JSON.parse(raw!)
    expect(parsed.eat).toBeNull()
  })
})

describe('backward compatibility: flat format', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('reads flat format from sessionStorage (pre-envelope data)', () => {
    // Simulate data stored by old version (flat format, no envelope)
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"old_data"}')

    const result = getStoredUtmParameters()
    expect(result).toEqual({ utm_source: 'old_data' })
  })

  it('reads flat format from localStorage (pre-envelope data)', () => {
    localStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"old_data"}')

    const result = getStoredUtmParameters({ storageType: 'local' })
    expect(result).toEqual({ utm_source: 'old_data' })
  })

  it('flat format data has no TTL expiration', () => {
    vi.useFakeTimers()
    localStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"old_data"}')

    vi.advanceTimersByTime(365 * 24 * 3600000)

    const result = getStoredUtmParameters({ storageType: 'local' })
    expect(result).toEqual({ utm_source: 'old_data' })
    vi.useRealTimers()
  })
})

describe('isStorageAvailable', () => {
  it('returns true for session storage when available', () => {
    expect(isStorageAvailable('session')).toBe(true)
  })

  it('returns true for local storage when available', () => {
    expect(isStorageAvailable('local')).toBe(true)
  })

  it('defaults to session storage when no type specified', () => {
    expect(isStorageAvailable()).toBe(true)
  })
})

describe('isLocalStorageAvailable', () => {
  it('returns true when localStorage is available', () => {
    expect(isLocalStorageAvailable()).toBe(true)
  })
})

describe('isSessionStorageAvailable (deprecated)', () => {
  it('still works but calls isStorageAvailable internally', () => {
    expect(isSessionStorageAvailable()).toBe(true)
  })
})

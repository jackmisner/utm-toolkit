import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  storeUtmParameters,
  getStoredUtmParameters,
  clearStoredUtmParameters,
  hasStoredUtmParameters,
  isSessionStorageAvailable,
  getRawStoredValue,
  DEFAULT_STORAGE_KEY,
} from '../../src/core/storage';

describe('storeUtmParameters', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores UTM parameters in sessionStorage', () => {
    storeUtmParameters({ utm_source: 'test', utm_campaign: 'sale' });

    const stored = sessionStorage.getItem(DEFAULT_STORAGE_KEY);
    expect(stored).toBe('{"utm_source":"test","utm_campaign":"sale"}');
  });

  it('uses default storage key', () => {
    storeUtmParameters({ utm_source: 'test' });
    expect(sessionStorage.getItem(DEFAULT_STORAGE_KEY)).not.toBeNull();
  });

  it('uses custom storage key when provided', () => {
    storeUtmParameters({ utm_source: 'test' }, { storageKey: 'custom_key' });

    expect(sessionStorage.getItem('custom_key')).not.toBeNull();
    expect(sessionStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
  });

  it('skips storing empty objects', () => {
    storeUtmParameters({});
    expect(sessionStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
  });

  it('converts to specified key format before storing', () => {
    storeUtmParameters(
      { utmSource: 'test', utmCampaign: 'sale' },
      { keyFormat: 'snake_case' }
    );

    const stored = sessionStorage.getItem(DEFAULT_STORAGE_KEY);
    expect(stored).toBe('{"utm_source":"test","utm_campaign":"sale"}');
  });

  it('stores in camelCase when specified', () => {
    storeUtmParameters(
      { utm_source: 'test' },
      { keyFormat: 'camelCase' }
    );

    const stored = sessionStorage.getItem(DEFAULT_STORAGE_KEY);
    expect(stored).toBe('{"utmSource":"test"}');
  });

  it('fails silently on storage error', () => {
    // Mock sessionStorage to throw
    vi.spyOn(sessionStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceeded');
    });

    // Should not throw
    expect(() => {
      storeUtmParameters({ utm_source: 'test' });
    }).not.toThrow();
  });
});

describe('getStoredUtmParameters', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('retrieves stored UTM parameters', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}');

    const result = getStoredUtmParameters();
    expect(result).toEqual({ utm_source: 'test' });
  });

  it('returns null when no data stored', () => {
    const result = getStoredUtmParameters();
    expect(result).toBeNull();
  });

  it('uses custom storage key when provided', () => {
    sessionStorage.setItem('custom_key', '{"utm_source":"custom"}');

    const result = getStoredUtmParameters({ storageKey: 'custom_key' });
    expect(result).toEqual({ utm_source: 'custom' });
  });

  it('converts to specified key format', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}');

    const result = getStoredUtmParameters({ keyFormat: 'camelCase' });
    expect(result).toEqual({ utmSource: 'test' });
  });

  it('returns null for invalid JSON', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, 'not valid json');

    const result = getStoredUtmParameters();
    expect(result).toBeNull();
  });

  it('returns null for non-object values', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '"string"');
    expect(getStoredUtmParameters()).toBeNull();

    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '123');
    expect(getStoredUtmParameters()).toBeNull();

    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '[]');
    expect(getStoredUtmParameters()).toBeNull();

    sessionStorage.setItem(DEFAULT_STORAGE_KEY, 'null');
    expect(getStoredUtmParameters()).toBeNull();
  });

  it('returns null for objects with non-UTM keys', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"invalid_key":"value"}');
    expect(getStoredUtmParameters()).toBeNull();
  });

  it('returns null for objects with non-string values', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":123}');
    expect(getStoredUtmParameters()).toBeNull();
  });

  it('accepts valid objects with undefined values', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}');
    const result = getStoredUtmParameters();
    expect(result).toEqual({ utm_source: 'test' });
  });
});

describe('clearStoredUtmParameters', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('removes stored UTM parameters', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}');
    clearStoredUtmParameters();
    expect(sessionStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
  });

  it('uses custom storage key when provided', () => {
    sessionStorage.setItem('custom_key', '{"utm_source":"test"}');
    clearStoredUtmParameters('custom_key');
    expect(sessionStorage.getItem('custom_key')).toBeNull();
  });

  it('does nothing if no data stored', () => {
    expect(() => clearStoredUtmParameters()).not.toThrow();
  });

  it('fails silently on storage error', () => {
    vi.spyOn(sessionStorage, 'removeItem').mockImplementationOnce(() => {
      throw new Error('Access denied');
    });

    expect(() => clearStoredUtmParameters()).not.toThrow();
  });
});

describe('hasStoredUtmParameters', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns true when valid UTM params stored', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}');
    expect(hasStoredUtmParameters()).toBe(true);
  });

  it('returns false when no data stored', () => {
    expect(hasStoredUtmParameters()).toBe(false);
  });

  it('returns false for empty object', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{}');
    expect(hasStoredUtmParameters()).toBe(false);
  });

  it('returns false for invalid data', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, 'invalid');
    expect(hasStoredUtmParameters()).toBe(false);
  });

  it('uses custom storage key', () => {
    sessionStorage.setItem('custom_key', '{"utm_source":"test"}');
    expect(hasStoredUtmParameters('custom_key')).toBe(true);
    expect(hasStoredUtmParameters()).toBe(false);
  });
});

describe('isSessionStorageAvailable', () => {
  it('returns true when sessionStorage is available', () => {
    expect(isSessionStorageAvailable()).toBe(true);
  });
});

describe('getRawStoredValue', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns raw stored value', () => {
    sessionStorage.setItem(DEFAULT_STORAGE_KEY, '{"utm_source":"test"}');
    expect(getRawStoredValue()).toBe('{"utm_source":"test"}');
  });

  it('returns null when no value stored', () => {
    expect(getRawStoredValue()).toBeNull();
  });

  it('uses custom storage key', () => {
    sessionStorage.setItem('custom_key', 'custom_value');
    expect(getRawStoredValue('custom_key')).toBe('custom_value');
  });
});

describe('integration: store and retrieve', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips UTM parameters correctly', () => {
    const original = { utm_source: 'test', utm_medium: 'email', utm_campaign: 'sale' };

    storeUtmParameters(original);
    const retrieved = getStoredUtmParameters();

    expect(retrieved).toEqual(original);
  });

  it('round-trips with key format conversion', () => {
    const original = { utmSource: 'test', utmMedium: 'email' };

    // Store as camelCase
    storeUtmParameters(original, { keyFormat: 'camelCase' });

    // Retrieve as camelCase
    const retrievedCamel = getStoredUtmParameters({ keyFormat: 'camelCase' });
    expect(retrievedCamel).toEqual(original);

    // Retrieve as snake_case
    const retrievedSnake = getStoredUtmParameters({ keyFormat: 'snake_case' });
    expect(retrievedSnake).toEqual({ utm_source: 'test', utm_medium: 'email' });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUtmTracking } from '../../src/react/useUtmTracking';

describe('useUtmTracking', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', {
      href: 'https://example.com',
      search: '',
    });
  });

  describe('initialization', () => {
    it('returns expected shape', () => {
      const { result } = renderHook(() => useUtmTracking());

      expect(result.current).toHaveProperty('utmParameters');
      expect(result.current).toHaveProperty('isEnabled');
      expect(result.current).toHaveProperty('hasParams');
      expect(result.current).toHaveProperty('capture');
      expect(result.current).toHaveProperty('clear');
      expect(result.current).toHaveProperty('appendToUrl');
    });

    it('is enabled by default', () => {
      const { result } = renderHook(() => useUtmTracking());
      expect(result.current.isEnabled).toBe(true);
    });

    it('can be disabled via config', () => {
      const { result } = renderHook(() =>
        useUtmTracking({ config: { enabled: false } })
      );
      expect(result.current.isEnabled).toBe(false);
    });

    it('initializes with null params when storage is empty', () => {
      const { result } = renderHook(() => useUtmTracking());
      expect(result.current.utmParameters).toBeNull();
      expect(result.current.hasParams).toBe(false);
    });

    it('initializes with stored params if available', () => {
      sessionStorage.setItem('utm_parameters', '{"utm_source":"stored"}');

      const { result } = renderHook(() => useUtmTracking());
      expect(result.current.utmParameters).toEqual({ utm_source: 'stored' });
      expect(result.current.hasParams).toBe(true);
    });

    it('uses custom storage key', () => {
      sessionStorage.setItem('custom_key', '{"utm_source":"custom"}');

      const { result } = renderHook(() =>
        useUtmTracking({ config: { storageKey: 'custom_key' } })
      );
      expect(result.current.utmParameters).toEqual({ utm_source: 'custom' });
    });
  });

  describe('capture', () => {
    it('captures UTM params from URL', () => {
      vi.stubGlobal('location', {
        href: 'https://example.com?utm_source=test&utm_campaign=sale',
        search: '?utm_source=test&utm_campaign=sale',
      });

      const { result } = renderHook(() =>
        useUtmTracking({ config: { captureOnMount: false } })
      );

      act(() => {
        result.current.capture();
      });

      expect(result.current.utmParameters).toEqual({
        utm_source: 'test',
        utm_campaign: 'sale',
      });
      expect(result.current.hasParams).toBe(true);
    });

    it('stores captured params in sessionStorage', () => {
      vi.stubGlobal('location', {
        href: 'https://example.com?utm_source=captured',
        search: '?utm_source=captured',
      });

      const { result } = renderHook(() =>
        useUtmTracking({ config: { captureOnMount: false } })
      );

      act(() => {
        result.current.capture();
      });

      const stored = sessionStorage.getItem('utm_parameters');
      expect(stored).toBe('{"utm_source":"captured"}');
    });

    it('uses default params when no UTM params in URL', () => {
      const { result } = renderHook(() =>
        useUtmTracking({
          config: {
            captureOnMount: false,
            defaultParams: { utm_source: 'default' },
          },
        })
      );

      act(() => {
        result.current.capture();
      });

      expect(result.current.utmParameters).toEqual({ utm_source: 'default' });
    });

    it('does nothing when disabled', () => {
      vi.stubGlobal('location', {
        href: 'https://example.com?utm_source=test',
        search: '?utm_source=test',
      });

      const { result } = renderHook(() =>
        useUtmTracking({ config: { enabled: false, captureOnMount: false } })
      );

      act(() => {
        result.current.capture();
      });

      expect(result.current.utmParameters).toBeNull();
    });

    it('respects allowedParameters filter', () => {
      vi.stubGlobal('location', {
        href: 'https://example.com?utm_source=test&utm_campaign=sale&utm_term=keyword',
        search: '?utm_source=test&utm_campaign=sale&utm_term=keyword',
      });

      const { result } = renderHook(() =>
        useUtmTracking({
          config: {
            captureOnMount: false,
            allowedParameters: ['utm_source', 'utm_campaign'],
          },
        })
      );

      act(() => {
        result.current.capture();
      });

      expect(result.current.utmParameters).toEqual({
        utm_source: 'test',
        utm_campaign: 'sale',
      });
    });
  });

  describe('auto-capture on mount', () => {
    it('captures on mount when captureOnMount is true', () => {
      vi.stubGlobal('location', {
        href: 'https://example.com?utm_source=auto',
        search: '?utm_source=auto',
      });

      const { result } = renderHook(() =>
        useUtmTracking({ config: { captureOnMount: true } })
      );

      // Allow useEffect to run
      expect(result.current.utmParameters).toEqual({ utm_source: 'auto' });
    });

    it('does not capture on mount when captureOnMount is false', () => {
      vi.stubGlobal('location', {
        href: 'https://example.com?utm_source=should_not_capture',
        search: '?utm_source=should_not_capture',
      });

      const { result } = renderHook(() =>
        useUtmTracking({ config: { captureOnMount: false } })
      );

      expect(result.current.utmParameters).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears stored params', () => {
      sessionStorage.setItem('utm_parameters', '{"utm_source":"test"}');

      const { result } = renderHook(() => useUtmTracking());

      expect(result.current.utmParameters).toEqual({ utm_source: 'test' });

      act(() => {
        result.current.clear();
      });

      expect(result.current.utmParameters).toBeNull();
      expect(result.current.hasParams).toBe(false);
      expect(sessionStorage.getItem('utm_parameters')).toBeNull();
    });
  });

  describe('appendToUrl', () => {
    it('appends stored params to URL', () => {
      sessionStorage.setItem('utm_parameters', '{"utm_source":"test"}');

      const { result } = renderHook(() => useUtmTracking());

      const url = result.current.appendToUrl('https://example.com/share');
      expect(url).toBe('https://example.com/share?utm_source=test');
    });

    it('returns original URL when no params', () => {
      const { result } = renderHook(() => useUtmTracking());

      const url = result.current.appendToUrl('https://example.com/share');
      expect(url).toBe('https://example.com/share');
    });

    it('returns original URL when disabled', () => {
      sessionStorage.setItem('utm_parameters', '{"utm_source":"test"}');

      const { result } = renderHook(() =>
        useUtmTracking({ config: { enabled: false } })
      );

      const url = result.current.appendToUrl('https://example.com/share');
      expect(url).toBe('https://example.com/share');
    });

    it('returns original URL when appendToShares is false', () => {
      sessionStorage.setItem('utm_parameters', '{"utm_source":"test"}');

      const { result } = renderHook(() =>
        useUtmTracking({ config: { appendToShares: false } })
      );

      const url = result.current.appendToUrl('https://example.com/share');
      expect(url).toBe('https://example.com/share');
    });

    it('applies default share context params', () => {
      sessionStorage.setItem('utm_parameters', '{"utm_source":"test"}');

      const { result } = renderHook(() =>
        useUtmTracking({
          config: {
            shareContextParams: {
              default: { utm_medium: 'social_share' },
            },
          },
        })
      );

      const url = result.current.appendToUrl('https://example.com/share');
      expect(url).toContain('utm_source=test');
      expect(url).toContain('utm_medium=social_share');
    });

    it('applies platform-specific params', () => {
      sessionStorage.setItem('utm_parameters', '{"utm_source":"test"}');

      const { result } = renderHook(() =>
        useUtmTracking({
          config: {
            shareContextParams: {
              linkedin: { utm_content: 'linkedin_share' },
            },
          },
        })
      );

      const url = result.current.appendToUrl('https://example.com/share', 'linkedin');
      expect(url).toContain('utm_source=test');
      expect(url).toContain('utm_content=linkedin_share');
    });

    it('platform params override default params', () => {
      sessionStorage.setItem('utm_parameters', '{"utm_source":"test"}');

      const { result } = renderHook(() =>
        useUtmTracking({
          config: {
            shareContextParams: {
              default: { utm_content: 'default_content' },
              linkedin: { utm_content: 'linkedin_content' },
            },
          },
        })
      );

      const url = result.current.appendToUrl('https://example.com/share', 'linkedin');
      expect(url).toContain('utm_content=linkedin_content');
      expect(url).not.toContain('default_content');
    });

    it('excludes params in excludeFromShares', () => {
      sessionStorage.setItem(
        'utm_parameters',
        '{"utm_source":"test","utm_team_id":"team123"}'
      );

      const { result } = renderHook(() =>
        useUtmTracking({
          config: {
            excludeFromShares: ['utm_team_id'],
          },
        })
      );

      const url = result.current.appendToUrl('https://example.com/share');
      expect(url).toContain('utm_source=test');
      expect(url).not.toContain('utm_team_id');
      expect(url).not.toContain('team123');
    });
  });

  describe('key format', () => {
    it('uses snake_case by default', () => {
      vi.stubGlobal('location', {
        href: 'https://example.com?utm_source=test',
        search: '?utm_source=test',
      });

      const { result } = renderHook(() =>
        useUtmTracking({ config: { captureOnMount: true } })
      );

      expect(result.current.utmParameters).toEqual({ utm_source: 'test' });
    });

    it('can use camelCase format', () => {
      vi.stubGlobal('location', {
        href: 'https://example.com?utm_source=test',
        search: '?utm_source=test',
      });

      const { result } = renderHook(() =>
        useUtmTracking({
          config: { captureOnMount: true, keyFormat: 'camelCase' },
        })
      );

      expect(result.current.utmParameters).toEqual({ utmSource: 'test' });
    });
  });
});

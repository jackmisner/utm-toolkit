import { describe, it, expect } from 'vitest';
import {
  appendUtmParameters,
  removeUtmParameters,
  extractUtmParameters,
} from '../../src/core/appender';

describe('appendUtmParameters', () => {
  describe('basic appending', () => {
    it('appends UTM parameters to URL', () => {
      const result = appendUtmParameters(
        'https://example.com',
        { utm_source: 'linkedin', utm_campaign: 'spring2025' }
      );
      expect(result).toBe('https://example.com/?utm_source=linkedin&utm_campaign=spring2025');
    });

    it('preserves existing non-UTM parameters', () => {
      const result = appendUtmParameters(
        'https://example.com?ref=abc',
        { utm_source: 'test' }
      );
      expect(result).toBe('https://example.com/?ref=abc&utm_source=test');
    });

    it('replaces existing UTM parameters', () => {
      const result = appendUtmParameters(
        'https://example.com?utm_source=old',
        { utm_source: 'new' }
      );
      expect(result).toBe('https://example.com/?utm_source=new');
    });

    it('handles URL with path', () => {
      const result = appendUtmParameters(
        'https://example.com/page/article',
        { utm_source: 'test' }
      );
      expect(result).toBe('https://example.com/page/article?utm_source=test');
    });

    it('handles URL with port', () => {
      const result = appendUtmParameters(
        'https://example.com:8080',
        { utm_source: 'test' }
      );
      expect(result).toBe('https://example.com:8080/?utm_source=test');
    });
  });

  describe('camelCase conversion', () => {
    it('converts camelCase params to snake_case in URL', () => {
      const result = appendUtmParameters(
        'https://example.com',
        { utmSource: 'linkedin', utmCampaign: 'spring2025' }
      );
      expect(result).toBe('https://example.com/?utm_source=linkedin&utm_campaign=spring2025');
    });
  });

  describe('fragment handling', () => {
    it('preserves regular fragment', () => {
      const result = appendUtmParameters(
        'https://example.com#section',
        { utm_source: 'test' }
      );
      expect(result).toBe('https://example.com/?utm_source=test#section');
    });

    it('clears conflicting UTM params from fragment', () => {
      const result = appendUtmParameters(
        'https://example.com#utm_source=old',
        { utm_source: 'new' }
      );
      expect(result).toBe('https://example.com/?utm_source=new');
    });

    it('preserves non-UTM params in fragment', () => {
      const result = appendUtmParameters(
        'https://example.com#ref=abc&utm_source=old',
        { utm_source: 'new' }
      );
      expect(result).toBe('https://example.com/?utm_source=new#ref=abc');
    });
  });

  describe('toFragment option', () => {
    it('appends to fragment when toFragment is true', () => {
      const result = appendUtmParameters(
        'https://example.com',
        { utm_source: 'test' },
        { toFragment: true }
      );
      expect(result).toBe('https://example.com/#utm_source=test');
    });

    it('removes conflicting params from query when using fragment', () => {
      const result = appendUtmParameters(
        'https://example.com?utm_source=query',
        { utm_source: 'fragment' },
        { toFragment: true }
      );
      expect(result).toBe('https://example.com/#utm_source=fragment');
    });

    it('preserves non-UTM query params when using fragment', () => {
      const result = appendUtmParameters(
        'https://example.com?ref=abc',
        { utm_source: 'test' },
        { toFragment: true }
      );
      expect(result).toBe('https://example.com/?ref=abc#utm_source=test');
    });
  });

  describe('preserveExisting option', () => {
    it('preserves existing UTM params when preserveExisting is true', () => {
      const result = appendUtmParameters(
        'https://example.com?utm_source=original',
        { utm_source: 'new', utm_medium: 'email' },
        { preserveExisting: true }
      );
      expect(result).toContain('utm_source=original');
      expect(result).toContain('utm_medium=email');
    });

    it('replaces by default (preserveExisting false)', () => {
      const result = appendUtmParameters(
        'https://example.com?utm_source=original',
        { utm_source: 'new' }
      );
      expect(result).toBe('https://example.com/?utm_source=new');
    });
  });

  describe('empty values handling', () => {
    it('handles empty parameter values', () => {
      const result = appendUtmParameters(
        'https://example.com',
        { utm_source: 'test', utm_campaign: '' }
      );
      // Empty values should be included without =
      expect(result).toContain('utm_source=test');
      expect(result).toContain('utm_campaign');
      expect(result).not.toContain('utm_campaign=');
    });

    it('returns original URL when no valid params', () => {
      const result = appendUtmParameters(
        'https://example.com',
        {}
      );
      expect(result).toBe('https://example.com');
    });

    it('returns original URL when all params undefined', () => {
      const result = appendUtmParameters(
        'https://example.com',
        { utm_source: undefined }
      );
      expect(result).toBe('https://example.com');
    });
  });

  describe('URL encoding', () => {
    it('properly encodes parameter values', () => {
      const result = appendUtmParameters(
        'https://example.com',
        { utm_source: 'test value', utm_campaign: 'spring&summer' }
      );
      expect(result).toContain('utm_source=test%20value');
      expect(result).toContain('utm_campaign=spring%26summer');
    });
  });

  describe('error handling', () => {
    it('returns original URL for invalid URLs', () => {
      const result = appendUtmParameters(
        'not a valid url',
        { utm_source: 'test' }
      );
      expect(result).toBe('not a valid url');
    });
  });
});

describe('removeUtmParameters', () => {
  it('removes all UTM parameters from URL', () => {
    const result = removeUtmParameters(
      'https://example.com?utm_source=test&utm_medium=email&ref=abc'
    );
    expect(result).toBe('https://example.com/?ref=abc');
  });

  it('removes specific UTM parameters', () => {
    const result = removeUtmParameters(
      'https://example.com?utm_source=test&utm_medium=email&utm_campaign=sale',
      ['utm_source', 'utm_medium']
    );
    expect(result).toContain('utm_campaign=sale');
    expect(result).not.toContain('utm_source');
    expect(result).not.toContain('utm_medium');
  });

  it('removes UTM params from fragment', () => {
    const result = removeUtmParameters(
      'https://example.com#utm_source=test&ref=abc'
    );
    expect(result).toContain('ref=abc');
    expect(result).not.toContain('utm_source');
  });

  it('handles URL with no UTM params', () => {
    const result = removeUtmParameters('https://example.com?ref=abc');
    expect(result).toBe('https://example.com/?ref=abc');
  });

  it('returns original for invalid URL', () => {
    const result = removeUtmParameters('not a url');
    expect(result).toBe('not a url');
  });
});

describe('extractUtmParameters', () => {
  it('extracts UTM params from query string', () => {
    const result = extractUtmParameters(
      'https://example.com?utm_source=test&utm_campaign=sale&ref=abc'
    );
    expect(result).toEqual({
      utm_source: 'test',
      utm_campaign: 'sale',
    });
  });

  it('extracts UTM params from fragment', () => {
    const result = extractUtmParameters(
      'https://example.com#utm_source=fragment&utm_medium=email'
    );
    expect(result).toEqual({
      utm_source: 'fragment',
      utm_medium: 'email',
    });
  });

  it('fragment params override query params', () => {
    const result = extractUtmParameters(
      'https://example.com?utm_source=query#utm_source=fragment'
    );
    expect(result).toEqual({ utm_source: 'fragment' });
  });

  it('returns empty object for URL without UTM params', () => {
    const result = extractUtmParameters('https://example.com?ref=abc');
    expect(result).toEqual({});
  });

  it('returns empty object for invalid URL', () => {
    const result = extractUtmParameters('not a url');
    expect(result).toEqual({});
  });
});

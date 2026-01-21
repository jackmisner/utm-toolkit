import { describe, it, expect } from 'vitest';
import {
  toSnakeCase,
  toCamelCase,
  toSnakeCaseParams,
  toCamelCaseParams,
  convertParams,
  isSnakeCaseUtmKey,
  isCamelCaseUtmKey,
  isUtmKey,
  isValidUtmParameters,
  detectKeyFormat,
  normalizeKey,
  toUrlKey,
} from '../../src/core/keys';

describe('toSnakeCase', () => {
  it('converts standard camelCase keys to snake_case', () => {
    expect(toSnakeCase('utmSource')).toBe('utm_source');
    expect(toSnakeCase('utmMedium')).toBe('utm_medium');
    expect(toSnakeCase('utmCampaign')).toBe('utm_campaign');
    expect(toSnakeCase('utmTerm')).toBe('utm_term');
    expect(toSnakeCase('utmContent')).toBe('utm_content');
    expect(toSnakeCase('utmId')).toBe('utm_id');
  });

  it('converts custom camelCase keys to snake_case', () => {
    expect(toSnakeCase('utmTeamId')).toBe('utm_team_id');
    expect(toSnakeCase('utmCustomParam')).toBe('utm_custom_param');
  });

  it('returns snake_case keys unchanged', () => {
    expect(toSnakeCase('utm_source')).toBe('utm_source');
    expect(toSnakeCase('utm_team_id')).toBe('utm_team_id');
  });

  it('handles non-utm keys', () => {
    expect(toSnakeCase('notUtm')).toBe('notUtm');
    expect(toSnakeCase('random_key')).toBe('random_key');
  });
});

describe('toCamelCase', () => {
  it('converts standard snake_case keys to camelCase', () => {
    expect(toCamelCase('utm_source')).toBe('utmSource');
    expect(toCamelCase('utm_medium')).toBe('utmMedium');
    expect(toCamelCase('utm_campaign')).toBe('utmCampaign');
    expect(toCamelCase('utm_term')).toBe('utmTerm');
    expect(toCamelCase('utm_content')).toBe('utmContent');
    expect(toCamelCase('utm_id')).toBe('utmId');
  });

  it('converts custom snake_case keys to camelCase', () => {
    expect(toCamelCase('utm_team_id')).toBe('utmTeamId');
    expect(toCamelCase('utm_custom_param')).toBe('utmCustomParam');
  });

  it('returns camelCase keys unchanged', () => {
    expect(toCamelCase('utmSource')).toBe('utmSource');
    expect(toCamelCase('utmTeamId')).toBe('utmTeamId');
  });

  it('handles non-utm keys', () => {
    expect(toCamelCase('notUtm')).toBe('notUtm');
    expect(toCamelCase('random_key')).toBe('random_key');
  });
});

describe('isSnakeCaseUtmKey', () => {
  it('returns true for snake_case UTM keys', () => {
    expect(isSnakeCaseUtmKey('utm_source')).toBe(true);
    expect(isSnakeCaseUtmKey('utm_medium')).toBe(true);
    expect(isSnakeCaseUtmKey('utm_custom')).toBe(true);
  });

  it('returns false for camelCase UTM keys', () => {
    expect(isSnakeCaseUtmKey('utmSource')).toBe(false);
    expect(isSnakeCaseUtmKey('utmMedium')).toBe(false);
  });

  it('returns false for non-UTM keys', () => {
    expect(isSnakeCaseUtmKey('source')).toBe(false);
    expect(isSnakeCaseUtmKey('ref')).toBe(false);
  });
});

describe('isCamelCaseUtmKey', () => {
  it('returns true for camelCase UTM keys', () => {
    expect(isCamelCaseUtmKey('utmSource')).toBe(true);
    expect(isCamelCaseUtmKey('utmMedium')).toBe(true);
    expect(isCamelCaseUtmKey('utmCustomParam')).toBe(true);
  });

  it('returns false for snake_case UTM keys', () => {
    expect(isCamelCaseUtmKey('utm_source')).toBe(false);
    expect(isCamelCaseUtmKey('utm_medium')).toBe(false);
  });

  it('returns false for non-UTM keys', () => {
    expect(isCamelCaseUtmKey('source')).toBe(false);
    expect(isCamelCaseUtmKey('utm')).toBe(false); // Just 'utm' without more
  });
});

describe('isUtmKey', () => {
  it('returns true for both snake_case and camelCase UTM keys', () => {
    expect(isUtmKey('utm_source')).toBe(true);
    expect(isUtmKey('utmSource')).toBe(true);
    expect(isUtmKey('utm_team_id')).toBe(true);
    expect(isUtmKey('utmTeamId')).toBe(true);
  });

  it('returns false for non-UTM keys', () => {
    expect(isUtmKey('source')).toBe(false);
    expect(isUtmKey('ref')).toBe(false);
    expect(isUtmKey('utm')).toBe(false);
  });
});

describe('convertParams', () => {
  it('converts params to snake_case', () => {
    const result = convertParams(
      { utmSource: 'test', utmCampaign: 'sale' },
      'snake_case'
    );
    expect(result).toEqual({ utm_source: 'test', utm_campaign: 'sale' });
  });

  it('converts params to camelCase', () => {
    const result = convertParams(
      { utm_source: 'test', utm_campaign: 'sale' },
      'camelCase'
    );
    expect(result).toEqual({ utmSource: 'test', utmCampaign: 'sale' });
  });

  it('handles empty objects', () => {
    expect(convertParams({}, 'snake_case')).toEqual({});
    expect(convertParams({}, 'camelCase')).toEqual({});
  });

  it('handles undefined values', () => {
    const result = convertParams(
      { utm_source: 'test', utm_medium: undefined },
      'camelCase'
    );
    expect(result).toEqual({ utmSource: 'test' });
  });
});

describe('toSnakeCaseParams', () => {
  it('converts all params to snake_case', () => {
    const result = toSnakeCaseParams({
      utmSource: 'linkedin',
      utmCampaign: 'spring2025',
    });
    expect(result).toEqual({
      utm_source: 'linkedin',
      utm_campaign: 'spring2025',
    });
  });
});

describe('toCamelCaseParams', () => {
  it('converts all params to camelCase', () => {
    const result = toCamelCaseParams({
      utm_source: 'linkedin',
      utm_campaign: 'spring2025',
    });
    expect(result).toEqual({
      utmSource: 'linkedin',
      utmCampaign: 'spring2025',
    });
  });
});

describe('detectKeyFormat', () => {
  it('detects snake_case format', () => {
    expect(detectKeyFormat({ utm_source: 'test' })).toBe('snake_case');
    expect(detectKeyFormat({ utm_source: 'test', utm_medium: 'email' })).toBe('snake_case');
  });

  it('detects camelCase format', () => {
    expect(detectKeyFormat({ utmSource: 'test' })).toBe('camelCase');
    expect(detectKeyFormat({ utmSource: 'test', utmMedium: 'email' })).toBe('camelCase');
  });

  it('returns snake_case as default for empty objects', () => {
    expect(detectKeyFormat({})).toBe('snake_case');
  });
});

describe('normalizeKey', () => {
  it('normalizes to snake_case', () => {
    expect(normalizeKey('utmSource', 'snake_case')).toBe('utm_source');
    expect(normalizeKey('utm_source', 'snake_case')).toBe('utm_source');
  });

  it('normalizes to camelCase', () => {
    expect(normalizeKey('utm_source', 'camelCase')).toBe('utmSource');
    expect(normalizeKey('utmSource', 'camelCase')).toBe('utmSource');
  });
});

describe('toUrlKey', () => {
  it('converts camelCase to snake_case for URLs', () => {
    expect(toUrlKey('utmSource')).toBe('utm_source');
    expect(toUrlKey('utmTeamId')).toBe('utm_team_id');
  });

  it('returns snake_case unchanged', () => {
    expect(toUrlKey('utm_source')).toBe('utm_source');
    expect(toUrlKey('utm_team_id')).toBe('utm_team_id');
  });
});

describe('isValidUtmParameters', () => {
  it('returns true for valid snake_case params', () => {
    expect(isValidUtmParameters({ utm_source: 'test' }, 'snake_case')).toBe(true);
    expect(isValidUtmParameters({ utm_source: 'test', utm_medium: 'email' }, 'snake_case')).toBe(true);
  });

  it('returns true for valid camelCase params', () => {
    expect(isValidUtmParameters({ utmSource: 'test' }, 'camelCase')).toBe(true);
    expect(isValidUtmParameters({ utmSource: 'test', utmMedium: 'email' }, 'camelCase')).toBe(true);
  });

  it('returns true for empty objects', () => {
    expect(isValidUtmParameters({})).toBe(true);
  });

  it('returns false for non-objects', () => {
    expect(isValidUtmParameters(null)).toBe(false);
    expect(isValidUtmParameters(undefined)).toBe(false);
    expect(isValidUtmParameters('string')).toBe(false);
    expect(isValidUtmParameters(123)).toBe(false);
    expect(isValidUtmParameters([])).toBe(false);
  });

  it('returns false for invalid values', () => {
    expect(isValidUtmParameters({ utm_source: 123 })).toBe(false);
    expect(isValidUtmParameters({ utm_source: { nested: true } })).toBe(false);
  });

  it('returns false for invalid keys in strict mode', () => {
    expect(isValidUtmParameters({ invalid_key: 'test' }, 'snake_case')).toBe(false);
    expect(isValidUtmParameters({ invalidKey: 'test' }, 'camelCase')).toBe(false);
  });

  it('accepts either format when format not specified', () => {
    expect(isValidUtmParameters({ utm_source: 'test' })).toBe(true);
    expect(isValidUtmParameters({ utmSource: 'test' })).toBe(true);
  });
});

/**
 * UTM Key Conversion Utilities
 *
 * Provides bidirectional conversion between snake_case (URL format)
 * and camelCase (TypeScript format) for UTM parameters.
 */

import type { KeyFormat, UtmParameters, UtmParametersSnake, UtmParametersCamel } from '../types';

/**
 * Standard UTM parameter mappings: snake_case -> camelCase
 */
export const SNAKE_TO_CAMEL: Record<string, string> = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_term: 'utmTerm',
  utm_content: 'utmContent',
  utm_id: 'utmId',
};

/**
 * Standard UTM parameter mappings: camelCase -> snake_case
 */
export const CAMEL_TO_SNAKE: Record<string, string> = {
  utmSource: 'utm_source',
  utmMedium: 'utm_medium',
  utmCampaign: 'utm_campaign',
  utmTerm: 'utm_term',
  utmContent: 'utm_content',
  utmId: 'utm_id',
};

/**
 * All standard snake_case UTM keys
 */
export const STANDARD_SNAKE_KEYS = Object.keys(SNAKE_TO_CAMEL);

/**
 * All standard camelCase UTM keys
 */
export const STANDARD_CAMEL_KEYS = Object.keys(CAMEL_TO_SNAKE);

/**
 * Convert a single key from snake_case to camelCase
 *
 * @example
 * toSnakeCase('utmSource') // 'utm_source'
 * toSnakeCase('utmTeamId') // 'utm_team_id'
 */
export function toSnakeCase(key: string): string {
  // Check standard mappings first
  if (key in CAMEL_TO_SNAKE) {
    return CAMEL_TO_SNAKE[key]!;
  }

  // For custom keys: utmTeamId -> utm_team_id
  // Handle keys that start with 'utm' prefix
  if (key.startsWith('utm') && key.length > 3) {
    const rest = key.slice(3); // Remove 'utm' prefix
    // Convert camelCase to snake_case
    const snakeRest = rest
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase();
    return `utm${snakeRest}`;
  }

  // If already snake_case or doesn't start with utm, return as-is
  return key;
}

/**
 * Convert a single key from camelCase to snake_case
 *
 * @example
 * toCamelCase('utm_source') // 'utmSource'
 * toCamelCase('utm_team_id') // 'utmTeamId'
 */
export function toCamelCase(key: string): string {
  // Check standard mappings first
  if (key in SNAKE_TO_CAMEL) {
    return SNAKE_TO_CAMEL[key]!;
  }

  // For custom keys: utm_team_id -> utmTeamId
  if (key.startsWith('utm_') && key.length > 4) {
    const rest = key.slice(4); // Remove 'utm_' prefix
    // Convert snake_case to camelCase
    const camelRest = rest.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
    return `utm${camelRest.charAt(0).toUpperCase()}${camelRest.slice(1)}`;
  }

  // If already camelCase or doesn't start with utm_, return as-is
  return key;
}

/**
 * Check if a key is in snake_case UTM format (starts with 'utm_')
 */
export function isSnakeCaseUtmKey(key: string): boolean {
  return key.startsWith('utm_');
}

/**
 * Check if a key is in camelCase UTM format (starts with 'utm' followed by uppercase letter)
 */
export function isCamelCaseUtmKey(key: string): boolean {
  if (!key.startsWith('utm') || key.length <= 3) {
    return false;
  }
  const fourthChar = key[3];
  // Must be an uppercase letter (A-Z), not underscore or other character
  return fourthChar !== undefined && /^[A-Z]$/.test(fourthChar);
}

/**
 * Check if a key is a valid UTM key in either format
 */
export function isUtmKey(key: string): boolean {
  return isSnakeCaseUtmKey(key) || isCamelCaseUtmKey(key);
}

/**
 * Detect the key format of a UTM parameters object
 * Returns 'snake_case' if any key starts with 'utm_'
 * Returns 'camelCase' if any key starts with 'utm' followed by uppercase
 * Returns 'snake_case' as default for empty objects
 */
export function detectKeyFormat(params: UtmParameters): KeyFormat {
  const keys = Object.keys(params);

  for (const key of keys) {
    if (isSnakeCaseUtmKey(key)) {
      return 'snake_case';
    }
    if (isCamelCaseUtmKey(key)) {
      return 'camelCase';
    }
  }

  return 'snake_case'; // Default
}

/**
 * Convert all keys in a UTM parameters object to the target format
 *
 * @param params - UTM parameters object to convert
 * @param targetFormat - Target key format ('snake_case' or 'camelCase')
 * @returns New object with converted keys
 */
export function convertParams(
  params: UtmParameters,
  targetFormat: KeyFormat
): UtmParameters {
  const result: Record<string, string | undefined> = {};
  const converter = targetFormat === 'snake_case' ? toSnakeCase : toCamelCase;

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      const newKey = converter(key);
      result[newKey] = value;
    }
  }

  return result as UtmParameters;
}

/**
 * Convert parameters to snake_case format
 */
export function toSnakeCaseParams(params: UtmParameters): UtmParametersSnake {
  return convertParams(params, 'snake_case') as UtmParametersSnake;
}

/**
 * Convert parameters to camelCase format
 */
export function toCamelCaseParams(params: UtmParameters): UtmParametersCamel {
  return convertParams(params, 'camelCase') as UtmParametersCamel;
}

/**
 * Validate that an object contains only valid UTM keys and string values
 *
 * @param obj - Object to validate
 * @param format - Expected key format (optional, will detect if not provided)
 * @returns True if object is valid UTM parameters
 */
export function isValidUtmParameters(
  obj: unknown,
  format?: KeyFormat
): obj is UtmParameters {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  const entries = Object.entries(obj);

  // Empty object is valid
  if (entries.length === 0) {
    return true;
  }

  return entries.every(([key, value]) => {
    // Value must be string or undefined
    if (value !== undefined && typeof value !== 'string') {
      return false;
    }

    // Key must be valid UTM key
    if (format === 'snake_case') {
      return isSnakeCaseUtmKey(key);
    }
    if (format === 'camelCase') {
      return isCamelCaseUtmKey(key);
    }

    // If no format specified, accept either
    return isUtmKey(key);
  });
}

/**
 * Normalize a key to the specified format
 * Handles cases where the key might already be in the target format
 */
export function normalizeKey(key: string, targetFormat: KeyFormat): string {
  if (targetFormat === 'snake_case') {
    return isSnakeCaseUtmKey(key) ? key : toSnakeCase(key);
  }
  return isCamelCaseUtmKey(key) ? key : toCamelCase(key);
}

/**
 * Get the snake_case version of a key (for URL usage)
 * Always returns snake_case regardless of input format
 */
export function toUrlKey(key: string): string {
  return isSnakeCaseUtmKey(key) ? key : toSnakeCase(key);
}

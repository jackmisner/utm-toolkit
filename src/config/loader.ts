/**
 * Configuration Loader
 *
 * Provides utilities for loading and merging UTM toolkit configuration.
 */

import type { UtmConfig, ResolvedUtmConfig, ShareContextParams, UtmParameters } from '../types';
import { DEFAULT_CONFIG, getDefaultConfig } from './defaults';

/**
 * Deep merge share context params
 */
function mergeShareContextParams(
  base: ShareContextParams,
  override: ShareContextParams | undefined
): ShareContextParams {
  if (!override) {
    return { ...base };
  }

  const result: ShareContextParams = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) {
      // Merge platform-specific params with base
      result[key] = {
        ...(base[key] || {}),
        ...value,
      };
    }
  }

  return result;
}

/**
 * Merge two UTM parameter objects
 */
function mergeUtmParams(
  base: UtmParameters,
  override: UtmParameters | undefined
): UtmParameters {
  if (!override) {
    return { ...base };
  }
  return { ...base, ...override };
}

/**
 * Create a fully resolved configuration by merging user config with defaults
 *
 * @param userConfig - Partial configuration provided by user
 * @returns Fully resolved configuration with all fields populated
 *
 * @example
 * ```typescript
 * const config = createConfig({
 *   keyFormat: 'camelCase',
 *   storageKey: 'myapp_utm',
 * });
 * // Returns full config with defaults for unspecified fields
 * ```
 */
export function createConfig(userConfig?: Partial<UtmConfig>): ResolvedUtmConfig {
  const defaults = getDefaultConfig();

  if (!userConfig) {
    return defaults;
  }

  return {
    enabled: userConfig.enabled ?? defaults.enabled,
    keyFormat: userConfig.keyFormat ?? defaults.keyFormat,
    storageKey: userConfig.storageKey ?? defaults.storageKey,
    captureOnMount: userConfig.captureOnMount ?? defaults.captureOnMount,
    appendToShares: userConfig.appendToShares ?? defaults.appendToShares,
    allowedParameters: userConfig.allowedParameters
      ? [...userConfig.allowedParameters]
      : defaults.allowedParameters,
    defaultParams: mergeUtmParams(defaults.defaultParams, userConfig.defaultParams),
    shareContextParams: mergeShareContextParams(
      defaults.shareContextParams,
      userConfig.shareContextParams
    ),
    excludeFromShares: userConfig.excludeFromShares
      ? [...userConfig.excludeFromShares]
      : defaults.excludeFromShares,
  };
}

/**
 * Merge two configurations, with the second taking priority
 *
 * @param base - Base configuration
 * @param override - Override configuration (takes priority)
 * @returns Merged configuration
 */
export function mergeConfig(
  base: ResolvedUtmConfig,
  override: Partial<UtmConfig>
): ResolvedUtmConfig {
  return {
    enabled: override.enabled ?? base.enabled,
    keyFormat: override.keyFormat ?? base.keyFormat,
    storageKey: override.storageKey ?? base.storageKey,
    captureOnMount: override.captureOnMount ?? base.captureOnMount,
    appendToShares: override.appendToShares ?? base.appendToShares,
    allowedParameters: override.allowedParameters
      ? [...override.allowedParameters]
      : [...base.allowedParameters],
    defaultParams: mergeUtmParams(base.defaultParams, override.defaultParams),
    shareContextParams: mergeShareContextParams(
      base.shareContextParams,
      override.shareContextParams
    ),
    excludeFromShares: override.excludeFromShares
      ? [...override.excludeFromShares]
      : [...base.excludeFromShares],
  };
}

/**
 * Load configuration from a JSON object
 *
 * This is useful when loading config from a JSON file that has been imported
 * or fetched. Validates the config and merges with defaults.
 *
 * @param jsonConfig - JSON configuration object
 * @returns Fully resolved configuration
 *
 * @example
 * ```typescript
 * // With static import
 * import configJson from './utm-config.json';
 * const config = loadConfigFromJson(configJson);
 *
 * // With dynamic import
 * const configJson = await import('./utm-config.json');
 * const config = loadConfigFromJson(configJson.default);
 * ```
 */
export function loadConfigFromJson(jsonConfig: unknown): ResolvedUtmConfig {
  if (!jsonConfig || typeof jsonConfig !== 'object' || Array.isArray(jsonConfig)) {
    console.warn('Invalid UTM config JSON, using defaults');
    return getDefaultConfig();
  }

  // Cast to partial config and let createConfig handle validation
  return createConfig(jsonConfig as Partial<UtmConfig>);
}

/**
 * Validate a configuration object
 *
 * Checks that the configuration has valid types for all fields.
 * Returns validation errors if any are found.
 *
 * @param config - Configuration to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateConfig(config: unknown): string[] {
  const errors: string[] = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return ['Config must be a non-null object'];
  }

  const c = config as Record<string, unknown>;

  if (c.enabled !== undefined && typeof c.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  if (c.keyFormat !== undefined && c.keyFormat !== 'snake_case' && c.keyFormat !== 'camelCase') {
    errors.push('keyFormat must be "snake_case" or "camelCase"');
  }

  if (c.storageKey !== undefined && typeof c.storageKey !== 'string') {
    errors.push('storageKey must be a string');
  }

  if (c.captureOnMount !== undefined && typeof c.captureOnMount !== 'boolean') {
    errors.push('captureOnMount must be a boolean');
  }

  if (c.appendToShares !== undefined && typeof c.appendToShares !== 'boolean') {
    errors.push('appendToShares must be a boolean');
  }

  if (c.allowedParameters !== undefined) {
    if (!Array.isArray(c.allowedParameters)) {
      errors.push('allowedParameters must be an array');
    } else if (!c.allowedParameters.every((p) => typeof p === 'string')) {
      errors.push('allowedParameters must contain only strings');
    }
  }

  if (c.excludeFromShares !== undefined) {
    if (!Array.isArray(c.excludeFromShares)) {
      errors.push('excludeFromShares must be an array');
    } else if (!c.excludeFromShares.every((p) => typeof p === 'string')) {
      errors.push('excludeFromShares must contain only strings');
    }
  }

  if (c.defaultParams !== undefined && (typeof c.defaultParams !== 'object' || c.defaultParams === null)) {
    errors.push('defaultParams must be an object');
  }

  if (c.shareContextParams !== undefined && (typeof c.shareContextParams !== 'object' || c.shareContextParams === null)) {
    errors.push('shareContextParams must be an object');
  }

  return errors;
}

/**
 * Re-export default config for convenience
 */
export { DEFAULT_CONFIG, getDefaultConfig };

/**
 * Configuration Loader
 *
 * Provides utilities for loading and merging UTM toolkit configuration.
 */

import type {
  AttributionConfig,
  UtmConfig,
  ResolvedUtmConfig,
  PiiFilterConfig,
  SanitizeConfig,
  ShareContextParams,
  UtmParameters,
} from '../types'
import { DEFAULT_CONFIG, getDefaultConfig } from './defaults'

/**
 * Deep merge share context params
 */
function mergeShareContextParams(
  base: ShareContextParams,
  override: ShareContextParams | undefined,
): ShareContextParams {
  if (!override) {
    return { ...base }
  }

  const result: ShareContextParams = { ...base }

  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) {
      // Merge platform-specific params with base
      result[key] = {
        ...base[key],
        ...value,
      }
    }
  }

  return result
}

/**
 * Merge sanitize config with defaults
 */
function mergeSanitizeConfig(
  base: SanitizeConfig,
  override: Partial<SanitizeConfig> | undefined,
): SanitizeConfig {
  if (!override) {
    return { ...base }
  }
  return {
    enabled: override.enabled ?? base.enabled,
    stripHtml: override.stripHtml ?? base.stripHtml,
    stripControlChars: override.stripControlChars ?? base.stripControlChars,
    maxLength: override.maxLength ?? base.maxLength,
    onMaxLength: override.onMaxLength ?? base.onMaxLength,
    customPattern: override.customPattern ?? base.customPattern,
    valuePattern: override.valuePattern ?? base.valuePattern,
  }
}

/**
 * Merge PII filter config with defaults
 */
function mergePiiFilterConfig(
  base: PiiFilterConfig,
  override: Partial<PiiFilterConfig> | undefined,
): PiiFilterConfig {
  if (!override) {
    return { ...base, patterns: base.patterns.map((p) => ({ ...p })) }
  }
  return {
    enabled: override.enabled ?? base.enabled,
    mode: override.mode ?? base.mode,
    patterns: override.patterns ? [...override.patterns] : base.patterns.map((p) => ({ ...p })),
    allowlistPattern: override.allowlistPattern ?? base.allowlistPattern,
    onPiiDetected: override.onPiiDetected ?? base.onPiiDetected,
  }
}

/**
 * Merge two UTM parameter objects
 */
function mergeUtmParams(base: UtmParameters, override: UtmParameters | undefined): UtmParameters {
  if (!override) {
    return { ...base }
  }
  return { ...base, ...override }
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
  const defaults = getDefaultConfig()

  if (!userConfig) {
    return defaults
  }

  return {
    enabled: userConfig.enabled ?? defaults.enabled,
    keyFormat: userConfig.keyFormat ?? defaults.keyFormat,
    storageKey: userConfig.storageKey ?? defaults.storageKey,
    storageType: userConfig.storageType ?? defaults.storageType,
    ttl: userConfig.ttl ?? defaults.ttl,
    captureOnMount: userConfig.captureOnMount ?? defaults.captureOnMount,
    appendToShares: userConfig.appendToShares ?? defaults.appendToShares,
    lowercaseValues: userConfig.lowercaseValues ?? defaults.lowercaseValues,
    allowedParameters: userConfig.allowedParameters
      ? [...userConfig.allowedParameters]
      : defaults.allowedParameters,
    defaultParams: mergeUtmParams(defaults.defaultParams, userConfig.defaultParams),
    shareContextParams: mergeShareContextParams(
      defaults.shareContextParams,
      userConfig.shareContextParams,
    ),
    excludeFromShares: userConfig.excludeFromShares
      ? [...userConfig.excludeFromShares]
      : defaults.excludeFromShares,
    sanitize: mergeSanitizeConfig(defaults.sanitize, userConfig.sanitize),
    piiFiltering: mergePiiFilterConfig(defaults.piiFiltering, userConfig.piiFiltering),
    attribution: mergeAttributionConfig(defaults.attribution, userConfig.attribution),
    onCapture: userConfig.onCapture,
    onStore: userConfig.onStore,
    onClear: userConfig.onClear,
    onAppend: userConfig.onAppend,
    onExpire: userConfig.onExpire,
  }
}

/**
 * Merge attribution config with defaults
 */
function mergeAttributionConfig(
  base: AttributionConfig,
  override: Partial<AttributionConfig> | undefined,
): AttributionConfig {
  if (!override) {
    return { ...base }
  }
  return {
    mode: override.mode ?? base.mode,
    firstTouchSuffix: override.firstTouchSuffix ?? base.firstTouchSuffix,
    lastTouchSuffix: override.lastTouchSuffix ?? base.lastTouchSuffix,
  }
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
  override: Partial<UtmConfig>,
): ResolvedUtmConfig {
  return {
    enabled: override.enabled ?? base.enabled,
    keyFormat: override.keyFormat ?? base.keyFormat,
    storageKey: override.storageKey ?? base.storageKey,
    storageType: override.storageType ?? base.storageType,
    ttl: override.ttl ?? base.ttl,
    captureOnMount: override.captureOnMount ?? base.captureOnMount,
    appendToShares: override.appendToShares ?? base.appendToShares,
    lowercaseValues: override.lowercaseValues ?? base.lowercaseValues,
    allowedParameters: override.allowedParameters
      ? [...override.allowedParameters]
      : [...base.allowedParameters],
    defaultParams: mergeUtmParams(base.defaultParams, override.defaultParams),
    shareContextParams: mergeShareContextParams(
      base.shareContextParams,
      override.shareContextParams,
    ),
    excludeFromShares: override.excludeFromShares
      ? [...override.excludeFromShares]
      : [...base.excludeFromShares],
    sanitize: mergeSanitizeConfig(base.sanitize, override.sanitize),
    piiFiltering: mergePiiFilterConfig(base.piiFiltering, override.piiFiltering),
    attribution: mergeAttributionConfig(base.attribution, override.attribution),
    onCapture: override.onCapture ?? base.onCapture,
    onStore: override.onStore ?? base.onStore,
    onClear: override.onClear ?? base.onClear,
    onAppend: override.onAppend ?? base.onAppend,
    onExpire: override.onExpire ?? base.onExpire,
  }
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
    console.warn('Invalid UTM config JSON, using defaults')
    return getDefaultConfig()
  }

  // Cast to partial config and let createConfig handle validation
  return createConfig(jsonConfig as Partial<UtmConfig>)
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
  const errors: string[] = []

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return ['Config must be a non-null object']
  }

  const c = config as Record<string, unknown>

  if (c.enabled !== undefined && typeof c.enabled !== 'boolean') {
    errors.push('enabled must be a boolean')
  }

  if (c.keyFormat !== undefined && c.keyFormat !== 'snake_case' && c.keyFormat !== 'camelCase') {
    errors.push('keyFormat must be "snake_case" or "camelCase"')
  }

  if (c.storageKey !== undefined && typeof c.storageKey !== 'string') {
    errors.push('storageKey must be a string')
  }

  if (c.storageType !== undefined && c.storageType !== 'session' && c.storageType !== 'local') {
    errors.push('storageType must be "session" or "local"')
  }

  if (c.ttl !== undefined && (typeof c.ttl !== 'number' || !Number.isFinite(c.ttl) || c.ttl <= 0)) {
    errors.push('ttl must be a positive finite number')
  }

  if (c.captureOnMount !== undefined && typeof c.captureOnMount !== 'boolean') {
    errors.push('captureOnMount must be a boolean')
  }

  if (c.appendToShares !== undefined && typeof c.appendToShares !== 'boolean') {
    errors.push('appendToShares must be a boolean')
  }

  if (c.lowercaseValues !== undefined && typeof c.lowercaseValues !== 'boolean') {
    errors.push('lowercaseValues must be a boolean')
  }

  if (c.allowedParameters !== undefined) {
    if (!Array.isArray(c.allowedParameters)) {
      errors.push('allowedParameters must be an array')
    } else if (!c.allowedParameters.every((p) => typeof p === 'string')) {
      errors.push('allowedParameters must contain only strings')
    }
  }

  if (c.excludeFromShares !== undefined) {
    if (!Array.isArray(c.excludeFromShares)) {
      errors.push('excludeFromShares must be an array')
    } else if (!c.excludeFromShares.every((p) => typeof p === 'string')) {
      errors.push('excludeFromShares must contain only strings')
    }
  }

  if (
    c.defaultParams !== undefined &&
    (typeof c.defaultParams !== 'object' ||
      c.defaultParams === null ||
      Array.isArray(c.defaultParams))
  ) {
    errors.push('defaultParams must be an object')
  }

  if (
    c.shareContextParams !== undefined &&
    (typeof c.shareContextParams !== 'object' ||
      c.shareContextParams === null ||
      Array.isArray(c.shareContextParams))
  ) {
    errors.push('shareContextParams must be an object')
  }

  if (c.sanitize !== undefined) {
    if (typeof c.sanitize !== 'object' || c.sanitize === null || Array.isArray(c.sanitize)) {
      errors.push('sanitize must be an object')
    } else {
      const s = c.sanitize as Record<string, unknown>
      if (s.enabled !== undefined && typeof s.enabled !== 'boolean') {
        errors.push('sanitize.enabled must be a boolean')
      }
      if (s.stripHtml !== undefined && typeof s.stripHtml !== 'boolean') {
        errors.push('sanitize.stripHtml must be a boolean')
      }
      if (s.stripControlChars !== undefined && typeof s.stripControlChars !== 'boolean') {
        errors.push('sanitize.stripControlChars must be a boolean')
      }
      if (
        s.maxLength !== undefined &&
        (typeof s.maxLength !== 'number' || !Number.isFinite(s.maxLength) || s.maxLength <= 0)
      ) {
        errors.push('sanitize.maxLength must be a positive finite number')
      }
      if (s.customPattern !== undefined && !(s.customPattern instanceof RegExp)) {
        errors.push('sanitize.customPattern must be a RegExp')
      }
      if (s.valuePattern !== undefined && !(s.valuePattern instanceof RegExp)) {
        errors.push('sanitize.valuePattern must be a RegExp')
      }
      if (s.onMaxLength !== undefined && s.onMaxLength !== 'truncate' && s.onMaxLength !== 'drop') {
        errors.push('sanitize.onMaxLength must be "truncate" or "drop"')
      }
    }
  }

  if (c.piiFiltering !== undefined) {
    if (
      typeof c.piiFiltering !== 'object' ||
      c.piiFiltering === null ||
      Array.isArray(c.piiFiltering)
    ) {
      errors.push('piiFiltering must be an object')
    } else {
      const p = c.piiFiltering as Record<string, unknown>
      if (p.enabled !== undefined && typeof p.enabled !== 'boolean') {
        errors.push('piiFiltering.enabled must be a boolean')
      }
      if (p.mode !== undefined && p.mode !== 'reject' && p.mode !== 'redact') {
        errors.push('piiFiltering.mode must be "reject" or "redact"')
      }
      if (p.patterns !== undefined) {
        if (!Array.isArray(p.patterns)) {
          errors.push('piiFiltering.patterns must be an array')
        } else {
          for (let i = 0; i < p.patterns.length; i++) {
            const pat = p.patterns[i] as Record<string, unknown>
            if (typeof pat !== 'object' || pat === null) {
              errors.push(`piiFiltering.patterns[${i}] must be an object`)
              continue
            }
            if (typeof pat.name !== 'string') {
              errors.push(`piiFiltering.patterns[${i}].name must be a string`)
            }
            if (!(pat.pattern instanceof RegExp)) {
              errors.push(`piiFiltering.patterns[${i}].pattern must be a RegExp`)
            }
            if (typeof pat.enabled !== 'boolean') {
              errors.push(`piiFiltering.patterns[${i}].enabled must be a boolean`)
            }
          }
        }
      }
      if (p.allowlistPattern !== undefined && !(p.allowlistPattern instanceof RegExp)) {
        errors.push('piiFiltering.allowlistPattern must be a RegExp')
      }
      if (p.onPiiDetected !== undefined && typeof p.onPiiDetected !== 'function') {
        errors.push('piiFiltering.onPiiDetected must be a function')
      }
    }
  }

  return errors
}

/**
 * Re-export default config for convenience
 */
export { DEFAULT_CONFIG, getDefaultConfig }

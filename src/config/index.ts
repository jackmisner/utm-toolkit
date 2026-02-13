/**
 * Configuration exports
 */

export {
  DEFAULT_CONFIG,
  DEFAULT_SANITIZE_CONFIG,
  DEFAULT_PII_PATTERNS,
  DEFAULT_PII_FILTER_CONFIG,
  DEFAULT_ATTRIBUTION_CONFIG,
  STANDARD_UTM_PARAMETERS,
  getDefaultConfig,
} from './defaults'

export { createConfig, mergeConfig, loadConfigFromJson, validateConfig } from './loader'

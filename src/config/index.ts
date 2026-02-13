/**
 * Configuration exports
 */

export {
  DEFAULT_CONFIG,
  DEFAULT_SANITIZE_CONFIG,
  STANDARD_UTM_PARAMETERS,
  getDefaultConfig,
} from './defaults'

export { createConfig, mergeConfig, loadConfigFromJson, validateConfig } from './loader'

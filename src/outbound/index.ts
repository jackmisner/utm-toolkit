/**
 * Outbound exports
 *
 * Utilities for creating UTM-tagged links: append params to URLs.
 */

// Appender utilities
export { appendUtmParameters, removeUtmParameters, extractUtmParameters } from './appender'

// Builder utilities
export {
  buildUtmUrl,
  validateUtmValues,
  type BuildUtmUrlParams,
  type BuildUtmUrlOptions,
  type BuildResult,
} from './builder'

// Link decorator utilities
export { decorateLinks, observeAndDecorateLinks, type LinkDecoratorOptions } from './decorator'

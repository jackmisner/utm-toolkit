/**
 * Inbound exports
 *
 * Utilities for receiving UTM-tagged traffic: capture, sanitize, filter PII.
 */

// Capture utilities
export {
  captureUtmParameters,
  hasUtmParameters,
  captureFromCurrentUrl,
  captureWithReferrer,
  type CaptureOptions,
} from './capture'

// Sanitizer utilities
export { sanitizeValue, sanitizeParams } from './sanitizer'

// PII filter utilities
export { detectPii, filterValue, filterParams } from './pii-filter'

// Form field population
export { populateFormFields, createUtmHiddenFields, type FormPopulateOptions } from './form'

// Attribution utilities
export {
  storeWithAttribution,
  getAttributedParams,
  type AttributionStoreOptions,
  type AttributionGetOptions,
} from './attribution'

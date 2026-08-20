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

// Capture reporting — tells "no campaign" apart from "campaign rejected"
export {
  captureUtmParametersWithReport,
  type UtmRejection,
  type UtmRejectionReason,
  type CaptureReport,
} from './capture-report'

// Sanitizer utilities
export {
  sanitizeValue,
  sanitizeParams,
  sanitizeValueWithReport,
  type SanitizeRejection,
  type SanitizeValueResult,
} from './sanitizer'

// PII filter utilities
export {
  detectPii,
  filterValue,
  filterParams,
  filterValueWithReport,
  type PiiRejection,
  type FilterValueResult,
} from './pii-filter'

// Form field population
export { populateFormFields, createUtmHiddenFields, type FormPopulateOptions } from './form'

// Attribution utilities
export {
  storeWithAttribution,
  getAttributedParams,
  type AttributionStoreOptions,
  type AttributionGetOptions,
} from './attribution'

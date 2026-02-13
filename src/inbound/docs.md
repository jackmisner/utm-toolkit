# Noridoc: inbound

Path: @/src/inbound

### Overview

- Utilities for the inbound data path: receiving UTM-tagged traffic, processing captured parameters, and routing them into storage or form fields.
- Includes URL capture, value sanitization, PII filtering, first-touch/last-touch attribution, and form field population.
- All exports are re-exported through `@/src/index.ts` to package consumers.

### How it fits into the larger codebase

- `@/src/react/useUtmTracking.ts` calls `captureUtmParameters` from this module during its mount-time capture flow.
- `@/src/debug` imports `captureUtmParameters` to build diagnostic snapshots.
- Attribution (`attribution.ts`) and form (`form.ts`) import storage functions from `@/src/common/storage`.
- Sanitizer and PII filter are invoked during capture when their respective config options are enabled. The config objects (`SanitizeConfig`, `PiiFilterConfig`) come from `@/src/types` and are resolved in `@/src/config`.
- Types (`AttributionConfig`, `TouchType`, `AttributionMode`, `PiiPattern`, etc.) come from `@/src/types`.

### Core Implementation

**Capture (`capture.ts`)** extracts UTM parameters from a URL string:
- Parses the URL via the `URL` constructor, iterates `searchParams`, and filters to allowed parameter names.
- Applies value sanitization (if `sanitize.enabled`) and PII filtering (if `piiFiltering.enabled`) as part of the capture pipeline.
- `hasUtmParameters()` checks a `UtmParameters` object for any defined values.

**Sanitizer (`sanitizer.ts`)** cleans UTM parameter values:
- `sanitizeValue()` strips HTML characters, control characters, applies custom patterns, and truncates to max length.
- `sanitizeParams()` applies sanitization to all values in a `UtmParameters` object.

**PII Filter (`pii-filter.ts`)** detects and handles personally identifiable information in parameter values:
- `detectPii()` checks a value against enabled patterns and returns the matching pattern name.
- `filterValue()` either rejects (returns undefined) or redacts (replaces with `[REDACTED]`) based on config mode.
- `filterParams()` applies filtering to all values in a `UtmParameters` object.

**Attribution (`attribution.ts`)** handles first-touch / last-touch storage:
- `storeWithAttribution()` writes params to different storage keys based on attribution mode:
  - `'last'`: writes to the main key only (default, preserves existing behavior).
  - `'first'`: writes to a first-touch suffixed key only if it does not already exist (write-once), plus always writes the main key.
  - `'both'`: writes first-touch (write-once) + last-touch (always) + main key.
- `getAttributedParams()` reads from the appropriate key based on mode and requested touch type. Default touch depends on mode: `'first'` mode defaults to first-touch, others default to last-touch.
- Storage key suffixes default to `_first` and `_last` (configurable via `AttributionConfig`).
- Fires `onStore` callback with a `touch` discriminator (`'first'` or `'last'`).

**Form (`form.ts`)** populates HTML form fields with stored UTM data:
- `populateFormFields()` supports three strategies: `'name'` (match by input name attribute), `'data-attribute'` (match by custom data attribute), and `'auto-create'` (create hidden inputs).
- `createUtmHiddenFields()` is a convenience wrapper that always uses the auto-create strategy.
- Both read stored params from `@/src/common/storage` and are SSR-safe (return 0 when `document` is undefined).

### Things to Know

- **Attribution writes the main key in all modes**: Even in `'first'` and `'both'` modes, the main storage key (without suffix) is always written with the current params. The suffixed keys provide the historical first/last values.
- **First-touch is write-once**: `storeWithAttribution` checks `hasStoredUtmParameters` for the first-touch key before writing. Once set, first-touch params are never overwritten.
- **Data-attribute strategy strips utm_ prefix**: In the `'data-attribute'` strategy, `populateByDataAttribute` strips the `utm_` (or `utm`) prefix and lowercases the remainder to build the short name used in attribute matching (e.g., `utm_source` -> `source`).

Created and maintained by Nori.

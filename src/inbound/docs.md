# Noridoc: inbound

Path: @/src/inbound

### Overview

- Utilities for the inbound data path: receiving UTM-tagged traffic, processing captured parameters, and routing them into storage or form fields.
- Includes URL capture, capture rejection reporting, value sanitization, PII filtering, first-touch/last-touch attribution, and form field population.
- All exports are re-exported through `@/src/index.ts` to package consumers.

### How it fits into the larger codebase

- `@/src/react/useUtmTracking.ts` calls `captureUtmParameters` from this module during its mount-time capture flow.
- `@/src/debug` imports `captureUtmParameters` to build diagnostic snapshots.
- `@/src/server` reuses the *value-level* primitives here (`sanitizeValueWithReport`, `filterValueWithReport`) so server-side normalisation applies the same rules from the same code. It does not reuse the capture pipeline, which is URL-shaped and browser-defaulted. It also imports the `UtmRejection` type from `capture-report.ts` type-only, so server and browser rejections share one vocabulary without pulling browser-coupled code into the server bundle.
- Attribution (`attribution.ts`) and form (`form.ts`) import storage functions from `@/src/common/storage`. These modules are on the forbidden list for `@/src/server` and are structurally unreachable from it.
- Sanitizer and PII filter are invoked during capture when their respective config options are enabled. The config objects (`SanitizeConfig`, `PiiFilterConfig`) come from `@/src/types` and are resolved in `@/src/config`.
- Types (`AttributionConfig`, `TouchType`, `AttributionMode`, `PiiPattern`, etc.) come from `@/src/types`.

### Core Implementation

**Capture (`capture.ts` + `capture-report.ts`)** — there is exactly **one** capture pipeline, and it lives in `capture-report.ts`:

```text
capture.ts :: captureUtmParameters(url, options)   <-- thin wrapper, unchanged signature
        |
        +--> capture-report.ts :: captureUtmParametersWithReport(url, options).params

pipeline (per query parameter):
  isSnakeCaseUtmKey -> allowedParameters -> lowercaseValues -> sanitize -> PII filter
                                                                            |
                            keyFormat conversion -> onCapture -> { params, rejected, invalidUrl }
```

- `captureUtmParametersWithReport` returns `{ params, rejected, invalidUrl }`. It exists so a consumer can tell *"no campaign"* apart from *"campaign arrived and every parameter was filtered"* — collapsing the two inflates the direct-traffic denominator that every campaign share is measured against. `invalidUrl` is a third state again: an unparseable URL is neither.
- `capture.ts` imports the runtime function from `capture-report.ts`; `capture-report.ts` imports the `CaptureOptions` **type** back from `capture.ts`. The back-edge is type-only, erased at build, so there is no runtime cycle.
- Per-parameter processing (not batch `sanitizeParams`/`filterParams`) is what makes rejection attributable to a key.
- `hasUtmParameters()` checks a `UtmParameters` object for any defined values, treating `''` as absent.

**Sanitizer (`sanitizer.ts`)** cleans UTM parameter values. Rule order is:

`stripHtml -> stripControlChars -> customPattern -> trim -> valuePattern -> maxLength`

- `customPattern` is **subtractive** (every match is removed); `valuePattern` is a **positive allowlist gate** (the value is kept intact or dropped whole). `valuePattern` is tested *after* the trim, deliberately, so a value whose only offence is surrounding whitespace this function was about to remove is not rejected.
- `onMaxLength` selects `'truncate'` (cut to `maxLength`, the default and the pre-existing behaviour) or `'drop'` (replace with `''`).
- Rejected values become `''` rather than having the key removed: `hasUtmParameters` already treats `''` as absent, so it is the established "no value" sentinel and a second one would be inconsistent. PII reject mode *does* drop the key — that is pre-existing behaviour and is preserved.
- `sanitizeValueWithReport()` is the real implementation, returning `{ value, rejected? }` where `rejected` is `'maxLength' | 'valuePattern'`. `sanitizeValue()` is a thin wrapper returning `.value`.

**PII Filter (`pii-filter.ts`)** detects and handles personally identifiable information in parameter values:
- `detectPii()` checks a value against enabled patterns and returns the matching pattern name.
- `filterValueWithReport()` is the real implementation, returning `{ value, rejected? }` where `rejected` is `{ reason: 'pii' | 'allowlist', patternName? }`. `filterValue()` is a thin wrapper returning `.value` — undefined in reject mode, `'[REDACTED]'` in redact mode.
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
- **Reports never carry the rejected value.** `UtmRejection` holds a key, a reason, and for PII the pattern *name* only. `PiiFilterConfig.onPiiDetected` already warns that raw values must not be logged or transmitted, and a report struct carrying one would be handed straight to a logger by most consumers who use it. `patternName` is omitted entirely rather than set to `undefined`, so it does not surface in JSON.
- **`lowercaseValues` is folded before every gate**, so `sanitize.customPattern`, `sanitize.valuePattern`, and `piiFiltering.allowlistPattern` can all be written assuming lowercase input. It uses `toLowerCase()`, never `toLocaleLowerCase()` — folding must not depend on locale. Keys are never folded. It lives on `CaptureOptions` rather than `SanitizeConfig` to mirror `BuildUtmUrlOptions.lowercaseValues` on the outbound side, which means it must also be threaded through `UtmConfig` in `@/src/config` for the React path.
- **A value reduced to `''` by ordinary stripping is not a rejection.** That outcome predates the report; reporting it would hand every consumer spurious rejections from long-standing behaviour. Only the gates report.
- **The single-pipeline invariant matters.** Any change to capture semantics belongs in `capture-report.ts`; `captureUtmParameters` cannot drift from it because it is a delegation, not a copy.

Created and maintained by Nori.

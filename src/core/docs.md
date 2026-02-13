# Noridoc: core

Path: @/src/core

### Overview

- Framework-agnostic core logic for capturing UTM parameters from URLs, persisting them in sessionStorage, appending them to outbound URLs, converting between key formats, and validating URLs.
- This is the heart of the library. Every other module (`@/src/react`, `@/src/debug`) builds on top of these utilities.
- All functions are SSR-safe, returning empty/null/unchanged values when browser APIs are unavailable.

### How it fits into the larger codebase

- `@/src/react/useUtmTracking.ts` orchestrates the core modules: it calls `captureUtmParameters` on mount, `storeUtmParameters`/`getStoredUtmParameters` for persistence, `appendUtmParameters` for URL generation, and `convertParams`/`isSnakeCaseUtmKey` for format handling.
- `@/src/debug` imports from `capture` and `storage` to assemble diagnostic snapshots.
- `@/src/index.ts` re-exports everything from this module for direct consumer use without React.
- All modules import types from `@/src/types`.

### Core Implementation

The data flow through the core modules follows this path:

```text
URL string
    |
    v
[capture.ts] -- parses URL, filters to utm_* keys, applies allowedParameters, sanitizes values, filters PII, converts key format
    |
    v
UtmParameters object
    |
    v
[storage.ts] -- serializes to JSON, writes/reads sessionStorage, validates on read
    |
    v
[appender.ts] -- converts params to snake_case, merges into target URL query/fragment
    |
    v
URL string with UTM params
```

- **keys.ts**: Bidirectional key conversion between `snake_case` and `camelCase`. Uses lookup tables (`SNAKE_TO_CAMEL`, `CAMEL_TO_SNAKE`) for the 6 standard keys and regex-based conversion for custom keys. `isSnakeCaseUtmKey` checks for `utm_` prefix; `isCamelCaseUtmKey` checks for `utm` followed by an uppercase letter. `detectKeyFormat` scans keys and returns the first format found, defaulting to `snake_case` for empty objects.

- **capture.ts**: `captureUtmParameters()` takes a URL string (defaulting to `window.location.href`), parses it via `new URL()`, iterates `searchParams`, and filters to keys passing `isSnakeCaseUtmKey`. The pipeline order is: extract params --> filter by allowlist --> sanitize --> PII filter --> convert key format. Both sanitization and PII filtering resolve their config by spreading user-provided partial config over the corresponding `DEFAULT_*` constants from `@/src/config/defaults.ts`, then check `enabled` before running.

- **sanitizer.ts**: `sanitizeValue()` strips dangerous characters from a single string value. Rules apply in order: HTML-significant characters (`< > " ' \``) --> control characters (\x00-\x1F except tab/newline/CR) --> optional custom regex pattern --> trim --> truncate to `maxLength`. `sanitizeParams()` applies `sanitizeValue()` to every non-undefined value in a `UtmParameters` object, returning a new object with keys preserved unchanged. Both functions are pure and stateless; all behavior is driven by the `SanitizeConfig` argument.

- **pii-filter.ts**: `detectPii()` tests a value against an array of `PiiPattern` objects and returns the first match (or null). `filterValue()` checks a single value: if an `allowlistPattern` is configured, the value must match it to pass (allowlist takes precedence over pattern detection); otherwise, it falls back to `detectPii()`. In `reject` mode, detected PII causes the value to be dropped (returns `undefined`); in `redact` mode, the value is replaced with `'[REDACTED]'`. `filterParams()` applies `filterValue()` to every non-undefined value, omitting keys entirely in reject mode when PII is found. The optional `onPiiDetected` callback fires synchronously with `(key, value, patternName)`.

- **storage.ts**: Uses sessionStorage with a configurable key (default: `utm_parameters`). Write operations skip empty param objects and fail silently with `console.warn`. Read operations validate parsed JSON with `isValidStoredData()`, which checks that all keys pass `isUtmKey` and all values are strings or undefined.

- **appender.ts**: `appendUtmParameters()` always converts input params to snake_case before appending to URLs (URL parameters are conventionally snake_case). Supports query string or fragment placement via `AppendOptions.toFragment`. Uses a custom `buildQueryString()` that omits `=` for empty-string values. When adding to query, it also cleans conflicting UTM params from the fragment (and vice versa). `removeUtmParameters()` strips UTM params from both query and fragment. `extractUtmParameters()` pulls UTM params from both locations, with fragment params taking precedence.

- **validator.ts**: `validateUrl()` checks protocol (http/https only), domain (must contain a `.` for TLD), and parsability. `normalizeUrl()` prepends a configurable default protocol (module-level `let defaultProtocol`). `setDefaultProtocol()` mutates this module-level state.

### Things to Know

- **Key invariant**: All URL-facing operations use snake_case keys. The `appender` always converts to snake_case before manipulating URLs, regardless of what format the consumer passes in. This means URLs always contain `utm_source`, never `utmSource`.
- **SSR safety pattern**: Each module that accesses browser APIs (`window`, `sessionStorage`, `URL`, `document`) checks for their existence before use and returns a safe fallback (empty object, null, or unchanged URL). This is consistent across all core modules.
- **Silent failure**: Storage and capture operations never throw. Errors produce `console.warn` messages and return fallback values. The appender returns the original URL unchanged on failure.
- **validator.ts mutable state**: `defaultProtocol` is module-level mutable state modified via `setDefaultProtocol()`. This is global -- all callers share the same default protocol. Tests that call `setDefaultProtocol()` should restore the original value.
- **Fragment parameter handling in appender**: When appending to query, conflicting UTM params are removed from the fragment. When appending to fragment, conflicting UTM params are removed from the query. Only fragments that contain `=` are treated as parameter-bearing; plain anchors like `#section` are left alone.
- **Sanitization and PII filtering are capture-time only**: Both run during `captureUtmParameters()` before values enter the system. They do not run at storage time, append time, or on read. Values stored in sessionStorage are already sanitized/filtered if these features were enabled at capture.
- **PII filter runs after sanitization**: This ordering matters because sanitization may strip characters (e.g., HTML angle brackets) that could affect whether a PII regex matches. By sanitizing first, PII detection operates on the cleaned value.
- **Regex `lastIndex` reset**: Both `sanitizer.ts` (for `customPattern`) and `pii-filter.ts` (for each `PiiPattern.pattern` and `allowlistPattern`) reset `lastIndex = 0` before calling `.test()` or `.replace()`. This prevents stale state when a regex with the `g` flag is reused across calls.

Created and maintained by Nori.

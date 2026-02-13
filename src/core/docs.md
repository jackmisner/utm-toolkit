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

```
URL string
    |
    v
[capture.ts] -- parses URL, filters to utm_* keys, applies allowedParameters, converts key format
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

- **capture.ts**: `captureUtmParameters()` takes a URL string (defaulting to `window.location.href`), parses it via `new URL()`, iterates `searchParams`, and filters to keys passing `isSnakeCaseUtmKey`. Optionally filters by an `allowedParameters` set and converts output via `convertParams`.

- **storage.ts**: Uses sessionStorage with a configurable key (default: `utm_parameters`). Write operations skip empty param objects and fail silently with `console.warn`. Read operations validate parsed JSON with `isValidStoredData()`, which checks that all keys pass `isUtmKey` and all values are strings or undefined.

- **appender.ts**: `appendUtmParameters()` always converts input params to snake_case before appending to URLs (URL parameters are conventionally snake_case). Supports query string or fragment placement via `AppendOptions.toFragment`. Uses a custom `buildQueryString()` that omits `=` for empty-string values. When adding to query, it also cleans conflicting UTM params from the fragment (and vice versa). `removeUtmParameters()` strips UTM params from both query and fragment. `extractUtmParameters()` pulls UTM params from both locations, with fragment params taking precedence.

- **validator.ts**: `validateUrl()` checks protocol (http/https only), domain (must contain a `.` for TLD), and parsability. `normalizeUrl()` prepends a configurable default protocol (module-level `let defaultProtocol`). `setDefaultProtocol()` mutates this module-level state.

### Things to Know

- **Key invariant**: All URL-facing operations use snake_case keys. The `appender` always converts to snake_case before manipulating URLs, regardless of what format the consumer passes in. This means URLs always contain `utm_source`, never `utmSource`.
- **SSR safety pattern**: Each module that accesses browser APIs (`window`, `sessionStorage`, `URL`, `document`) checks for their existence before use and returns a safe fallback (empty object, null, or unchanged URL). This is consistent across all core modules.
- **Silent failure**: Storage and capture operations never throw. Errors produce `console.warn` messages and return fallback values. The appender returns the original URL unchanged on failure.
- **validator.ts mutable state**: `defaultProtocol` is module-level mutable state modified via `setDefaultProtocol()`. This is global -- all callers share the same default protocol. Tests that call `setDefaultProtocol()` should restore the original value.
- **Fragment parameter handling in appender**: When appending to query, conflicting UTM params are removed from the fragment. When appending to fragment, conflicting UTM params are removed from the query. Only fragments that contain `=` are treated as parameter-bearing; plain anchors like `#section` are left alone.

Created and maintained by Nori.

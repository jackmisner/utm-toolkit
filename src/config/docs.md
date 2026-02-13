# Noridoc: config

Path: @/src/config

### Overview

- Defines default configuration values and provides utilities for creating, merging, and validating configuration objects.
- Produces `ResolvedUtmConfig` objects (all fields required) from partial `UtmConfig` input, establishing the configuration contract for the rest of the library.
- Re-exported through `@/src/index.ts` and consumed directly by `@/src/react/useUtmTracking.ts` and `@/src/debug`.

### How it fits into the larger codebase

- `createConfig()` is the primary entry point, called by `useUtmTracking` in `@/src/react` to resolve user-provided partial config into a complete `ResolvedUtmConfig`.
- `@/src/debug` imports `getDefaultConfig()` from here as a fallback when no config is provided to diagnostic functions.
- `DEFAULT_CONFIG` and `STANDARD_UTM_PARAMETERS` are the canonical definitions of default behavior (enabled, snake_case, sessionStorage key `utm_parameters`, auto-capture on mount, append to shares, the 6 standard UTM params).
- `DEFAULT_SANITIZE_CONFIG` defines the sanitization defaults: disabled by default, but with safe-by-default values when enabled (`stripHtml: true`, `stripControlChars: true`, `maxLength: 200`). It is exported as a public constant and spread into `DEFAULT_CONFIG.sanitize`.
- `DEFAULT_PII_PATTERNS` defines built-in PII detection regexes (email, phone_international, phone_uk, phone_us), all enabled by default. `DEFAULT_PII_FILTER_CONFIG` wraps these patterns with `enabled: false` and `mode: 'reject'`. Both are exported as public constants and used in `DEFAULT_CONFIG.piiFiltering`.
- The config system does not perform side effects -- it is pure data transformation.

### Core Implementation

- `createConfig()` merges a partial user config with defaults using nullish coalescing (`??`) for scalar fields. Array fields (`allowedParameters`, `excludeFromShares`) are replaced wholesale when provided by the user, not merged. Object fields (`defaultParams`, `shareContextParams`) are shallow-merged. The `sanitize` field is merged via `mergeSanitizeConfig()` and `piiFiltering` via `mergePiiFilterConfig()`, both using nullish coalescing per-field so partial overrides preserve unspecified defaults. For `piiFiltering`, user-provided `patterns` replace the defaults entirely (array replacement semantics), while scalar fields like `enabled` and `mode` merge individually.
- `mergeConfig()` follows the same semantics but takes a `ResolvedUtmConfig` as the base instead of implicitly using defaults -- useful for layering configurations.
- `loadConfigFromJson()` accepts `unknown` input, validates it is a non-null non-array object, then delegates to `createConfig()`. Invalid input falls back to defaults with a `console.warn`.
- `validateConfig()` performs runtime type checking on each config field and returns an array of error message strings (empty array means valid). Sanitize validation checks that `sanitize` is an object, `enabled`/`stripHtml`/`stripControlChars` are booleans, `maxLength` is a positive finite number, and `customPattern` is a RegExp. PII filtering validation checks that `piiFiltering` is an object, `enabled` is boolean, `mode` is `'reject'` or `'redact'`, and `patterns` is an array.
- `getDefaultConfig()` returns a shallow copy of `DEFAULT_CONFIG` with cloned arrays and objects to prevent mutation of the shared constant. For `piiFiltering`, it deep-copies each pattern object (`patterns.map(p => ({...p}))`) since patterns contain RegExp references that should not be shared.

### Things to Know

- Array replacement (not merge) for `allowedParameters` is intentional: if a consumer provides `allowedParameters: ['utm_source']`, they get only that parameter, not the union with defaults. This is a deliberate design choice.
- `STANDARD_UTM_PARAMETERS` is declared `as const` and used both as the default `allowedParameters` value and as the source of truth in tests. It defines the 6 standard UTM params: source, medium, campaign, term, content, id.
- `validateConfig()` and `createConfig()` are independent -- `createConfig()` does not call `validateConfig()`. Validation is opt-in for consumers who want to check config before using it.

Created and maintained by Nori.

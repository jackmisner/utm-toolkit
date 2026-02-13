# Noridoc: config

Path: @/src/config

### Overview

- Defines default configuration values and provides utilities for creating, merging, and validating configuration objects.
- Produces `ResolvedUtmConfig` objects (all fields required) from partial `UtmConfig` input, establishing the configuration contract for the rest of the library.
- Re-exported through `@/src/index.ts` and consumed directly by `@/src/react/useUtmTracking.ts` and `@/src/debug`.

### How it fits into the larger codebase

- `createConfig()` is the primary entry point, called by `useUtmTracking` in `@/src/react` to resolve user-provided partial config into a complete `ResolvedUtmConfig`.
- `@/src/debug` imports `getDefaultConfig()` from here as a fallback when no config is provided to diagnostic functions.
- `DEFAULT_CONFIG` and `STANDARD_UTM_PARAMETERS` are the canonical definitions of default behavior (enabled, snake_case, `storageType: 'session'`, sessionStorage key `utm_parameters`, no TTL, attribution mode `'last'`, auto-capture on mount, append to shares, the 6 standard UTM params).
- `DEFAULT_ATTRIBUTION_CONFIG` defines attribution defaults: `mode: 'last'` with suffixes `_first` and `_last`. This preserves existing last-touch-only behavior when attribution is not explicitly configured.
- `DEFAULT_SANITIZE_CONFIG` defines the sanitization defaults: disabled by default, but with safe-by-default values when enabled. `DEFAULT_PII_PATTERNS` and `DEFAULT_PII_FILTER_CONFIG` define PII detection defaults.
- Event callbacks (`onCapture`, `onStore`, `onClear`, `onAppend`, `onExpire`) are passed through from user config via `createConfig()` and `mergeConfig()` -- they have no defaults (undefined when not provided).
- The config system does not perform side effects -- it is pure data transformation.

### Core Implementation

- `createConfig()` merges a partial user config with defaults using nullish coalescing (`??`) for scalar fields, including `storageType`, `ttl`, and event callbacks. Array fields (`allowedParameters`, `excludeFromShares`) are replaced wholesale when provided by the user, not merged. Object fields (`defaultParams`, `shareContextParams`) are shallow-merged. Nested config objects (`sanitize`, `piiFiltering`, `attribution`) each have dedicated merge functions that apply nullish coalescing per-field so partial overrides preserve unspecified defaults.
- `mergeAttributionConfig()` merges `mode`, `firstTouchSuffix`, and `lastTouchSuffix` with nullish coalescing, following the same pattern as other nested configs.
- `mergeConfig()` follows the same semantics but takes a `ResolvedUtmConfig` as the base instead of implicitly using defaults -- useful for layering configurations. It also forwards event callbacks with nullish coalescing.
- `loadConfigFromJson()` accepts `unknown` input, validates it is a non-null non-array object, then delegates to `createConfig()`. Invalid input falls back to defaults with a `console.warn`.
- `validateConfig()` performs runtime type checking on each config field and returns an array of error message strings (empty array means valid). It validates `storageType` as `'session'` or `'local'`, `ttl` as a positive finite number, plus nested validation for `sanitize` and `piiFiltering` sub-objects.
- `getDefaultConfig()` returns a shallow copy of `DEFAULT_CONFIG` with cloned arrays and objects (including deep-copied PII patterns and attribution config) to prevent mutation of the shared constant.

### Things to Know

- Array replacement (not merge) for `allowedParameters` is intentional: if a consumer provides `allowedParameters: ['utm_source']`, they get only that parameter, not the union with defaults. This is a deliberate design choice.
- `STANDARD_UTM_PARAMETERS` is declared `as const` and used both as the default `allowedParameters` value and as the source of truth in tests.
- `validateConfig()` and `createConfig()` are independent -- `createConfig()` does not call `validateConfig()`. Validation is opt-in for consumers who want to check config before using it.

Created and maintained by Nori.

# Noridoc: types

Path: @/src/types

### Overview

- Central type definitions for the entire library, consumed by `@/src/core`, `@/src/config`, `@/src/debug`, and `@/src/react`.
- Defines the dual key format system (`snake_case` for URLs, `camelCase` for TypeScript) that is a core invariant of the library.
- All types are re-exported through `@/src/index.ts` to package consumers.

### How it fits into the larger codebase

- Every other module in the library imports types from here. This is the single source of truth for all shared interfaces and type aliases.
- The `UtmParameters` union type (`UtmParametersSnake | UtmParametersCamel`) is the fundamental data shape that flows through capture, storage, appending, and React state.
- `UtmConfig` and `ResolvedUtmConfig` define the configuration contract: partial config goes in from consumers, fully-resolved config comes out from `@/src/config`.
- `UseUtmTrackingReturn` and `UtmProviderProps` define the React integration contract used by `@/src/react`.
- `SnakeCaseUtmKey` uses a template literal type (`utm_${string}`) that enables support for custom UTM parameters beyond the standard ones, which drives the extensibility design in `@/src/core/keys.ts` and `@/src/core/capture.ts`.

### Core Implementation

- `KeyFormat` is a string literal union (`'snake_case' | 'camelCase'`) that controls key conversion throughout the library.
- `UtmParametersSnake` uses an index signature `[key: \`utm_${string}\`]` to accept arbitrary `utm_*` keys while also declaring the standard ones explicitly. `UtmParametersCamel` uses a broader `[key: string]` index signature since TypeScript template literals cannot express the camelCase pattern.
- `ResolvedUtmConfig` mirrors `UtmConfig` but with all fields required -- it represents the result of merging user-provided partial config with defaults.
- `ShareContextParams` uses `Partial<Record<SharePlatform, UtmParameters>>` with a `default` key for base params and platform-specific overrides, enabling a layered merge strategy in `useUtmTracking`'s `appendToUrl` callback.
- `AppendOptions` controls whether UTM params go into query string or fragment, and whether existing UTM params on the target URL are preserved.
- `SanitizeConfig` defines value sanitization behavior with fields for `enabled`, `stripHtml`, `stripControlChars`, `maxLength`, and an optional `customPattern` (RegExp). It appears as `Partial<SanitizeConfig>` on `UtmConfig` (user input) and as a required `SanitizeConfig` on `ResolvedUtmConfig` (resolved output). This follows the same partial-in/resolved-out pattern used by the rest of the config system.
- `PiiPattern` defines a named regex pattern with an `enabled` toggle. `PiiFilterConfig` groups these patterns with a `mode` (`'reject'` or `'redact'`), an optional `allowlistPattern` (RegExp for strict validation), and an optional synchronous `onPiiDetected` callback. Like `SanitizeConfig`, it appears as `Partial<PiiFilterConfig>` on `UtmConfig` and as a required `PiiFilterConfig` on `ResolvedUtmConfig`.

### Things to Know

- `UtmParameters` is a union, not an intersection. Code that receives it must handle either format, typically by detecting the format or converting via `@/src/core/keys.ts`.
- `SharePlatform` is `'linkedin' | 'twitter' | 'facebook' | 'copy' | string` -- the named platforms are documentation aids, but any string is accepted.
- `DiagnosticInfo` is only used by `@/src/debug` and is meant for development-time inspection, not production data flow.
- New features use a nested config object pattern (e.g., `sanitize: SanitizeConfig`) rather than adding flat fields to `UtmConfig`. Existing flat fields remain unchanged for backward compatibility.

Created and maintained by Nori.

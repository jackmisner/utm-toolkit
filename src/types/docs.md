# Noridoc: types

Path: @/src/types

### Overview

- Central type definitions for the entire library, consumed by `@/src/inbound`, `@/src/outbound`, `@/src/common`, `@/src/config`, `@/src/debug`, and `@/src/react`.
- Defines the dual key format system (`snake_case` for URLs, `camelCase` for TypeScript), storage backend selection, attribution modes, and event callback signatures that are core invariants of the library.
- All types are re-exported through `@/src/index.ts` to package consumers.

### How it fits into the larger codebase

- Every other module in the library imports types from here. This is the single source of truth for all shared interfaces and type aliases.
- The `UtmParameters` union type (`UtmParametersSnake | UtmParametersCamel`) is the fundamental data shape that flows through capture, storage, appending, and React state.
- `UtmConfig` and `ResolvedUtmConfig` define the configuration contract: partial config goes in from consumers, fully-resolved config comes out from `@/src/config`. These interfaces carry storage configuration (`storageType`, `ttl`), attribution configuration, and event callbacks.
- `UseUtmTrackingReturn` defines the React hook contract including `firstTouchParams` and `lastTouchParams` for attribution mode support.
- `SnakeCaseUtmKey` uses a template literal type (`utm_${string}`) that enables support for custom UTM parameters beyond the standard ones, which drives the extensibility design in `@/src/common/keys.ts` and `@/src/inbound/capture.ts`.

### Core Implementation

- `KeyFormat` (`'snake_case' | 'camelCase'`) controls key conversion throughout the library. `StorageType` (`'session' | 'local'`) controls which browser storage backend is used.
- `AttributionMode` (`'last' | 'first' | 'both'`) determines how UTM parameters are stored relative to user visits. `TouchType` (`'first' | 'last'`) selects which touch to read. `AttributionConfig` groups these with configurable key suffixes (`firstTouchSuffix`, `lastTouchSuffix`).
- `UtmParametersSnake` uses an index signature `[key: \`utm_${string}\`]` to accept arbitrary `utm_*` keys while also declaring the standard ones explicitly. `UtmParametersCamel` uses a broader `[key: string]` index signature since TypeScript template literals cannot express the camelCase pattern.
- `ResolvedUtmConfig` mirrors `UtmConfig` but with all fields required (except `ttl` and event callbacks, which remain optional) -- it represents the result of merging user-provided partial config with defaults. Includes `storageType` (defaulting to `'session'`), optional `ttl` (milliseconds, only meaningful for localStorage), `attribution` config, and lifecycle callbacks (`onCapture`, `onStore`, `onClear`, `onAppend`, `onExpire`).
- Event callback signatures on `UtmConfig`/`ResolvedUtmConfig`: `onCapture(params)`, `onStore(params, meta)` where meta includes `storageType` and optional `touch`, `onClear()`, `onAppend(url, params)`, `onExpire(storageKey)`.
- `SanitizeConfig` and `PiiFilterConfig` follow the partial-in/resolved-out pattern: `Partial<>` on `UtmConfig` (user input), required on `ResolvedUtmConfig` (resolved output).

### Things to Know

- `UtmParameters` is a union, not an intersection. Code that receives it must handle either format, typically by detecting the format or converting via `@/src/common/keys.ts`.
- `SharePlatform` is `'linkedin' | 'twitter' | 'facebook' | 'copy' | string` -- the named platforms are documentation aids, but any string is accepted.
- `DiagnosticInfo` is only used by `@/src/debug` and is meant for development-time inspection, not production data flow.
- New features use a nested config object pattern (e.g., `sanitize: SanitizeConfig`, `attribution: AttributionConfig`) rather than adding flat fields to `UtmConfig`. The exceptions are `storageType`, `ttl`, and event callbacks, which exist as flat fields.

Created and maintained by Nori.

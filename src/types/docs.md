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
- `SanitizeConfig` carries two distinct kinds of value rule. `customPattern` is **subtractive** (matches are stripped out of the value); `valuePattern` is a **positive allowlist gate** (the value is kept whole or replaced with `''`). `onMaxLength` (`'truncate' | 'drop'`) selects what happens to an over-length value — `'truncate'` is the default and preserves the original behaviour, `'drop'` is what a consumer keying a datastore wants, since a truncated value is one nobody sent.
- `UtmConfig.lowercaseValues` (mirrored required on `ResolvedUtmConfig`) is a **flat** field rather than part of `SanitizeConfig`, deliberately mirroring `BuildUtmUrlOptions.lowercaseValues` on the outbound side. It is forwarded to `CaptureOptions.lowercaseValues` by the React path.

### Things to Know

- `UtmParameters` is a union, not an intersection. Code that receives it must handle either format, typically by detecting the format or converting via `@/src/common/keys.ts`.
- `SharePlatform` is `'linkedin' | 'twitter' | 'facebook' | 'copy' | string` -- the named platforms are documentation aids, but any string is accepted.
- `DiagnosticInfo` is only used by `@/src/debug` and is meant for development-time inspection, not production data flow.
- New features use a nested config object pattern (e.g., `sanitize: SanitizeConfig`, `attribution: AttributionConfig`) rather than adding flat fields to `UtmConfig`. The exceptions are `storageType`, `ttl`, event callbacks, and `lowercaseValues`, which exist as flat fields.
- Rejection types (`UtmRejection`, `UtmRejectionReason`, `SanitizeRejection`, `PiiRejection`) are **not** defined here — they live next to the code that produces them in `@/src/inbound`, and `@/src/server` re-exports `UtmRejection` type-only so both entry points describe rejections with one vocabulary.
- Server-side normalisation options (`ServerNormalizeOptions`) are also defined locally in `@/src/server`, not here, because they are a different contract from `UtmConfig` — they configure a stateless pure function, not a stateful browser session.

Created and maintained by Nori.

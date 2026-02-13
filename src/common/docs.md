# Noridoc: common

Path: @/src/common

### Overview

- Shared utilities used by both `@/src/inbound` and `@/src/outbound` pathways: browser storage persistence, UTM key format conversion, and URL validation.
- All exports are re-exported through `@/src/index.ts` to package consumers.
- Framework-agnostic and SSR-safe throughout.

### How it fits into the larger codebase

- `@/src/inbound` imports storage functions for persisting captured UTM params, key functions for format detection and conversion, and validator for URL checks.
- `@/src/outbound` imports storage for reading stored params (in decorator and builder), key functions for format conversion (in appender), and validator for URL normalization/validation (in builder and appender).
- `@/src/react` imports storage functions, key conversion, and config-based options directly from this module.
- `@/src/debug` imports `getStoredUtmParameters`, `isStorageAvailable`, and `getRawStoredValue` from storage.
- Types (`KeyFormat`, `StorageType`, `UtmParameters`) come from `@/src/types`.

### Core Implementation

**Storage (`storage.ts`)** manages persistence in sessionStorage or localStorage:

- Data is stored in an **envelope format**: `{ params: UtmParameters, iat: number, eat: number | null }` where `iat` is issued-at timestamp and `eat` is expires-at (null means no expiry).
- `getStorageBackend(type)` is a private helper that returns the `Storage` object (sessionStorage or localStorage) after verifying it is functional via a test write/read. Returns null if unavailable.
- `storeUtmParameters()` converts params to the target key format, computes `eat` from TTL (only for localStorage; TTL is ignored for sessionStorage), wraps in an envelope, and writes to storage. Fires optional `onStore` callback in a try-catch.
- `getStoredUtmParameters()` reads and parses stored data. Detects whether data is in envelope format (via `isEnvelopeFormat()` which checks for `params`, `iat`, and `eat` fields) or flat format (backward compatibility). For envelopes, checks TTL expiration and auto-clears expired data, firing optional `onExpire` callback. For flat format data, validates and returns directly.
- `clearStoredUtmParameters()` has an overloaded signature: accepts either a `ClearOptions` object or positional `(storageKey, storageType)` arguments for backward compatibility. Fires optional `onClear` callback.
- `isStorageAvailable(type)` is the public availability check. `isSessionStorageAvailable()` is deprecated in favor of `isStorageAvailable('session')`. `isLocalStorageAvailable()` is a convenience wrapper.

**Keys (`keys.ts`)** handles bidirectional conversion between `snake_case` and `camelCase` UTM key formats. Maintains lookup maps (`SNAKE_TO_CAMEL`, `CAMEL_TO_SNAKE`) for the 6 standard UTM params and handles custom `utm_*` keys via algorithmic conversion.

**Validator (`validator.ts`)** provides URL validation and normalization. Checks protocol allowlists, domain validity, and adds protocols when missing. Has module-level mutable state for the default protocol (see CLAUDE.md gotchas).

### Things to Know

- **Envelope backward compatibility**: `isEnvelopeFormat()` requires all three fields (`params`, `iat`, `eat`) with correct types. Data stored by older library versions (flat `UtmParameters` objects without an envelope) is handled as a fallback path in `getStoredUtmParameters()`.
- **TTL is only meaningful for localStorage**: When `storageType` is `'session'`, `eat` is always set to `null` regardless of `ttl` value, because sessionStorage already expires on tab/browser close.
- **TTL uses explicit type check**: The TTL computation uses `typeof ttl === 'number' && ttl > 0` rather than a truthy check, to correctly handle the edge case where `ttl === 0`.
- **All callbacks are try-catch wrapped**: `onStore`, `onExpire`, and `onClear` callbacks are individually wrapped so a throwing callback never breaks the storage pipeline.
- **`validator.ts` has mutable module-level state**: `defaultProtocol` is mutable via `setDefaultProtocol()`. Tests that call this must restore the original value.

Created and maintained by Nori.

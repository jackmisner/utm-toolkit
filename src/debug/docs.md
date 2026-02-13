# Noridoc: debug

Path: @/src/debug

### Overview

- Development-time diagnostic utilities for inspecting UTM tracking state (config, URL params, stored params, storage availability).
- Provides console-formatted output, status check messages, and an opt-in `window.utmDebug` helper object for browser console access.
- Not part of the production data flow; intended for troubleshooting.

### How it fits into the larger codebase

- Imports `captureUtmParameters` from `@/src/inbound/capture`, `getStoredUtmParameters`/`isStorageAvailable`/`getRawStoredValue` from `@/src/common/storage`, and `getDefaultConfig` from `@/src/config/defaults`.
- Re-exported through `@/src/index.ts` so consumers can call these functions directly.
- Does not depend on or interact with `@/src/react` -- it operates on the inbound/common layers only.
- All functions accept an optional `ResolvedUtmConfig`; when omitted, they fall back to `getDefaultConfig()`.

### Core Implementation

- `getDiagnostics()` assembles a `DiagnosticInfo` snapshot: resolves config, captures URL params via `captureUtmParameters`, reads stored params via `getStoredUtmParameters` (passing `storageType` from config), and checks `isStorageAvailable(config.storageType)`. SSR-safe (returns empty URL and empty params when `window` is unavailable).
- `debugUtmState()` calls `getDiagnostics()` and formats output using `console.group`/`console.table`. Logs `storageType` alongside key format and storage key.
- `checkUtmTracking()` calls `getDiagnostics()` and returns an array of status strings with emoji prefixes indicating state. The storage-unavailable warning message dynamically uses `localStorage` or `sessionStorage` based on `config.storageType`.
- `installDebugHelpers()` checks for `?debug_utm=true` in the URL query string. If present, it attaches a `window.utmDebug` object with `state()`, `check()`, `diagnostics()`, and `raw()` methods. The `raw()` helper reads from the correct storage backend based on `config.storageType`.

### Things to Know

- `installDebugHelpers()` is gated solely by the `debug_utm=true` URL parameter. It does not check `process.env` or `import.meta.env.DEV`.
- The `window.utmDebug` object is attached via a cast to `Record<string, unknown>` to avoid TypeScript errors on the global augmentation.
- `checkUtmTracking()` detects a potential timing issue: when URL params exist but storage is empty and `captureOnMount` is enabled, it warns that the hook may not have initialized yet.

Created and maintained by Nori.

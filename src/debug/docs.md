# Noridoc: debug

Path: @/src/debug

### Overview

- Development-time diagnostic utilities for inspecting UTM tracking state (config, URL params, stored params, storage availability).
- Provides console-formatted output, status check messages, and an opt-in `window.utmDebug` helper object for browser console access.
- Not part of the production data flow; intended for troubleshooting.

### How it fits into the larger codebase

- Imports `captureUtmParameters` from `@/src/core/capture`, `getStoredUtmParameters`/`isStorageAvailable`/`getRawStoredValue` from `@/src/core/storage`, and `getDefaultConfig` from `@/src/config/defaults`.
- Re-exported through `@/src/index.ts` so consumers can call these functions directly.
- Does not depend on or interact with `@/src/react` -- it operates on the core layer only.
- All functions accept an optional `ResolvedUtmConfig`; when omitted, they fall back to `getDefaultConfig()`.

### Core Implementation

- `getDiagnostics()` assembles a `DiagnosticInfo` snapshot: resolves config, captures URL params via `captureUtmParameters`, reads stored params via `getStoredUtmParameters` (passing `storageType` from config), and checks `isStorageAvailable(config.storageType)`. SSR-safe (returns empty URL and empty params when `window` is unavailable).
- `debugUtmState()` calls `getDiagnostics()` and formats output using `console.group`/`console.table` for structured browser console display.
- `checkUtmTracking()` calls `getDiagnostics()` and returns an array of status strings with emoji prefixes indicating state (e.g., whether params are in the URL, in storage, or if there is a mismatch suggesting the hook has not initialized yet). The storage-unavailable warning message dynamically uses `localStorage` or `sessionStorage` based on `config.storageType`.
- `installDebugHelpers()` checks for `?debug_utm=true` in the URL query string. If present, it attaches a `window.utmDebug` object with `state()`, `check()`, `diagnostics()`, and `raw()` methods. Only activates in browser environments.

### Things to Know

- `installDebugHelpers()` is gated solely by the `debug_utm=true` URL parameter. It does not check `process.env` or `import.meta.env.DEV`.
- The `window.utmDebug` object is attached via a cast to `Record<string, unknown>` to avoid TypeScript errors on the global augmentation.
- `checkUtmTracking()` detects a potential timing issue: when URL params exist but storage is empty and `captureOnMount` is enabled, it warns that the hook may not have initialized yet.

Created and maintained by Nori.

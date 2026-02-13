# Noridoc: __tests__

Path: @/__tests__

### Overview

- Test suite for the library, mirroring the `@/src` directory structure with subdirectories for `config/`, `core/`, and `react/`.
- Uses vitest with jsdom environment, `@testing-library/react` for React component/hook tests, and a global setup file for browser API mocks.
- Coverage thresholds are enforced at 80% for statements, branches, functions, and lines (configured in `@/vitest.config.ts`).

### How it fits into the larger codebase

- Tests exercise all public API surfaces from `@/src/core`, `@/src/config`, and `@/src/react`.
- Coverage excludes barrel `index.ts` files and the `@/src/types` directory, since these contain only re-exports and type definitions.
- The test setup (`setup.ts`) provides the mock environment that all tests rely on: a sessionStorage mock backed by a plain object with `vi.fn()` wrappers, and a `window.location` mock defaulting to `https://example.com`.
- CI runs tests across Node 18, 20, and 22.

### Core Implementation

- **`setup.ts`**: Creates fresh sessionStorage and localStorage mocks and a location mock in `beforeEach`, ensuring tests are isolated. Both storage mocks implement `getItem`, `setItem`, `removeItem`, `clear`, `length`, and `key`. Location is stubbed with `href`, `search`, `hash`, `pathname`, `protocol`, `host`, and `hostname`.
- **`core/` tests**: Cover capture (URL parsing, allowed parameters, key format conversion, SSR fallback, sanitization integration, PII filtering integration), sanitizer (HTML stripping, control character removal, custom patterns, truncation, combined rules), pii-filter (pattern detection, reject/redact modes, allowlist, callback, disabled patterns, edge cases), storage (write/read/clear, format conversion, validation of stored data, silent failure, localStorage backend, envelope format, TTL expiration with fake timers, backward compatibility with flat format data, `isStorageAvailable`/`isLocalStorageAvailable` availability checks), appender (query/fragment placement, preserveExisting, remove, extract), keys (bidirectional conversion, standard and custom keys, detection, validation), and validator (protocol, domain, normalization, mutable default protocol).
- **`config/` tests**: Cover `createConfig` merging semantics (nullish coalescing, array replacement, object merge, `storageType` and `ttl` merging), `validateConfig` error messages (including `storageType` and `ttl` validation), `loadConfigFromJson` fallback behavior, sanitize config handling (default inclusion, partial merge, custom pattern preservation, validation of each sanitize field), and piiFiltering config handling (default inclusion, partial merge, custom patterns replacement, mode validation).
- **`react/` tests**: Use `@testing-library/react` `renderHook` and `render` to test `useUtmTracking` (auto-capture, manual capture, clear, appendToUrl with share context and exclusions, sanitization, PII filtering, `storageType` forwarding to storage calls) and `UtmProvider`/`useUtmContext` (context propagation, error on missing provider).

### Things to Know

- Both the sessionStorage and localStorage mocks use `vi.fn()` wrappers, which means tests can assert on call counts and arguments (e.g., `sessionStorage.setItem` or `localStorage.setItem` calls).
- `window.location` is stubbed globally rather than using JSDOM's location, so tests that need specific URLs must override `location.href` and `location.search` in their setup.
- The `beforeEach` in `setup.ts` resets both storage mocks and the location mock, so each test starts with empty storage and a clean `https://example.com` location.

Created and maintained by Nori.

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

- **`setup.ts`**: Creates a fresh sessionStorage mock and location mock in `beforeEach`, ensuring tests are isolated. The storage mock implements `getItem`, `setItem`, `removeItem`, `clear`, `length`, and `key`. Location is stubbed with `href`, `search`, `hash`, `pathname`, `protocol`, `host`, and `hostname`.
- **`core/` tests**: Cover capture (URL parsing, allowed parameters, key format conversion, SSR fallback, sanitization integration), sanitizer (HTML stripping, control character removal, custom patterns, truncation, combined rules), storage (write/read/clear, format conversion, validation of stored data, silent failure), appender (query/fragment placement, preserveExisting, remove, extract), keys (bidirectional conversion, standard and custom keys, detection, validation), and validator (protocol, domain, normalization, mutable default protocol).
- **`config/` tests**: Cover `createConfig` merging semantics (nullish coalescing, array replacement, object merge), `validateConfig` error messages, `loadConfigFromJson` fallback behavior, and sanitize config handling (default inclusion, partial merge, custom pattern preservation, validation of each sanitize field).
- **`react/` tests**: Use `@testing-library/react` `renderHook` and `render` to test `useUtmTracking` (auto-capture, manual capture, clear, appendToUrl with share context and exclusions) and `UtmProvider`/`useUtmContext` (context propagation, error on missing provider).

### Things to Know

- The sessionStorage mock uses `vi.fn()` wrappers, which means tests can assert on call counts and arguments (`sessionStorage.setItem` calls, etc.).
- `window.location` is stubbed globally rather than using JSDOM's location, so tests that need specific URLs must override `location.href` and `location.search` in their setup.
- The `beforeEach` in `setup.ts` resets both mocks, so each test starts with empty storage and a clean `https://example.com` location.

Created and maintained by Nori.

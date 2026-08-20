# Noridoc: __tests__

Path: @/__tests__

### Overview

- Test suite for the library, mirroring the `@/src` directory structure with subdirectories for `common/`, `inbound/`, `outbound/`, `config/`, `react/`, and `server/`.
- Uses vitest with jsdom environment, `@testing-library/react` for React component/hook tests, and a global setup file for browser API mocks.
- Coverage thresholds are enforced at 80% for statements, branches, functions, and lines (configured in `@/vitest.config.ts`).

### How it fits into the larger codebase

- Tests exercise all public API surfaces from `@/src/common`, `@/src/inbound`, `@/src/outbound`, `@/src/config`, and `@/src/react`.
- Coverage excludes barrel `index.ts` files and the `@/src/types` directory, since these contain only re-exports and type definitions.
- The test setup (`setup.ts`) provides the mock environment that all tests rely on: sessionStorage and localStorage mocks backed by plain objects with `vi.fn()` wrappers, and a `window.location` mock defaulting to `https://example.com`.
- CI runs tests across Node 18, 20, and 22.

### Core Implementation

- **`setup.ts`**: Creates fresh sessionStorage and localStorage mocks and a location mock in `beforeEach`, ensuring tests are isolated. Both storage mocks implement `getItem`, `setItem`, `removeItem`, `clear`, `length`, and `key`. Location is stubbed with `href`, `search`, `hash`, `pathname`, `protocol`, `host`, and `hostname`.
- **`common/` tests**: Cover storage (write/read/clear, format conversion, validation of stored data, silent failure, localStorage backend, envelope format, TTL expiration with fake timers, backward compatibility with flat format data, availability checks, event callbacks), keys (bidirectional conversion, standard and custom keys, detection, validation), validator (protocol, domain, normalization, mutable default protocol), and event callback integration.
- **`inbound/` tests**: Cover capture (URL parsing, allowed parameters, key format conversion, SSR fallback, sanitization integration, PII filtering integration), sanitizer (HTML stripping, control character removal, custom patterns, truncation), pii-filter (pattern detection, reject/redact modes, allowlist, callback), attribution (first-touch/last-touch/both modes, write-once semantics), and form field population (name/data-attribute/auto-create strategies).
- **`outbound/` tests**: Cover appender (query/fragment placement, preserveExisting, remove, extract), builder (structured URL construction, validation, warnings, lowercase option), and decorator (link decoration, host filtering, skip-existing, MutationObserver).
- **`config/` tests**: Cover `createConfig` merging semantics (including `storageType`, `ttl`, attribution, and event callbacks), `validateConfig` error messages, `loadConfigFromJson` fallback behavior, and nested config merging for sanitize and piiFiltering.
- **`react/` tests**: Use `@testing-library/react` `renderHook` and `render` to test `useUtmTracking` (auto-capture, manual capture, clear, appendToUrl, `storageType` forwarding, attribution params, capture-option forwarding such as `lowercaseValues`), `UtmProvider`/`useUtmContext`, `UtmHiddenFields`, and `UtmLinkDecorator`.
- **`server/` tests**: Cover `normalizeUtmParams`/`normalizeUtmUrl` behaviour (totality of the output record, never throwing on hostile input, non-string rejection rather than coercion, `__proto__` keys, server default divergence) plus an **architectural test** described below.

### Things to Know

- Both the sessionStorage and localStorage mocks use `vi.fn()` wrappers, which means tests can assert on call counts and arguments (e.g., `sessionStorage.setItem` or `localStorage.setItem` calls).
- `window.location` is stubbed globally rather than using JSDOM's location, so tests that need specific URLs must override `location.href` and `location.search` in their setup.
- The `beforeEach` in `setup.ts` resets both storage mocks and the location mock, so each test starts with empty storage and a clean `https://example.com` location.
- **`server/isolation.test.ts` tests architecture, not behaviour.** It reads source files off disk and walks the transitive **runtime** import graph out of `@/src/server/index.ts`, failing if it reaches a forbidden module (storage, form, attribution, appender, decorator, debug, react) or if any reachable file mentions `window`/`document`/`sessionStorage`/`localStorage`. The `/server` entry's whole value rests on an import restriction, which is only real if something checks it — otherwise the next convenient re-export silently removes the guarantee.
- The walk deliberately **does not follow `import type` / `export type`**, because those are erased at build and cannot pull browser code into the bundle. Following them would flag the legitimate type-only import of `UtmRejection` from `@/src/inbound/capture-report.ts`. Comments are stripped before scanning, so a docblock mentioning `sessionStorage` is not read as a use of it.
- Because the isolation test parses import statements textually, unusual import syntax (dynamic `import()`, side-effect-only imports without a `from` clause) is outside what it inspects.

Created and maintained by Nori.

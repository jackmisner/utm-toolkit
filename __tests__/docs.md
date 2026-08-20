# Noridoc: __tests__

Path: @/__tests__

### Overview

- Test suite for the library, mirroring the `@/src` directory structure one subdirectory per source folder.
- Uses vitest with jsdom environment, `@testing-library/react` for React component/hook tests, and a global setup file for browser API mocks.
- Coverage thresholds are enforced at 80% for statements, branches, functions, and lines (configured in `@/vitest.config.ts`).

### How it fits into the larger codebase

- Tests exercise every public API surface in `@/src`, across all three package entry points (root, `/react`, `/server`).
- Coverage excludes barrel `index.ts` files and the `@/src/types` directory, since these contain only re-exports and type definitions.
- The test setup (`setup.ts`) provides the mock environment that all tests rely on: sessionStorage and localStorage mocks backed by plain objects with `vi.fn()` wrappers, and a `window.location` mock defaulting to `https://example.com`.
- CI runs tests across Node 18, 20, and 22.

### Core Implementation

- **`setup.ts`**: Creates fresh sessionStorage and localStorage mocks and a location mock in `beforeEach`, ensuring tests are isolated. Both storage mocks implement `getItem`, `setItem`, `removeItem`, `clear`, `length`, and `key`. Location is stubbed with `href`, `search`, `hash`, `pathname`, `protocol`, `host`, and `hostname`.
- **`common/` tests**: Cover storage (write/read/clear, format conversion, validation of stored data, silent failure, localStorage backend, envelope format, TTL expiration with fake timers, backward compatibility with flat format data, availability checks, event callbacks), keys (bidirectional conversion, standard and custom keys, detection, validation), validator (protocol, domain, normalization, mutable default protocol), and event callback integration.
- **`inbound/` tests**: Cover capture (URL parsing, allowed parameters, key format conversion, SSR fallback, sanitization integration, PII filtering integration), sanitizer (HTML stripping, control character removal, custom patterns, truncation), pii-filter (pattern detection, reject/redact modes, allowlist, callback), attribution (first-touch/last-touch/both modes, write-once semantics), and form field population (name/data-attribute/auto-create strategies). Capture coverage includes the ordering-sensitive cases the two-phase pipeline exists for — duplicate parameters whose surviving occurrence is or is not PII, and malformed config degrading to empty rather than throwing.
- **`outbound/` tests**: Cover appender (query/fragment placement, preserveExisting, remove, extract), builder (structured URL construction, validation, warnings, lowercase option), and decorator (link decoration, host filtering, skip-existing, MutationObserver).
- **`config/` tests**: Cover `createConfig` merging semantics (including `storageType`, `ttl`, attribution, and event callbacks), `validateConfig` error messages, `loadConfigFromJson` fallback behavior, and nested config merging for sanitize and piiFiltering. Merge coverage always passes an **explicit override object** — `createConfig()` with no argument early-returns the defaults without merging, so it cannot detect a field the merge functions drop.
- **`debug/` tests**: Assert that `getDiagnostics` reports what the real pipeline would produce (sanitisation, PII filtering and folding applied) and that it does **not** fire `onCapture`.
- **`react/` tests**: Use `@testing-library/react` `renderHook` and `render` to test `useUtmTracking` (auto-capture, manual capture, clear, appendToUrl, `storageType` forwarding, attribution params, capture-option forwarding such as `lowercaseValues`), `UtmProvider`/`useUtmContext`, `UtmHiddenFields`, and `UtmLinkDecorator`.
- **`server/` tests**: Cover `normalizeUtmParams`/`normalizeUtmUrl` behaviour (totality of the output record, non-string rejection rather than coercion, `__proto__` keys, server default divergence) plus an **architectural test** described below. The never-throws contract is exercised against the objects that can actually break it — throwing getters, hostile and revoked Proxies, malformed caller-supplied regexes, and a non-array `allowedParameters`.

### Things to Know

- Both the sessionStorage and localStorage mocks use `vi.fn()` wrappers, which means tests can assert on call counts and arguments (e.g., `sessionStorage.setItem` or `localStorage.setItem` calls).
- `window.location` is stubbed globally rather than using JSDOM's location, so tests that need specific URLs must override `location.href` and `location.search` in their setup.
- The `beforeEach` in `setup.ts` resets both storage mocks and the location mock, so each test starts with empty storage and a clean `https://example.com` location.
- **`server/isolation.test.ts` tests architecture, not behaviour.** It reads source files off disk and walks the transitive **runtime** import graph out of `@/src/server/index.ts`, failing if it reaches a forbidden module (storage, form, attribution, appender, decorator, debug, react) or if any reachable file mentions `window`/`document`/`sessionStorage`/`localStorage`. The `/server` entry's whole value rests on an import restriction, which is only real if something checks it — otherwise the next convenient re-export silently removes the guarantee.
- The walk deliberately **does not follow `import type` / `export type`**, because those are erased at build and cannot pull browser code into the bundle. Following them would flag the legitimate type-only import of `UtmRejection` from `@/src/inbound/capture-report.ts`. Comments are stripped before scanning, so a docblock mentioning `sessionStorage` is not read as a use of it — with a guard so `https://` inside a string literal is not mistaken for a line comment, which would swallow the rest of that line and any `window` reference after it.
- **Everything the walk cannot see is a hole in the guarantee, so the walk is built to fail loudly rather than under-report.** It follows side-effect imports (`import './x'`) and dynamic `import('./x')` as well as ordinary statements — neither form exists in `@/src` today, but both are how someone reintroduces storage later. Bare (non-relative) specifiers are collected and asserted **empty**, since the package ships no runtime dependencies and a relative-path check cannot see `import 'react'`. An unresolvable relative specifier **throws**: a specifier the walk skipped is a blind spot, not a pass.
- **The isolation test needs its own positive control.** If the regexes parsed nothing, every "does not reach X" assertion would pass vacuously, so a separate case pins modules reached two hops out through real runtime imports (the sanitizer, PII filter and config defaults), not just the entry and its immediate neighbour.
- **An equivalence test between a wrapper and its delegate proves nothing.** `captureUtmParameters` *is* `captureUtmParametersWithReport(...).params`, so `inbound/capture-report.test.ts` comparing the two asserted `x === x` and passed against any pipeline however wrong — which is how a duplicate-parameter regression got through. It now checks **golden values** captured from the pre-refactor behaviour, including the duplicate cases, so it pins behaviour rather than self-consistency.

Created and maintained by Nori.

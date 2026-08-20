# Noridoc: src

Path: @/src

### Overview

- Root source directory for `@jackmisner/utm-toolkit`, a TypeScript library for capturing, storing, and appending UTM tracking parameters.
- Organized by data flow direction: `@/src/inbound` (receiving UTM-tagged traffic), `@/src/outbound` (creating UTM-tagged links), and `@/src/common` (shared utilities). Supplemented by `@/src/config`, `@/src/debug`, `@/src/types`, an optional `@/src/react` integration, and a DOM-free `@/src/server` surface.
- Exposes three package entry points: `@/src/index.ts` (main, `@jackmisner/utm-toolkit`), `@/src/react/index.ts` (`.../react`), and `@/src/server/index.ts` (`.../server`).

### How it fits into the larger codebase

- `@/src/index.ts` is the main barrel export that re-exports everything from `inbound`, `outbound`, `common`, `config`, `debug`, and `types`. This is what consumers get when they `import from '@jackmisner/utm-toolkit'`.
- `@/src/react/index.ts` is the React entry point, built as a separate bundle with React externalized.
- `@/src/server/index.ts` is the server entry point: UTM normalisation for untrusted ingest endpoints, with a hard structural rule that it cannot reach browser-coupled modules. See `@/src/server/docs.md`.
- `@/tsup.config.ts` defines these entry points and produces dual ESM/CJS output with TypeScript declarations; `package.json` `exports` mirrors them as conditional exports.
- `@/__tests__` mirrors this directory structure (`inbound/`, `outbound/`, `common/`, `config/`, `react/`, `server/`) for testing.
- The library has zero runtime dependencies. React is an optional peer dependency used only by `@/src/react`.

### Core Implementation

The library follows a layered architecture organized by data flow direction:

```text
Consumer API
  |
  +--> src/index.ts (barrel) -----> inbound/  outbound/  common/  config/  debug/  types/
  |
  +--> src/react/index.ts --------> react/ (useUtmTracking, UtmProvider, UtmHiddenFields, UtmLinkDecorator)
  |                                   |
  |                                   +--> inbound/  outbound/  common/  config/  types/
  |
  +--> src/server/index.ts -------> server/ (normalizeUtmParams, normalizeUtmUrl)
                                      |
                                      +--> inbound/sanitizer  inbound/pii-filter  config/defaults
                                      X    common/storage  inbound/form  outbound/*  debug/  react/
                                           (forbidden; enforced by an import-graph test)
```

- **types/** (`@/src/types`): Shared type definitions consumed by all other modules. Defines the dual key format system (snake_case/camelCase), storage type, attribution mode, event callbacks, and configuration interfaces.
- **config/** (`@/src/config`): Pure configuration creation and validation. Merges partial user config with defaults to produce `ResolvedUtmConfig`.
- **common/** (`@/src/common`): Shared utilities used by both inbound and outbound pathways -- browser storage (sessionStorage/localStorage with envelope format and optional TTL), key format conversion, and URL validation.
- **inbound/** (`@/src/inbound`): Receiving UTM-tagged traffic -- capture from URLs, sanitize values, filter PII, first-touch/last-touch attribution, and form field population.
- **outbound/** (`@/src/outbound`): Creating UTM-tagged links -- append params to URLs, structured UTM URL builder, and automatic link decoration.
- **debug/** (`@/src/debug`): Development-time diagnostics. Assembles state snapshots and provides formatted console output and optional `window.utmDebug` helpers.
- **react/** (`@/src/react`): React hooks, context provider, and components that orchestrate the core modules into stateful React APIs with auto-capture-on-mount behavior, form field rendering, and link decoration.
- **server/** (`@/src/server`): DOM-free, stateless normalisation of untrusted UTM input for ingest endpoints. Reuses only the pure value-level primitives from `inbound/`, applies server-appropriate defaults, and returns a *total* parameter record safe to use as a datastore key.

**Key data flow**: URL with UTM params --> `capture` (with optional sanitization and PII filtering) --> `storeWithAttribution` or `store` in sessionStorage/localStorage (with optional TTL, envelope format) --> `appendToUrl` / `buildUtmUrl` / `decorateLinks` for outbound link generation.

### Things to Know

- **Dual key format invariant**: The library supports both `snake_case` (URL convention) and `camelCase` (TypeScript convention) throughout, but all URL-facing operations always convert to snake_case internally. This is enforced in `@/src/outbound/appender.ts`.
- **Envelope storage format**: All stored data uses an envelope `{ params, iat, eat }` where `iat` is issued-at timestamp and `eat` is expires-at (null for no expiry). The storage module reads both envelope and flat formats for backward compatibility.
- **SSR safety**: Every module that touches browser APIs (`window`, `sessionStorage`, `localStorage`, `URL`, `document`, `MutationObserver`) guards against their absence. The library can be imported and initialized on the server without errors.
- **Event callbacks**: Lifecycle hooks (`onCapture`, `onStore`, `onClear`, `onAppend`, `onExpire`) are all wrapped in try-catch so a failing callback never breaks the data pipeline.
- **Three entry points**: The package.json `exports` map defines conditional exports for `.`, `./react`, and `./server`, each with ESM/CJS/types variants. React is externalized in the build so it is not bundled into the output.
- **Client-side capture is never trusted server-side**: `@/src/inbound` runs the pipeline in the browser, but a public ingest endpoint can be POSTed to directly, so `@/src/server` runs equivalent rules again on untrusted input. Both sides share the same value-level primitives so the rules cannot drift.
- **`/server` isolation is structural and enforced**: `@/src/server` must not reach storage, DOM, or React modules at runtime. An import-graph test in `@/__tests__/server` walks the actual transitive runtime imports rather than a hand-maintained list, so a convenient re-export cannot silently break the guarantee. Note that the root entry does *not* crash in a DOM-free Node context — `/server` exists for the guaranteed surface, server-appropriate defaults, and bundle size, not to work around a crash.
- **No runtime dependencies**: The library is self-contained. All functionality is implemented from scratch using standard Web APIs (`URL`, `URLSearchParams`, `sessionStorage`, `localStorage`, `MutationObserver`).

Created and maintained by Nori.

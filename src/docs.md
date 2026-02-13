# Noridoc: src

Path: @/src

### Overview

- Root source directory for `@jackmisner/utm-toolkit`, a TypeScript library for capturing, storing, and appending UTM tracking parameters.
- Contains framework-agnostic core utilities (`@/src/core`, `@/src/config`, `@/src/debug`, `@/src/types`) and an optional React integration (`@/src/react`).
- Exposes two package entry points: `@/src/index.ts` (main, imported as `@jackmisner/utm-toolkit`) and `@/src/react/index.ts` (imported as `@jackmisner/utm-toolkit/react`).

### How it fits into the larger codebase

- `@/src/index.ts` is the main barrel export that re-exports everything from `core`, `config`, `debug`, and `types`. This is what consumers get when they `import from '@jackmisner/utm-toolkit'`.
- `@/src/react/index.ts` is the second entry point for React-specific exports, built as a separate bundle with React externalized.
- `@/tsup.config.ts` defines these two entry points and produces dual ESM/CJS output with TypeScript declarations.
- `@/__tests__` mirrors this directory structure for testing.
- The library has zero runtime dependencies. React is an optional peer dependency used only by `@/src/react`.

### Core Implementation

The library follows a layered architecture:

```text
Consumer API
  |
  +--> src/index.ts (barrel) -----> core/   config/   debug/   types/
  |
  +--> src/react/index.ts --------> react/ (useUtmTracking, UtmProvider)
                                      |
                                      +--> core/   config/   types/
```

- **types/** (`@/src/types`): Shared type definitions consumed by all other modules. Defines the dual key format system (snake_case/camelCase) and configuration interfaces.
- **config/** (`@/src/config`): Pure configuration creation and validation. Merges partial user config with defaults to produce `ResolvedUtmConfig`.
- **core/** (`@/src/core`): Framework-agnostic UTM operations -- capture from URLs, sanitize parameter values, filter PII, persist in sessionStorage or localStorage (with optional TTL), append to outbound URLs, convert key formats, validate URLs. All SSR-safe.
- **debug/** (`@/src/debug`): Development-time diagnostics. Assembles state snapshots and provides formatted console output and optional `window.utmDebug` helpers.
- **react/** (`@/src/react`): React hook and context provider that orchestrate the core modules into stateful React APIs with auto-capture-on-mount behavior.

**Key data flow**: URL with UTM params --> `capture` (with optional sanitization and PII filtering) --> `store` in sessionStorage or localStorage (with optional TTL) --> `appendToUrl` for outbound link generation.

### Things to Know

- **Dual key format invariant**: The library supports both `snake_case` (URL convention) and `camelCase` (TypeScript convention) throughout, but all URL-facing operations always convert to snake_case internally. This is enforced in `@/src/core/appender.ts`.
- **SSR safety**: Every module that touches browser APIs (`window`, `sessionStorage`, `URL`, `document`) guards against their absence. The library can be imported and initialized on the server without errors.
- **Two entry points**: The package.json `exports` map defines separate conditional exports for `.` and `./react`, each with ESM/CJS/types variants. React is externalized in the build so it is not bundled into the output.
- **No runtime dependencies**: The library is self-contained. All functionality is implemented from scratch using standard Web APIs (`URL`, `URLSearchParams`, `sessionStorage`, `localStorage`).

Created and maintained by Nori.

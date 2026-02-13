# Noridoc: react

Path: @/src/react

### Overview

- React integration layer providing a hook (`useUtmTracking`) and context provider (`UtmProvider`/`useUtmContext`) for UTM parameter management in React applications.
- This is the second package entry point, imported as `@jackmisner/utm-toolkit/react` and built as a separate bundle with React externalized.
- Orchestrates the core modules (`@/src/core`) and config system (`@/src/config`) into a stateful React API.

### How it fits into the larger codebase

- `useUtmTracking` is the primary orchestrator: it calls `createConfig()` from `@/src/config`, then uses `captureUtmParameters`, `storeUtmParameters`, `getStoredUtmParameters`, `clearStoredUtmParameters`, `appendUtmParameters`, `convertParams`, and `isSnakeCaseUtmKey` from `@/src/core`.
- `UtmProvider` wraps `useUtmTracking` in a React context, enabling tree-wide access via `useUtmContext()`.
- React is externalized in the build (`tsup.config.ts` declares `external: ['react']`) and declared as an optional peer dependency. The core library works without React.
- Types (`UseUtmTrackingReturn`, `UtmProviderProps`, etc.) come from `@/src/types`.

### Core Implementation

**Data flow through `useUtmTracking`:**

```text
Mount
  |
  v
useState initializer --> getStoredUtmParameters() --> initial state from sessionStorage
  |
  v
useEffect (once, via ref guard) --> if captureOnMount && enabled:
  |
  v
capture() --> captureUtmParameters(window.location.href) --> if has params:
  |                                                            storeUtmParameters()
  |                                                            setUtmParameters()
  |                                                          else if has defaultParams:
  |                                                            store & set defaults
  v
appendToUrl(url, platform?) --> merges: captured params < default share context < platform context
  |                             --> filters out excludeFromShares
  |                             --> appendUtmParameters(url, mergedParams)
  v
URL with UTM params
```

- Config is resolved once via `useRef(createConfig(options.config))` -- config changes after mount are not picked up.
- The `hasInitialized` ref prevents double-capture in React strict mode or re-renders.
- `appendToUrl` implements a layered merge: captured params are the base, then `shareContextParams.default` is applied, then `shareContextParams[platform]`. After merging, `excludeFromShares` filters out unwanted keys (comparing in both snake_case and camelCase).
- `UtmProvider` memoizes the context value based on all return fields from `useUtmTracking` to prevent unnecessary re-renders of consumers.
- `useUtmContext()` throws a descriptive error if called outside a `UtmProvider`, guiding the developer to either wrap with `<UtmProvider>` or use `useUtmTracking()` directly.

### Things to Know

- **Config is frozen at mount**: The `useRef` pattern means the resolved config never changes. If a consumer passes new config props, they will be ignored after the first render.
- **Initialization guard**: `hasInitialized.current` is a ref (not state), so the guard works correctly across strict mode double-effects without triggering re-renders.
- **`appendToUrl` exclusion logic**: The `excludeFromShares` filter converts camelCase keys to snake_case using inline regex (not the `toSnakeCase` utility), so it duplicates some conversion logic from `@/src/core/keys.ts`.
- **SSR safety**: The `useState` initializer checks `typeof window === 'undefined'` and returns `null` for server rendering. The `capture` callback also checks before accessing `window.location`.

Created and maintained by Nori.

# Noridoc: react

Path: @/src/react

### Overview

- React integration layer providing hooks (`useUtmTracking`, `useUtmFormData`, `useUtmLinkDecorator`), a context provider (`UtmProvider`/`useUtmContext`), and components (`UtmHiddenFields`, `UtmLinkDecorator`) for UTM parameter management in React applications.
- This is the second package entry point, imported as `@jackmisner/utm-toolkit/react` and built as a separate bundle with React externalized.
- Orchestrates the inbound, outbound, and common modules along with the config system into stateful React APIs.

### How it fits into the larger codebase

- `useUtmTracking` is the primary orchestrator: it calls `createConfig()` from `@/src/config`, then uses `captureUtmParameters` from `@/src/inbound/capture`, `storeUtmParameters`/`getStoredUtmParameters`/`clearStoredUtmParameters` from `@/src/common/storage`, `appendUtmParameters` from `@/src/outbound/appender`, and `convertParams`/`isSnakeCaseUtmKey` from `@/src/common/keys`. It forwards `storageType` and `ttl` from config to all storage operations.
- `UtmHiddenFields` and `useUtmFormData` read stored params via `@/src/common/storage` to render form fields or return form-ready data.
- `UtmLinkDecorator` and `useUtmLinkDecorator` use `decorateLinks` from `@/src/outbound/decorator` to auto-decorate anchor elements within a React component tree.
- `UtmProvider` wraps `useUtmTracking` in a React context, enabling tree-wide access via `useUtmContext()`.
- React is externalized in the build (`tsup.config.ts` declares `external: ['react']`) and declared as an optional peer dependency. The core library works without React.

### Core Implementation

**Data flow through `useUtmTracking`:**

```text
Mount
  |
  v
useState initializer --> getStoredUtmParameters({storageType}) --> initial state from storage
  |
  v
useEffect (once, via ref guard) --> if captureOnMount && enabled:
  |
  v
capture() --> captureUtmParameters(window.location.href, <capture options from resolved config>)
  |             where the options are keyFormat, allowedParameters, lowercaseValues,
  |             sanitize, piiFiltering and the onCapture callback
  |
  |                                                          --> if has params:
  |                                                            storeUtmParameters({storageType, ttl})
  |                                                            setUtmParameters()
  |                                                          else if has defaultParams:
  |                                                            store & set defaults (with storageType, ttl)
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
- **Attribution in the hook**: `useUtmTracking` computes `firstTouchParams` and `lastTouchParams` based on `config.attribution.mode`. In `'last'` mode, `firstTouchParams` is null and `lastTouchParams` equals `utmParameters`. In `'first'` mode, it reads from the first-touch suffixed key. In `'both'` mode, both are read from their respective suffixed keys. These reads happen on every render (not memoized).
- **`UtmHiddenFields`**: Renders `<input type="hidden">` elements for each stored UTM param. Reads directly from storage on each render. Supports an optional `prefix` for field names.
- **`useUtmFormData`**: Returns a `Record<string, string>` of stored UTM params, memoized on `storageKey`, `storageType`, and `keyFormat`. Designed for integration with form libraries.
- **`useUtmLinkDecorator`**: Returns a `ref` to attach to a container element. On mount, it scopes `decorateLinks()` to that container by temporarily setting a `data-utm-scope` attribute and using it as a CSS selector prefix.

### Things to Know

- **Config is frozen at mount**: The `useRef` pattern means the resolved config never changes. If a consumer passes new config props, they will be ignored after the first render.
- **Initialization guard**: `hasInitialized.current` is a ref (not state), so the guard works correctly across strict mode double-effects without triggering re-renders.
- **`appendToUrl` exclusion logic**: The `excludeFromShares` filter converts camelCase keys to snake_case using inline regex (not the `toSnakeCase` utility), so it duplicates some conversion logic from `@/src/common/keys.ts`.
- **Storage options forwarding**: The hook passes `storageType` and `ttl` from the resolved config to `storeUtmParameters`, `getStoredUtmParameters`, and `clearStoredUtmParameters`. The `clear` callback passes `storageType` so it clears the correct backend.
- **Capture options forwarding is the React path's only route to `CaptureOptions`**: consumers of the hook configure capture through `UtmConfig`, so any `CaptureOptions` field must be mapped explicitly in `useUtmTracking`'s call *and* exist on `UtmConfig`/`ResolvedUtmConfig`/`DEFAULT_CONFIG` in `@/src/config`. A field present on `CaptureOptions` but not forwarded here is simply unreachable from React.
- **The hook uses `captureUtmParameters`, not `captureUtmParametersWithReport`**: the hook's public surface exposes captured params only, so rejection reporting is not surfaced through React state. Consumers wanting to distinguish "no campaign" from "campaign rejected" call `captureUtmParametersWithReport` from `@/src/inbound` directly.
- **SSR safety**: The `useState` initializer checks `typeof window === 'undefined'` and returns `null` for server rendering. The `capture` callback also checks before accessing `window.location`. Form and decorator components/hooks guard against `document` being undefined.

Created and maintained by Nori.

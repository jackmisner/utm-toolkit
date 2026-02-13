# Noridoc: outbound

Path: @/src/outbound

### Overview

- Utilities for the outbound data path: creating UTM-tagged links from stored or provided parameters.
- Includes URL parameter appending, a structured UTM URL builder, and automatic link decoration.
- All exports are re-exported through `@/src/index.ts` to package consumers.

### How it fits into the larger codebase

- `@/src/react/useUtmTracking.ts` calls `appendUtmParameters` from this module to build share URLs.
- `@/src/react/UtmLinkDecorator.tsx` and `useUtmLinkDecorator` use `decorateLinks` from this module.
- Builder (`builder.ts`) imports `validateUrl`/`normalizeUrl` from `@/src/common/validator` and `appendUtmParameters` from appender.
- Decorator (`decorator.ts`) imports `getStoredUtmParameters` from `@/src/common/storage` and `appendUtmParameters`/`extractUtmParameters` from appender.
- Types (`UtmParameters`, `AppendOptions`, etc.) come from `@/src/types`.

### Core Implementation

**Appender (`appender.ts`)** is the foundational URL manipulation module:
- `appendUtmParameters(url, params, options?)` converts all keys to snake_case, then adds them to the URL's query string (default) or fragment. Respects `preserveExisting` option to keep or replace existing UTM params.
- `removeUtmParameters(url)` strips all `utm_*` query parameters from a URL.
- `extractUtmParameters(url)` reads all `utm_*` query parameters from a URL into a `UtmParameters` object.
- All URL manipulation uses the `URL` constructor. Invalid URLs are returned unchanged.

**Builder (`builder.ts`)** provides a structured API for constructing UTM-tagged URLs:
- `buildUtmUrl(params, options?)` takes named fields (`source`, `medium`, `campaign`, `term`, `content`, `id`) plus a base `url`, validates values, optionally normalizes the URL, and returns a `BuildResult` with the final URL, validity flag, errors, and warnings.
- Validates that `source` is required and non-empty, checks for unsafe characters (`& = ? #`) in values, and warns about uppercase characters.
- `lowercaseValues` option lowercases all param values before building.
- Fires optional `onAppend` callback after successful URL construction.
- `validateUtmValues()` is exported separately for standalone value validation.

**Decorator (`decorator.ts`)** auto-appends UTM params to links on a page:
- `decorateLinks(options?)` queries the DOM for matching anchor elements, filters by host (internal-only by default), skips links with existing UTM params, and appends stored UTM params to each link's `href`.
- Supports host allowlisting (`includeHosts`), blocklisting (`excludeHosts`), `extraParams` for additional static params, and `onAppend` callbacks.
- `observeAndDecorateLinks(options?)` decorates existing links then installs a `MutationObserver` on `document.body` to catch dynamically added links (SPA support). Returns a cleanup function to disconnect the observer.
- SSR-safe: both functions return 0 when `document` is undefined.

### Things to Know

- **Snake_case enforcement in appender**: `appendUtmParameters` always converts keys to snake_case before adding to the URL, regardless of the `keyFormat` setting. This is a core invariant of the library.
- **Builder composes existing utilities**: `buildUtmUrl` delegates to `normalizeUrl`, `validateUrl`, and `appendUtmParameters` internally, rather than reimplementing URL manipulation.
- **Decorator reads from storage on each call**: `decorateLinks` calls `getStoredUtmParameters` each time it runs. For the MutationObserver path, this means storage is re-read on every DOM mutation.
- **MutationObserver granularity**: The observer watches for `childList` changes with `subtree: true` on `document.body`. Each mutation triggers a full `decorateLinks` pass. The `skipExisting` option prevents double-decoration.

Created and maintained by Nori.

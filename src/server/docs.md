# Noridoc: server

Path: @/src/server

### Overview

- DOM-free UTM normalisation for server-side ingest endpoints, exposed as the third package entry point (`@jackmisner/utm-toolkit/server`).
- Exists because a public ingest endpoint cannot trust the client-side capture pass — anyone can POST to the endpoint directly — so the same folding rules have to run again on fully untrusted input.
- Provides `normalizeUtmParams(input: unknown, options)` for parsed request bodies and `normalizeUtmUrl(url, options)` for URL strings (a `Referer` header, a redirect target).

### How it fits into the larger codebase

- This folder deliberately reuses the *pure* value-level primitives from `@/src/inbound` — `sanitizeValueWithReport` from `@/src/inbound/sanitizer.ts` and `filterValueWithReport` from `@/src/inbound/pii-filter.ts` — so server and browser apply the same rules from the same code. It does not reuse the capture pipeline itself, which is URL-shaped and browser-defaulted.
- **Structural isolation invariant**: `@/src/server` must not import (at runtime) from `@/src/common/storage`, `@/src/inbound/form`, `@/src/inbound/attribution`, `@/src/outbound/decorator`, `@/src/outbound/appender`, `@/src/debug`, or `@/src/react`. That import restriction *is* the guarantee that this entry cannot touch the DOM or web storage.
- The invariant is **enforced, not documented**: `@/__tests__/server/isolation.test.ts` walks the transitive runtime import graph from `@/src/server/index.ts` and fails on any forbidden module or any reference to `window`/`document`/`sessionStorage`/`localStorage` outside comments. Without it, the next convenient re-export would silently remove the guarantee.
- Type-only imports are exempt from the walk because they are erased at build. `ServerNormalizeResult.rejected` reuses the `UtmRejection` type from `@/src/inbound/capture-report.ts` via `import type`, and `@/src/server/index.ts` re-exports it, so server and browser rejections speak one vocabulary at zero runtime cost.
- `STANDARD_UTM_PARAMETERS` and `DEFAULT_PII_FILTER_CONFIG` come from `@/src/config/defaults.ts`, which is pure data and therefore safe to reach.
- Wired into the build by a `server/index` entry in `@/tsup.config.ts` and a `./server` condition in `package.json`, mirroring the existing `./react` shape (dual ESM/CJS with declarations).

### Core Implementation

```text
untrusted body (unknown)          URL string
        |                              |
        |                    normalizeUtmUrl -> URL parse (never throws)
        |                              |  searchParams collected last-wins
        v                              v
              normalizeUtmParams(input, options)
                        |
        for each key in allowedParameters  <-- iterates the ALLOWLIST, not the input
                        |
        present & string? -> lowercase -> sanitizeValueWithReport -> filterValueWithReport
                        |
                        v
        { params: TOTAL record, rejected: UtmRejection[] }
```

- **Totality is the defining contract.** The result is built by iterating `allowedParameters`, never the input, so every allowed key is always present in `params`. Absent, non-string, and rejected parameters all carry `absentValue` (default `''`). The motivating consumer writes these into a composite primary key, where `NULL` does not deduplicate — a nullable column fragments one campaign into as many rows as it has absent parameters.
- Iterating the allowlist gives totality and prototype-pollution safety in one move: a key the caller did not allow can never become an output key. Assignment goes through `Object.defineProperty` rather than `params[key] = value`, because a plain assignment for the key `'__proto__'` sets the prototype instead of creating an own property, silently breaking totality.
- **Never throws, for any input.** The argument is an untrusted HTTP body; a throw here would be a 500 on somebody's first page load. Non-record input (including arrays) is treated as an empty source, an unparseable URL yields a total all-absent result, and non-string values are *rejected rather than coerced* — `String(['a','b'])` is `'a,b'`, a value nobody sent.
- **Server defaults deliberately diverge from browser defaults.** Browser defaults are lenient because losing a campaign label client-side is cheap; a server keying a datastore needs determinism.

  | Option | Browser default | Server default | Reason |
  | --- | --- | --- | --- |
  | lowercase | off | on | `LinkedIn` and `linkedin` are one campaign, two rows |
  | onMaxLength | `truncate` | `drop` | a truncated value is one nobody sent; long shared prefixes collide |
  | PII filtering | off | on | the endpoint is public |

- `piiFiltering.mode` is intentionally **not** configurable here: `Omit<PiiFilterConfig, 'mode'>` in the options type, and `mode: 'reject'` reapplied after the caller's spread. Redact mode would persist `'[REDACTED]'` as a campaign nobody ran.
- Rejections carry key, reason, and (for PII) the pattern name only — never the rejected value, matching the same rule enforced in `@/src/inbound/capture-report.ts`.

### Things to Know

- **A value stripped to nothing is absence, not rejection.** Sanitisation reducing a value to `''` predates this module and produces no `rejected` entry; only the gates (`valuePattern`, `maxLength` under `drop`, PII, `notAString`) do.
- **`absentValue` is configurable for a reason.** A consumer that must distinguish "genuinely absent" from a real empty value can supply an unforgeable sentinel that no campaign value could collide with.
- **`allowedParameters` defaults to all of `STANDARD_UTM_PARAMETERS`, including `utm_id`.** A consumer keying fewer columns than the library produces gets a mystery extra row, so narrowing this is a real configuration step rather than an optimisation.
- **The justification for a separate entry is not a crash.** Importing the root entry in a DOM-free Node context does not throw — this was verified against the built artifact. The case for `/server` is the documented DOM-free surface, server-appropriate defaults, the totality contract, the enforced structural isolation, and a substantially smaller bundle.
- `normalizeUtmUrl` is last-wins on duplicate query parameters, matching `URLSearchParams` iteration and the browser-side behaviour in `@/src/inbound/capture-report.ts`.
- Folding uses `toLowerCase()`, never `toLocaleLowerCase()`, and happens **before** every gate, so `valuePattern` and `piiFiltering.allowlistPattern` can be written without allowing uppercase. This mirrors the ordering in the capture pipeline.

Created and maintained by Nori.

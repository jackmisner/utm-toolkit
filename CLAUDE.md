# CLAUDE.md

## Quick Reference

- **Build**: `npm run build` (tsup, dual ESM/CJS)
- **Test**: `npm test` (vitest + jsdom)
- **Lint**: `npm run lint` (oxlint)
- **Format**: `npm run format` (prettier)
- **Type check**: `npm run type-check`
- **Package check**: `npm run check:package` (builds, then publint + attw against the packed tarball)

## Gotchas

- The git remote is named `main`, not `origin`. Use `git push main <branch>`.
- `validator.ts` has module-level mutable state (`defaultProtocol`). Tests that call `setDefaultProtocol()` must restore the original value.
- The React hook freezes config at mount via `useRef` — config prop changes after mount are ignored.
- All URL-facing operations convert keys to `snake_case` internally, regardless of the consumer's `keyFormat` setting.
- `check:package` runs attw with `--profile node16`, so the `node10` row is still printed but every cell is marked `(ignored)` and it cannot affect the exit code. It is red for `/react` and `/server` because legacy resolution cannot see `exports` subpaths; that is a declared non-target, not a bug to fix. Do not add `typesVersions`: it would green the row for types only.
- publint and attw each catch what the other misses. attw exits 0 on a tarball containing no declarations at all, so publint is what catches missing or unpublished files; publint passes a correctly-wired `exports` map whose declarations import chunks the build never emitted, so attw is what catches that. Dropping either silently loses a class of failure.
- `scripts/assert-no-import-side-effects.js` guards `"sideEffects": false` in `check:package`, and nothing else verifies that claim. It fails a module-scope *read* of a browser global, not only a write, and fails any entry that imports a node builtin, since it cannot see what such code does at import; no entry needs one today. Detect the environment at call time, as every site in `src/` does; the script header gives the reasoning.
- The flag saves a consumer bytes only when none of an entry's exports are used. `sideEffects` is module-granularity and `splitting: false` emits each entry as a single JS module, so there is no partial drop. Do not advertise it as a tree-shaking win.
- The exported defaults in `config/defaults.ts` are built by `@__PURE__` annotated factory calls, and `common/keys.ts` derives its key lists the same way, so a bundler can drop them: one imported function costs ~300 bytes rather than ~1,200 on esbuild. Inlining a factory or losing an annotation silently gives that back; see the comment above `createDefaultConfig` and `scripts/assert-bundle-budget.js`.

## Releases

Releases are done via `npm run release:patch|minor|major` which creates a `release/<version>` branch from main. Pushing the tag triggers the publish workflow.

## Dependency Updates

Dependabot runs weekly (`.github/dependabot.yml`). Minor/patch npm bumps arrive as one grouped PR; majors get individual PRs, except where noted below.

- **React majors are ignored on purpose.** Which React line the tests run against is a support-matrix decision tied to the `peerDependencies: react >=16.8.0` claim, so it gets changed deliberately rather than by a weekly bump.
- **TypeScript majors are ignored because they are blocked upstream.** tsup bundles `rollup-plugin-dts` pinned against TypeScript 5.x, and TS 7 removed the `useCaseSensitiveFileNames` API it calls, so `npm run build` fails before emitting declarations. Remove the ignore once tsup ships a TS 7-compatible `rollup-plugin-dts`.
- **vitest and `@vitest/coverage-v8` are grouped, majors included.** `coverage-v8` peer-requires the exact matching vitest version, so raised separately neither can pass `npm ci`.
- **publint and `@arethetypeswrong/cli` are grouped on their own, majors included.** Both are pre-1.0, where a breaking change ships as a minor. Either can start failing `npm run check:package` against unchanged package code, and in the grouped `npm-minor-patch` PR that would block every unrelated bump behind it.
- **The test toolchain sets the Node floor, not the library.** jsdom requires Node 22+ and vitest requires 20+, so CI tests 22/24/26. `engines.node` is `>=20.0.0`: the published bundle has no Node-version-specific code, but nothing below 22 is exercised. Raise the floor rather than pinning the toolchain back if this ever conflicts.

## Test Setup

`__tests__/setup.ts` mocks `sessionStorage` and `window.location` globally before each test. Tests that need specific URLs must override `location.href` and `location.search`.

# CLAUDE.md

## Quick Reference

- **Build**: `npm run build` (tsup, dual ESM/CJS)
- **Test**: `npm test` (vitest + jsdom)
- **Lint**: `npm run lint` (oxlint)
- **Format**: `npm run format` (prettier)
- **Type check**: `npm run type-check`

## Gotchas

- The git remote is named `main`, not `origin`. Use `git push main <branch>`.
- `validator.ts` has module-level mutable state (`defaultProtocol`). Tests that call `setDefaultProtocol()` must restore the original value.
- The React hook freezes config at mount via `useRef` — config prop changes after mount are ignored.
- All URL-facing operations convert keys to `snake_case` internally, regardless of the consumer's `keyFormat` setting.

## Releases

Releases are done via `npm run release:patch|minor|major` which creates a `release/<version>` branch from main. Pushing the tag triggers the publish workflow.

## Dependency Updates

Dependabot runs weekly (`.github/dependabot.yml`). Minor/patch npm bumps arrive as one grouped PR; majors get individual PRs, except where noted below.

- **React majors are ignored on purpose.** Which React line the tests run against is a support-matrix decision tied to the `peerDependencies: react >=16.8.0` claim, so it gets changed deliberately rather than by a weekly bump.
- **TypeScript majors are ignored because they are blocked upstream.** tsup bundles `rollup-plugin-dts` pinned against TypeScript 5.x, and TS 7 removed the `useCaseSensitiveFileNames` API it calls, so `npm run build` fails before emitting declarations. Remove the ignore once tsup ships a TS 7-compatible `rollup-plugin-dts`.
- **vitest and `@vitest/coverage-v8` are grouped, majors included.** `coverage-v8` peer-requires the exact matching vitest version, so raised separately neither can pass `npm ci`.
- **The test toolchain sets the Node floor, not the library.** jsdom requires Node 22+ and vitest requires 20+, so CI tests 22/24/26. `engines.node` is `>=20.0.0`: the published bundle has no Node-version-specific code, but nothing below 22 is exercised. Raise the floor rather than pinning the toolchain back if this ever conflicts.

## Test Setup

`__tests__/setup.ts` mocks `sessionStorage` and `window.location` globally before each test. Tests that need specific URLs must override `location.href` and `location.search`.

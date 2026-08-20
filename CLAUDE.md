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

Dependabot runs weekly (`.github/dependabot.yml`). Minor/patch npm bumps arrive as one grouped PR; majors get individual PRs. Two things to know:

- **React majors are ignored on purpose.** Which React line the tests run against is a support-matrix decision tied to the `peerDependencies: react >=16.8.0` claim, so it gets changed deliberately rather than by a weekly bump.
- **oxlint's native bindings require Node `^20.19.0 || >=22.12.0`**, but `ci-node18.yml` runs `npm run lint`. This installs today only because npm 10 skips engine checks on optional dependencies. If the Node 18 lint step ever fails with a missing native binding, drop lint from that job (or drop Node 18) rather than pinning oxlint back.

## Test Setup

`__tests__/setup.ts` mocks `sessionStorage` and `window.location` globally before each test. Tests that need specific URLs must override `location.href` and `location.search`.

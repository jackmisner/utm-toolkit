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

## Test Setup

`__tests__/setup.ts` mocks `sessionStorage` and `window.location` globally before each test. Tests that need specific URLs must override `location.href` and `location.search`.

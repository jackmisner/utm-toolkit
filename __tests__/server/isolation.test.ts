import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'

/**
 * The /server entry's value rests on it being unable to reach browser-coupled
 * code. That is an import restriction, so it is only real if something checks
 * it — otherwise the next person to add a convenient re-export silently removes
 * the guarantee.
 *
 * This walks the actual transitive import graph from the entry point rather
 * than asserting on a hand-maintained list.
 */

const SRC = resolve(__dirname, '../../src')
const ENTRY = resolve(SRC, 'server/index.ts')

const FORBIDDEN = [
  'common/storage',
  'inbound/form',
  'inbound/attribution',
  'outbound/decorator',
  'outbound/appender',
  'debug/index',
  'react/index',
]

/** Resolve a relative specifier to a concrete .ts/.tsx file, if one exists. */
function resolveModule(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) {
    return null
  }
  const base = resolve(dirname(fromFile), specifier)
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

/** Strip comments so a docblock mentioning sessionStorage is not read as a use of it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/**
 * Modules reachable from `entry` following RUNTIME imports only.
 *
 * `import type` / `export type` are erased at build time, so they cannot pull
 * browser-coupled code into the bundle. Following them would flag the type-only
 * import of `UtmRejection` from capture-report, which costs no bytes and is not
 * a boundary violation.
 */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]

  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) {
      continue
    }
    seen.add(file)

    const source = stripComments(readFileSync(file, 'utf8'))
    const statements = [
      ...source.matchAll(
        /(?:^|\n)\s*(import|export)\s+(type\s+)?([\s\S]*?)from\s*['"]([^'"]+)['"]/g,
      ),
    ]

    for (const [, , typeOnly, clause, specifier] of statements) {
      // Skip `import type X from` and a clause that is entirely `{ type A, type B }`.
      if (typeOnly !== undefined) {
        continue
      }
      const names = clause.replace(/[{}]/g, '').trim()
      if (names !== '' && names.split(',').every((n) => n.trim().startsWith('type '))) {
        continue
      }
      const resolved = resolveModule(file, specifier)
      if (resolved !== null) {
        queue.push(resolved)
      }
    }
  }

  return seen
}

describe('server entry isolation', () => {
  const reachable = reachableFrom(ENTRY)
  const relativePaths = [...reachable].map((f) => relative(SRC, f).replace(/\.tsx?$/, ''))

  it('reaches at least its own modules, proving the walk works', () => {
    expect(relativePaths).toContain('server/index')
    expect(relativePaths).toContain('server/normalize')
  })

  it.each(FORBIDDEN)('does not reach %s', (forbidden) => {
    expect(relativePaths).not.toContain(forbidden)
  })

  it('does not reach any react module', () => {
    expect(relativePaths.filter((p) => p.startsWith('react/'))).toEqual([])
  })

  it('does not reach any debug module', () => {
    expect(relativePaths.filter((p) => p.startsWith('debug/'))).toEqual([])
  })

  it('never touches window, document or web storage in reachable runtime code', () => {
    const offenders: string[] = []
    for (const file of reachable) {
      const source = stripComments(readFileSync(file, 'utf8'))
      if (/\b(window|document|sessionStorage|localStorage)\b/.test(source)) {
        offenders.push(relative(SRC, file))
      }
    }
    expect(offenders).toEqual([])
  })
})

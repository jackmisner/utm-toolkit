#!/usr/bin/env node

/**
 * Fails if importing a published entry point evaluates observable code.
 *
 * `sideEffects: false` lets a consumer's bundler drop an unused module without
 * evaluating it. Neither publint nor attw checks that, and the unit tests import
 * from src/, so nothing else exercises the built artifacts' import behaviour.
 *
 * Usage: node scripts/assert-no-import-side-effects.js
 */

import { spawnSync } from 'child_process'
import { createRequire } from 'module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join, resolve } from 'path'
import { tmpdir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const selfPath = fileURLToPath(import.meta.url)

/**
 * Read or assignment of any of these during module evaluation fails the check.
 * Reads are included deliberately: a module-scope read means environment
 * detection at import time, which breaks the SSR-safety the README claims.
 */
const TRAPPED_GLOBALS = [
  'window',
  'document',
  'sessionStorage',
  'localStorage',
  'navigator',
  'location',
  'MutationObserver',
  'XMLHttpRequest',
  'fetch',
  'self',
  'top',
  'parent',
]

/** Imported before the traps go up, so their own evaluation is not attributed here. */
const EXTERNALS = ['react', 'react/jsx-runtime']

function collectEntries(exportsMap) {
  const found = new Set()
  const walk = (node) => {
    if (typeof node === 'string') {
      if (node.endsWith('.js') || node.endsWith('.cjs')) found.add(node)
      return
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node)) walk(value)
    }
  }
  walk(exportsMap)
  return [...found].sort()
}

async function runProbe(target, format, outFile) {
  const require = createRequire(selfPath)

  for (const dep of EXTERNALS) {
    try {
      require(dep)
    } catch {
      // Not installed in this context; nothing to warm.
    }
  }

  const accesses = []
  const unprotected = []

  for (const name of TRAPPED_GLOBALS) {
    try {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() {
          accesses.push(`read ${name}`)
          return undefined
        },
        set() {
          accesses.push(`assign ${name}`)
        },
      })
    } catch {
      unprotected.push(name)
    }
  }

  for (const method of Object.keys(console)) {
    if (typeof console[method] !== 'function') continue
    console[method] = () => accesses.push(`console.${method}()`)
  }

  for (const stream of ['stdout', 'stderr']) {
    process[stream].write = () => {
      accesses.push(`process.${stream}.write()`)
      return true
    }
  }

  let failure = null
  try {
    if (format === 'cjs') {
      require(target)
    } else {
      await import(pathToFileURL(target).href)
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }

  writeFileSync(outFile, JSON.stringify({ accesses, unprotected, failure }))
}

/**
 * Results come back through a file, not stdout: a module that logs or writes to
 * a stream during evaluation would otherwise corrupt them, which is exactly the
 * module this check exists to catch.
 */
function probe(target, format) {
  const dir = mkdtempSync(join(tmpdir(), 'utm-probe-'))
  const outFile = join(dir, 'result.json')
  try {
    const result = spawnSync(process.execPath, [selfPath, '--probe', target, format, outFile], {
      encoding: 'utf-8',
      cwd: root,
    })

    try {
      return JSON.parse(readFileSync(outFile, 'utf-8'))
    } catch {
      const detail = result.stderr.trim() || result.stdout.trim() || 'no output'
      return {
        accesses: [],
        unprotected: [],
        failure: `probe process exited ${result.status} without a result: ${detail}`,
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * The check is worthless if the probe cannot report a side effect, so prove on
 * every run that it does. Returns the reason it is untrustworthy, or null.
 */
function selfTestFailure() {
  const dir = mkdtempSync(join(tmpdir(), 'utm-side-effects-'))
  try {
    const body =
      "console.log('impure')\nprocess.stdout.write('impure')\nconst probed = sessionStorage\n"
    const cases = [
      [join(dir, 'impure.mjs'), `${body}export default probed\n`, 'esm'],
      [join(dir, 'impure.cjs'), `${body}module.exports = probed\n`, 'cjs'],
    ]

    for (const [file, source, format] of cases) {
      writeFileSync(file, source)
      const { accesses, failure } = probe(file, format)
      if (failure) return `probing a known-impure ${format} module errored: ${failure}`
      if (!accesses.includes('console.log()')) {
        return `probe missed a console.log() in a known-impure ${format} module`
      }
      if (!accesses.includes('process.stdout.write()')) {
        return `probe missed a process.stdout.write() in a known-impure ${format} module`
      }
      if (!accesses.includes('read sessionStorage')) {
        return `probe missed a sessionStorage read in a known-impure ${format} module`
      }
    }
    return null
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
  const entries = collectEntries(pkg.exports)

  if (entries.length === 0) {
    console.error('No .js or .cjs entry points found in package.json exports.')
    process.exit(1)
  }

  console.log(`Checking ${entries.length} entry points for import-time side effects...`)

  const selfTest = selfTestFailure()
  if (selfTest) {
    console.error(`Probe self-test failed, so this check cannot be trusted: ${selfTest}`)
    process.exit(1)
  }

  const problems = []
  for (const entry of entries) {
    const target = join(root, entry)
    const format = entry.endsWith('.cjs') ? 'cjs' : 'esm'
    const { accesses, unprotected, failure } = probe(target, format)

    if (failure) {
      problems.push(`${entry}: could not be imported (${failure}). Run \`npm run build\` first.`)
      continue
    }
    if (unprotected.length > 0) {
      problems.push(`${entry}: could not trap ${unprotected.join(', ')}, so it went unchecked.`)
    }
    if (accesses.length > 0) {
      problems.push(`${entry}: evaluated on import — ${[...new Set(accesses)].join(', ')}`)
    }
  }

  if (problems.length > 0) {
    console.error('\nImport-time side effects:')
    problems.forEach((problem, index) => console.error(`${index + 1}. ${problem}`))
    console.error('\n"sideEffects": false in package.json tells bundlers this cannot happen.')
    process.exit(1)
  }

  console.log('No import-time side effects.')
}

const probeIndex = process.argv.indexOf('--probe')
if (probeIndex === -1) {
  main()
} else {
  await runProbe(
    process.argv[probeIndex + 1],
    process.argv[probeIndex + 2],
    process.argv[probeIndex + 3],
  )
}

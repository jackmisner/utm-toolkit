#!/usr/bin/env node

/**
 * Fails if importing a published entry point evaluates observable code.
 *
 * `sideEffects: false` lets a consumer's bundler drop an unused module without
 * evaluating it. publint reports the field's absence but neither publint nor attw
 * verifies the claim, and the unit tests import from src/, so nothing else
 * exercises the built artifacts' import behaviour.
 *
 * Detection is deliberately belt-and-braces, because no single mechanism covers
 * the ways module evaluation can be observable: named traps for the globals and
 * schedulers a refactor would plausibly reach for, and a before/after diff of the
 * environment for everything else. What is NOT detected is synchronous
 * filesystem work (`fs.writeFileSync` leaves no trace); the no-builtin-imports
 * assertion below covers that class at the bundle level instead.
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
 * Reads fail too, not only writes: `window.location` at module scope throws on a
 * server, and this trap cannot tell that from a harmless `typeof window`. Detect
 * the environment at call time, as every site in src/ does.
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

/** Calling any of these during evaluation is itself the side effect. */
const TRAPPED_SCHEDULERS = ['setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask']
const TRAPPED_PROCESS_METHODS = ['nextTick', 'on', 'once', 'addListener', 'prependListener']

/** Patching any of these is a side effect the environment diff reports by name. */
const WATCHED_PROTOTYPES = ['Object', 'Array', 'String', 'Number', 'Function', 'Promise', 'Date']

/**
 * Imported before the traps go up, so their own evaluation is not attributed
 * here. Must stay in step with `external` in tsup.config.ts: an external missing
 * from this list has its side effects blamed on our entry.
 */
const EXTERNALS = ['react', 'react/jsx-runtime']

/** Extensions this script knows how to load; anything else must not be skipped silently. */
const LOADABLE = ['.js', '.cjs', '.mjs']
const NOT_RUNTIME = /\.(d\.ts|d\.cts|d\.mts|map)$/

const BUILTIN_IMPORT = new RegExp(
  String.raw`(?:from|require\()\s*['"](?:node:)?` +
    '(fs|http|https|net|path|os|child_process|crypto|stream|zlib|dns|tls|worker_threads|vm|module)' +
    String.raw`['"]`,
)

function countByType(values) {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

function collectEntries(exportsMap) {
  const paths = new Set()
  const walk = (node) => {
    if (typeof node === 'string') {
      if (node.startsWith('./')) paths.add(node)
      return
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node)) walk(value)
    }
  }
  walk(exportsMap)

  const entries = []
  const unknown = []
  for (const path of [...paths].sort()) {
    if (NOT_RUNTIME.test(path)) continue
    if (LOADABLE.some((extension) => path.endsWith(extension))) entries.push(path)
    else unknown.push(path)
  }
  return { entries, unknown }
}

/** Snapshot taken after the traps are installed, so the traps are not reported as changes. */
function snapshotEnvironment() {
  return {
    globals: Object.getOwnPropertyNames(globalThis),
    env: Object.entries(process.env).map(([key, value]) => `${key}=${value}`),
    prototypes: WATCHED_PROTOTYPES.flatMap((name) =>
      Object.getOwnPropertyNames(globalThis[name].prototype).map((key) => `${name}.${key}`),
    ),
    resources: countByType(process.getActiveResourcesInfo()),
  }
}

function diffEnvironment(before, after) {
  const changes = []
  const added = (label, from, to) => {
    const known = new Set(from)
    for (const value of to) if (!known.has(value)) changes.push(`${label} ${value}`)
  }

  added('added global', before.globals, after.globals)
  added('changed process.env', before.env, after.env)
  added('patched', before.prototypes, after.prototypes)

  for (const [type, count] of Object.entries(after.resources)) {
    const extra = count - (before.resources[type] ?? 0)
    if (extra > 0) changes.push(`left ${extra} active ${type} handle(s) behind`)
  }
  return changes
}

async function runProbe(target, format, outFile) {
  const require = createRequire(selfPath)

  for (const dep of EXTERNALS) {
    try {
      require(dep)
    } catch {
      // Not resolvable here; a real import failure is reported below instead.
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

  for (const name of TRAPPED_SCHEDULERS) {
    globalThis[name] = () => {
      accesses.push(`${name}()`)
      return undefined
    }
  }

  for (const name of TRAPPED_PROCESS_METHODS) {
    process[name] = () => {
      accesses.push(`process.${name}()`)
      return process
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

  const before = snapshotEnvironment()

  let failure = null
  let failureCode = null
  try {
    if (format === 'cjs') {
      require(target)
    } else {
      await import(pathToFileURL(target).href)
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
    failureCode = error?.code ?? null
  }

  accesses.push(...diffEnvironment(before, snapshotEnvironment()))

  writeFileSync(outFile, JSON.stringify({ accesses, unprotected, failure, failureCode }))

  // A timer, socket or listener started during evaluation would otherwise keep
  // this process alive and stall the parent instead of failing it.
  process.exit(0)
}

/**
 * Results come back through a file, not stdout: a module that logs or writes to a
 * stream during evaluation would otherwise corrupt them, which is exactly the
 * module this check exists to catch. That also makes any child stdout a side
 * effect in itself, since it can only have come from the module under test.
 */
function probe(target, format) {
  const dir = mkdtempSync(join(tmpdir(), 'utm-probe-'))
  const outFile = join(dir, 'result.json')

  // NODE_DEBUG=module makes Node log through the trapped stderr writer, which
  // would be reported against the package rather than against the debugger.
  const env = { ...process.env }
  delete env.NODE_DEBUG

  try {
    const result = spawnSync(process.execPath, [selfPath, '--probe', target, format, outFile], {
      encoding: 'utf-8',
      cwd: root,
      timeout: 30_000,
      env,
    })

    let parsed
    try {
      parsed = JSON.parse(readFileSync(outFile, 'utf-8'))
    } catch {
      const detail = result.stderr?.trim() || result.stdout?.trim() || 'no output'
      return {
        accesses: [],
        unprotected: [],
        failure: `probe exited ${result.status}${result.signal ? ` (${result.signal})` : ''} without a result: ${detail}`,
        failureCode: null,
      }
    }

    if (result.stdout) {
      parsed.accesses.push(`wrote ${result.stdout.length} byte(s) straight to stdout`)
    }
    if (result.signal) {
      parsed.failure = [parsed.failure, `probe killed by ${result.signal}`]
        .filter(Boolean)
        .join('; ')
    }
    return parsed
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * The check is worthless if the probe cannot report a side effect, so prove on
 * every run that each detector fires. Returns the reason it is untrustworthy, or
 * null. Add a case here whenever a detector is added.
 */
function selfTestFailure() {
  const dir = mkdtempSync(join(tmpdir(), 'utm-side-effects-'))
  try {
    const cases = [
      ["console.log('x')\n", ['console.log()']],
      ["process.stdout.write('x')\n", ['process.stdout.write()']],
      ['const read = sessionStorage\n', ['read sessionStorage']],
      ['globalThis.window = {}\n', ['assign window']],
      ['setInterval(() => {}, 1000)\n', ['setInterval()']],
      ['queueMicrotask(() => {})\n', ['queueMicrotask()']],
      ["process.on('exit', () => {})\n", ['process.on()']],
      ['globalThis.__utmProbeMarker = 1\n', ['added global __utmProbeMarker']],
      ["process.env.UTM_PROBE_MARKER = '1'\n", ['changed process.env UTM_PROBE_MARKER=1']],
      ['Array.prototype.__utmProbeMarker = 1\n', ['patched Array.__utmProbeMarker']],
      ["require('fs').writeSync(1, 'x')\n", ['straight to stdout']],
    ]

    let index = 0
    for (const [body, expectations] of cases) {
      index += 1
      // Each case runs as CJS so `require` is available to the stdout-bypass case.
      const file = join(dir, `impure-${index}.cjs`)
      writeFileSync(file, body)
      const { accesses, unprotected, failure } = probe(file, 'cjs')

      if (failure) return `probing known-impure case ${index} errored: ${failure}`
      if (unprotected.length > 0) {
        return `could not trap ${unprotected.join(', ')}, so the check is incomplete`
      }
      for (const expected of expectations) {
        if (!accesses.some((access) => access.includes(expected))) {
          return `probe missed "${expected}" in known-impure case ${index} (saw: ${accesses.join(', ') || 'nothing'})`
        }
      }
    }
    return null
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
  const { entries, unknown } = collectEntries(pkg.exports)

  if (unknown.length > 0) {
    console.error(
      `Cannot probe these entry points, so they would go unchecked: ${unknown.join(', ')}`,
    )
    console.error(
      `Teach LOADABLE in ${'scripts/assert-no-import-side-effects.js'} how to load them.`,
    )
    process.exit(1)
  }
  if (entries.length === 0) {
    console.error('No loadable entry points found in package.json exports.')
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
    const { accesses, unprotected, failure, failureCode } = probe(target, format)

    if (unprotected.length > 0) {
      problems.push(`${entry}: could not trap ${unprotected.join(', ')}, so it went unchecked.`)
    }
    if (accesses.length > 0) {
      problems.push(`${entry}: evaluated on import — ${[...new Set(accesses)].join(', ')}`)
    }
    if (failure) {
      const missing = failureCode === 'ERR_MODULE_NOT_FOUND' || failureCode === 'MODULE_NOT_FOUND'
      const hint = missing ? ' Run `npm ci` and `npm run build` first.' : ''
      problems.push(`${entry}: could not be imported (${failure}).${hint}`)
    }

    const source = (() => {
      try {
        return readFileSync(target, 'utf-8')
      } catch {
        return ''
      }
    })()
    const builtin = source.match(BUILTIN_IMPORT)
    if (builtin) {
      problems.push(
        `${entry}: imports the node builtin "${builtin[1]}", whose calls this check cannot see.`,
      )
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

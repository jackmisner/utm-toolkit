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
 * the ways module evaluation can be observable: named traps for the globals,
 * schedulers and process hooks a refactor would plausibly reach for, and a
 * before/after diff of the environment by value for everything else.
 *
 * Known gaps: synchronous filesystem work leaves nothing to observe (the
 * no-builtin-import check below covers that class at the bundle level instead),
 * and an unhandled promise rejection at module scope needs the event loop to turn
 * and so is not seen. The snapshot does not reach statics (`Object.assign = …`),
 * prototypes outside WATCHED_PROTOTYPES (`Map.prototype.x = …`), process state
 * beyond cwd and title, symbol-keyed additions to globalThis, or an accessor
 * whose setter alone is swapped.
 *
 * Usage: node scripts/assert-no-import-side-effects.js
 */

import { spawnSync } from 'child_process'
import { builtinModules, createRequire } from 'module'
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

/** Prototypes whose keys are compared by value, so replacement and deletion show up. */
const WATCHED_PROTOTYPES = ['Object', 'Array', 'String', 'Number', 'Function', 'Promise', 'Date']

/**
 * Imported before the traps go up, so their own evaluation is not attributed
 * here. Must list every bare specifier the built entries import, subpaths
 * included: tsup externalises `external` from its config plus every dependency
 * and peerDependency, and an external missing from this list has its side
 * effects blamed on our entry.
 */
const EXTERNALS = ['react', 'react/jsx-runtime']

/** Extensions this script knows how to load; anything else must not be skipped silently. */
const LOADABLE = ['.js', '.cjs', '.mjs']
const NOT_RUNTIME = /\.(d\.ts|d\.cts|d\.mts|map|json)$/
const BUILTINS = new Set(builtinModules)
const SPECIFIER = /(?:\bfrom|\brequire|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g

/**
 * Node 20.0-20.17 and 22.0-22.9 read `window` while initialising the CJS module
 * lexer, which the first ESM import of a CJS dependency triggers — reported as a
 * side effect of the entry that triggered it. Refusing to run beats accusing the
 * package of something Node did. Warming the lexer first does not help: it leaves
 * a CloseReq handle that lands after the baseline instead.
 */
function nodeTooOldToProbe() {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major === 20 && minor < 18) return '20.18.0'
  if (major === 22 && minor < 10) return '22.10.0'
  return null
}

function countByType(values) {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

/** Node builtins a bundle imports, by root name. `node:fs/promises` reports as `fs`. */
function builtinImports(source) {
  const found = new Set()
  for (const [, specifier] of source.matchAll(SPECIFIER)) {
    const bare = specifier.startsWith('node:') ? specifier.slice(5) : specifier
    const rootName = bare.split('/')[0]
    if (BUILTINS.has(rootName)) found.add(rootName)
  }
  return [...found]
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
    // A wildcard subpath is a pattern, not a module, and package.json is data.
    if (path.includes('*') || NOT_RUNTIME.test(path)) continue
    if (LOADABLE.some((extension) => path.endsWith(extension))) entries.push(path)
    else unknown.push(path)
  }
  return { entries, unknown }
}

/**
 * Identity token for a property, read from its descriptor so that an accessor's
 * getter is never invoked — the traps installed below are accessors, and reading
 * them would record a side effect against the module under test.
 */
function describeKeys(target, keys) {
  const tokens = new Map()
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key)
    if (!descriptor) continue
    const name = typeof key === 'symbol' ? `@@${String(key)}` : key
    tokens.set(name, 'get' in descriptor && descriptor.get ? descriptor.get : descriptor.value)
  }
  return tokens
}

/** Snapshot taken after the traps are installed, so the traps are not reported as changes. */
function snapshotEnvironment() {
  const prototypes = new Map()
  for (const name of WATCHED_PROTOTYPES) {
    const prototype = globalThis[name]?.prototype
    if (!prototype) continue
    for (const [key, token] of describeKeys(prototype, Reflect.ownKeys(prototype))) {
      prototypes.set(`${name}.${key}`, token)
    }
    prototypes.set(`${name} frozen`, Object.isFrozen(prototype))
  }

  return {
    // String keys only: Node registers symbol-keyed internals on globalThis
    // lazily (undici's dispatcher, on Node 22+), so reading the descriptors here
    // would itself look like a change on the next snapshot.
    globals: describeKeys(globalThis, Object.getOwnPropertyNames(globalThis)),
    prototypes,
    env: new Map(Object.entries(process.env)),
    processState: new Map([
      ['cwd', process.cwd()],
      ['title', process.title],
    ]),
    resources: countByType(process.getActiveResourcesInfo()),
  }
}

function diffEnvironment(before, after) {
  const changes = []

  const compare = (label, from, to) => {
    for (const [key, token] of to) {
      // Object.is, not ===, so the NaN global does not read as replaced every run.
      if (!from.has(key)) changes.push(`${label} added ${key}`)
      else if (!Object.is(from.get(key), token)) changes.push(`${label} replaced ${key}`)
    }
    for (const key of from.keys()) if (!to.has(key)) changes.push(`${label} removed ${key}`)
  }

  compare('global', before.globals, after.globals)
  compare('prototype', before.prototypes, after.prototypes)
  compare('process.env', before.env, after.env)
  compare('process state', before.processState, after.processState)

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

  // Shaped like a Timeout so a module that stores and unrefs the handle still
  // reaches the end of its evaluation, rather than also reporting an import error.
  const handle = { unref: () => handle, ref: () => handle, hasRef: () => false, close: () => {} }
  for (const name of TRAPPED_SCHEDULERS) {
    globalThis[name] = () => {
      accesses.push(`${name}()`)
      return handle
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
  // this process alive until the parent's 30s timeout.
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

  // NODE_DEBUG makes Node log through the trapped stderr writer, which would be
  // reported against the package rather than against the debugger.
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
      const detail =
        result.error?.message || result.stderr?.trim() || result.stdout?.trim() || 'no output'
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
 * The check is worthless if the probe cannot report a side effect, and harmful if
 * it reports one that is not there, so prove both on every run. Returns the reason
 * it is untrustworthy, or null. Add a case here whenever a detector inside the
 * probe is added; the builtin-import check runs in the parent and has none.
 */
function selfTestFailure() {
  const dir = mkdtempSync(join(tmpdir(), 'utm-side-effects-'))
  try {
    const cases = [
      ['module.exports = 1\n', []],
      ["console.log('x')\n", ['console.log()']],
      ["process.stdout.write('x')\n", ['process.stdout.write()']],
      ['const read = sessionStorage\n', ['read sessionStorage']],
      ['globalThis.window = {}\n', ['assign window']],
      ['setInterval(() => {}, 1000)\n', ['setInterval()']],
      ['queueMicrotask(() => {})\n', ['queueMicrotask()']],
      ["process.on('exit', () => {})\n", ['process.on()']],
      ['globalThis.__utmProbeMarker = 1\n', ['global added __utmProbeMarker']],
      ['globalThis.structuredClone = () => null\n', ['global replaced structuredClone']],
      ["process.env.UTM_PROBE_MARKER = '1'\n", ['process.env added UTM_PROBE_MARKER']],
      ['Array.prototype.__utmProbeMarker = 1\n', ['prototype added Array.__utmProbeMarker']],
      ['Array.prototype.includes = function () {}\n', ['prototype replaced Array.includes']],
      ['delete Array.prototype.at\n', ['prototype removed Array.at']],
      ['Object.freeze(Date.prototype)\n', ['prototype replaced Date frozen']],
      ["process.chdir('/')\n", ['process state replaced cwd']],
      ["require('fs').writeSync(1, 'x')\n", ['straight to stdout']],
      ["require('node:timers').setInterval(() => {}, 1000)\n", ['active Timeout handle']],
    ]

    let index = 0
    for (const [body, expectations] of cases) {
      index += 1
      // Each case runs as CJS so `require` is available to the bypass cases.
      const file = join(dir, `case-${index}.cjs`)
      writeFileSync(file, body)
      const { accesses, unprotected, failure } = probe(file, 'cjs')

      if (failure) return `probing self-test case ${index} errored: ${failure}`
      if (unprotected.length > 0) {
        return `could not trap ${unprotected.join(', ')}, so the check is incomplete`
      }

      if (expectations.length === 0) {
        if (accesses.length > 0) {
          return `the probe reports side effects for a module that has none (${accesses.join(', ')}), so this environment is too noisy to judge the package`
        }
        continue
      }
      for (const expected of expectations) {
        if (!accesses.some((access) => access.includes(expected))) {
          return `probe missed "${expected}" in self-test case ${index} (saw: ${accesses.join(', ') || 'nothing'})`
        }
      }
    }
    return null
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
  const needed = nodeTooOldToProbe()
  if (needed) {
    console.error(
      `This check needs Node >= ${needed}; running ${process.versions.node}, which reads \`window\` while initialising the CJS module lexer.`,
    )
    process.exit(1)
  }

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
  const { entries, unknown } = collectEntries(pkg.exports)

  if (unknown.length > 0) {
    console.error(
      `Cannot probe these entry points, so they would go unchecked: ${unknown.join(', ')}`,
    )
    console.error('Teach LOADABLE in this script how to load them.')
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

    let source = ''
    try {
      source = readFileSync(target, 'utf-8')
    } catch {
      // Already reported as an import failure above.
    }
    const builtins = builtinImports(source)
    if (builtins.length > 0) {
      problems.push(
        `${entry}: imports the node builtin(s) ${builtins.join(', ')}, whose calls this check cannot see.`,
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

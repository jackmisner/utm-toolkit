#!/usr/bin/env node

/**
 * Fails if a consumer importing one small function from the root entry would
 * ship more than BUDGET_BYTES.
 *
 * What this protects is a `/* @__PURE__ *\/` annotation on each module-scope
 * initialiser in src/config/defaults.ts. A bundler needs those to prove
 * DEFAULT_CONFIG droppable; without one it retains the whole object and its
 * dependencies, which measures ~1,200 bytes against ~300. They are comments, so
 * removing one costs every consumer about a kilobyte and changes nothing any
 * test can see.
 *
 * It does NOT cover the two annotations in src/common/keys.ts, which are worth
 * 153 and 21 bytes: catching the 21 would need a ceiling with no headroom at
 * all. A breach therefore always points at defaults.ts.
 *
 * The bundle is executed as well as weighed, because an annotation on a call
 * that is not in fact pure would license a bundler to drop something needed,
 * and no test here bundles anything.
 *
 * Usage: node scripts/assert-bundle-budget.js
 */

import { build } from 'esbuild'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/**
 * ~300 bytes with every defaults.ts initialiser annotated, ~1,200 with any one
 * of them lost. The headroom absorbs ordinary growth in the function under test
 * and patch-level minifier drift.
 */
const BUDGET_BYTES = 600

const ENTRY = 'dist/index.js'
const SYMBOL = 'toSnakeCase'

async function main() {
  if (!existsSync(join(root, ENTRY))) {
    console.error(`${ENTRY} is missing. Run \`npm run build\` first.`)
    process.exit(1)
  }

  // Bundled straight from dist rather than from a packed tarball: the ESM root
  // entry is the same file either way, and this keeps the check to a few ms.
  const result = await build({
    stdin: {
      contents: `import { ${SYMBOL} } from './${ENTRY}'\nglobalThis.__out = ${SYMBOL}(globalThis.__in)\n`,
      resolveDir: root,
      sourcefile: 'budget-entry.js',
      loader: 'js',
    },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    external: ['react', 'react/jsx-runtime'],
    write: false,
    logLevel: 'silent',
  })

  const bytes = result.outputFiles[0].contents.byteLength

  if (bytes > BUDGET_BYTES) {
    console.error(
      `Importing { ${SYMBOL} } from the root entry now bundles to ${bytes} bytes, over the ${BUDGET_BYTES} budget.`,
    )
    console.error(
      'A module-scope initialiser in src/config/defaults.ts is no longer provably pure.',
    )
    console.error('Check that each one is still annotated `/* @__PURE__ */`.')
    process.exit(1)
  }

  // Proves the pruning kept what the import actually needs.
  globalThis.__in = 'utmTeamId'
  const code = Buffer.from(result.outputFiles[0].contents).toString('utf-8')
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  if (globalThis.__out !== 'utm_team_id') {
    console.error(`The pruned bundle returned ${JSON.stringify(globalThis.__out)} for 'utmTeamId'.`)
    console.error('An annotated call was not pure, so a needed value was dropped.')
    process.exit(1)
  }

  console.log(`Root entry bundles to ${bytes} bytes and still works (budget ${BUDGET_BYTES}).`)
}

await main()

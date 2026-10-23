#!/usr/bin/env node

/**
 * Fails if a consumer importing one small function from the root entry would
 * ship more than BUDGET_BYTES.
 *
 * What this protects is a `/* @__PURE__ *\/` annotation on each module-scope
 * default in src/config/defaults.ts and src/common/keys.ts. A bundler needs
 * those to prove the defaults droppable; without them it retains DEFAULT_CONFIG
 * and its dependencies, which measured 1,347 bytes against 306. They are
 * comments, so removing one — or adding an un-annotated spread to DEFAULT_CONFIG
 * — costs every consumer about a kilobyte and changes nothing any test can see.
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
 * Measured at 306 bytes when every module-scope default is annotated. The
 * headroom absorbs ordinary growth in the one function under test while still
 * catching the loss of an annotation, the cheapest of which is worth ~170 bytes.
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
      'A module-scope value in src/config/defaults.ts or src/common/keys.ts is no longer provably pure.',
    )
    console.error('Check that each one is still annotated `/* @__PURE__ */`.')
    process.exit(1)
  }

  console.log(`Root entry bundles to ${bytes} bytes for one import (budget ${BUDGET_BYTES}).`)
}

await main()

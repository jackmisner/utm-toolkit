/**
 * Fails if a consumer importing one small function from the root entry would
 * ship more than BUDGET_BYTES, or if the pruned bundle does not work.
 *
 * What this protects is the two `@__PURE__` annotations in
 * src/config/defaults.ts, on the factory calls that build
 * DEFAULT_PII_FILTER_CONFIG and DEFAULT_CONFIG. The comment above
 * createDefaultConfig says why they are written that way. Losing either retains
 * the object and everything it reaches - ~670 or ~1,200 bytes against ~300 -
 * with nothing any test can see.
 *
 * It does not cover the two annotations in src/common/keys.ts, worth 153 and 21
 * bytes to this import. Catching the 21 would need a ceiling with no headroom,
 * so a breach here is most likely one of the defaults.ts pair.
 *
 * The bundle is executed as well as weighed, because an annotation on a call
 * that is not in fact pure would license a bundler to drop something needed,
 * and no other check prunes the entry and runs the result.
 *
 * Usage: npm run check:package (which builds first)
 */

import { build } from 'esbuild'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/**
 * ~300 bytes with both defaults.ts annotations in place, ~670 or ~1,200 with
 * either lost. The headroom absorbs ordinary growth in the function under test
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
    console.error('Most likely a factory call in src/config/defaults.ts lost its annotation.')
    console.error('DEFAULT_PII_FILTER_CONFIG and DEFAULT_CONFIG each need one.')
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

#!/usr/bin/env node

/**
 * Release script that creates a release branch, bumps version, and pushes.
 *
 * Usage: node scripts/release.js <patch|minor|major>
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function run(cmd, options = {}) {
  console.log(`$ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', ...options })
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim()
}

function calculateNewVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number)

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`Invalid version type: ${type}`)
  }
}

function getRemoteName() {
  const remotes = runCapture('git remote').split('\n').filter(Boolean)
  if (remotes.length === 0) {
    console.error('❌ No git remotes configured.')
    process.exit(1)
  }
  // Prefer 'origin', otherwise use the first remote
  return remotes.includes('origin') ? 'origin' : remotes[0]
}

function main() {
  const type = process.argv[2]

  if (!['patch', 'minor', 'major'].includes(type)) {
    console.error('Usage: node scripts/release.js <patch|minor|major>')
    process.exit(1)
  }

  const remote = getRemoteName()
  console.log(`📡 Using remote: ${remote}`)

  // Read current version
  const packagePath = join(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
  const currentVersion = packageJson.version

  // Calculate new version
  const newVersion = calculateNewVersion(currentVersion, type)
  const branchName = `release/${newVersion}`

  console.log(`\n📦 Release: ${currentVersion} → ${newVersion}\n`)

  // Check we're on main
  const currentBranch = runCapture('git branch --show-current')
  if (currentBranch !== 'main') {
    console.error(`❌ Must be on main branch to create a release. Currently on: ${currentBranch}`)
    process.exit(1)
  }

  // Pull latest
  console.log('📥 Pulling latest from main...')
  run(`git pull ${remote} main`)

  // Stage and commit any uncommitted changes
  const status = runCapture('git status --porcelain')
  if (status) {
    console.log('\n📝 Staging and committing uncommitted changes...')
    run('git add .')
    run(`git commit -m "chore: prepare for v${newVersion} release"`)
  }

  // Create release branch
  console.log(`\n🌿 Creating branch: ${branchName}`)
  run(`git checkout -b ${branchName}`)

  // Bump version
  console.log(`\n📝 Bumping version to ${newVersion}...`)
  run(`npm version ${type}`)

  // Push branch and tags
  console.log(`\n🚀 Pushing ${branchName} with tags...`)
  run(`git push -u ${remote} ${branchName} --follow-tags`)

  console.log(`
✅ Release branch created and pushed!

Next steps:
1. Create a PR: https://github.com/jackmisner/utm-toolkit/compare/main...${branchName}
2. Merge the PR to main
3. The tag (v${newVersion}) will trigger the publish workflow

Note: The npm publish will happen automatically when the tag is pushed.
`)
}

main()

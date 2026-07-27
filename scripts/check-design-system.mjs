import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const tokenFile = path.join(root, 'src/styles/tokens.css')
const tokenSource = await readFile(tokenFile, 'utf8')
const violations = []

const requiredTokens = [
  '--vzn-surface',
  '--vzn-text',
  '--vzn-action',
  '--vzn-danger',
  '--vzn-disabled-bg',
  '--vzn-space-4',
  '--vzn-radius-control',
  '--vzn-control-height-xs',
  '--vzn-control-height-md',
  '--vzn-brand-mark-sm',
  '--vzn-brand-mark-lg',
  '--vzn-shadow-overlay',
  '--vzn-duration-fast',
]

for (const token of requiredTokens) {
  if (!tokenSource.includes(`${token}:`)) violations.push(`tokens.css is missing ${token}`)
}

for (const entry of ['src/main.tsx', 'src/quick-chat-main.tsx']) {
  const source = await readFile(path.join(root, entry), 'utf8')
  const codexIndex = source.indexOf("./styles/codex.css")
  const tokenIndex = source.indexOf("./styles/tokens.css")
  if (tokenIndex < 0 || tokenIndex < codexIndex) {
    violations.push(`${entry} must load tokens.css after legacy component styles`)
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(target)
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [target] : []
  }))
  return nested.flat()
}

const atomicDirectories = [
  'src/components/ui/atoms',
  'src/components/ui/molecules',
  'src/components/organisms',
  'src/components/templates',
]

for (const directory of atomicDirectories) {
  for (const file of await collectFiles(path.join(root, directory))) {
    const source = await readFile(file, 'utf8')
    if (/#[\da-f]{3,8}\b|rgba?\(/i.test(source)) {
      violations.push(`${path.relative(root, file)} contains a literal color; use a semantic token`)
    }
  }
}

if (violations.length > 0) {
  console.error('Design system contract violations:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.log('Design token and Atomic UI contracts are valid.')
}

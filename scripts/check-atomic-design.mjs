import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const projectRoot = process.cwd()
const sourceRoot = path.join(projectRoot, 'src')
const componentsDirectory = path.join(sourceRoot, 'components')
const pagesDirectory = path.join(sourceRoot, 'pages')

const layers = [
  { name: 'atoms', directory: path.join(sourceRoot, 'components/ui/atoms'), pure: true },
  { name: 'molecules', directory: path.join(sourceRoot, 'components/ui/molecules'), pure: true },
  { name: 'organisms', directory: path.join(sourceRoot, 'components/organisms'), pure: false },
  { name: 'templates', directory: path.join(sourceRoot, 'components/templates'), pure: true },
]

const businessDirectories = [
  path.join(sourceRoot, 'hooks'),
  path.join(sourceRoot, 'services'),
  path.join(sourceRoot, 'store'),
]

const isWithin = (candidate, directory) => (
  candidate === directory || candidate.startsWith(`${directory}${path.sep}`)
)

function resolveProjectImport(importer, specifier) {
  if (specifier.startsWith('@/')) {
    return path.join(sourceRoot, specifier.slice(2))
  }
  if (specifier.startsWith('.')) {
    return path.resolve(path.dirname(importer), specifier)
  }
  return null
}

function findImportSpecifiers(source) {
  const staticImports = [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)]
  const dynamicImports = [...source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)]
  return [...staticImports, ...dynamicImports].map((match) => match[1])
}

async function resolveSourceFile(target) {
  const extension = path.extname(target)
  const candidates = extension
    ? (/\.(ts|tsx)$/.test(extension) ? [target] : [])
    : [
        `${target}.ts`,
        `${target}.tsx`,
        path.join(target, 'index.ts'),
        path.join(target, 'index.tsx'),
      ]

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Continue with the next TypeScript module-resolution candidate.
    }
  }
  return null
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(entryPath)
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : []
  }))
  return files.flat()
}

const violations = new Set()
const inspectedFiles = new Set()

async function inspectLayerDependency(layerIndex, layer, file) {
  const inspectionKey = `${layer.name}:${file}`
  if (inspectedFiles.has(inspectionKey)) return
  inspectedFiles.add(inspectionKey)

  const source = await readFile(file, 'utf8')
  for (const specifier of findImportSpecifiers(source)) {
    const target = resolveProjectImport(file, specifier)
    if (!target) continue

    const relativeFile = path.relative(projectRoot, file)
    const targetLayerIndex = layers.findIndex((candidate) => isWithin(target, candidate.directory))
    if (targetLayerIndex > layerIndex) {
      violations.add(`${relativeFile} imports upward from ${specifier}`)
    }

    if (isWithin(target, pagesDirectory)) {
      violations.add(`${relativeFile} imports the page layer from ${specifier}`)
    }

    if (layer.pure && businessDirectories.some((directory) => isWithin(target, directory))) {
      violations.add(`${relativeFile} imports business logic from ${specifier}`)
    }

    // Public layer barrels may temporarily re-export legacy components. Follow
    // those local modules so a compatibility re-export cannot hide a violation.
    if (targetLayerIndex === -1 && isWithin(target, componentsDirectory)) {
      const targetFile = await resolveSourceFile(target)
      if (targetFile) await inspectLayerDependency(layerIndex, layer, targetFile)
    }
  }
}

for (const [layerIndex, layer] of layers.entries()) {
  const files = await collectSourceFiles(layer.directory)
  for (const file of files) {
    await inspectLayerDependency(layerIndex, layer, file)
  }
}

if (violations.size > 0) {
  console.error('Atomic Design boundary violations:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.log('Atomic Design boundaries are valid.')
}

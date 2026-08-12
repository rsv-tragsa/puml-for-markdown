import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const root = path.resolve(process.argv[2] || process.cwd())
const configPath = path.resolve(process.argv[3] || path.join(root, 'puml-for-markdown.config.cjs'))
const require = createRequire(import.meta.url)
const config = require(configPath)
const configuredRoot = path.resolve(path.dirname(configPath), config.rootDirectory ?? '.')
if (path.relative(root, configuredRoot) !== '') {
  throw new Error(`rootDirectory from ${configPath} must be the repository root when used by this hook`)
}
const distAbsolute = path.resolve(configuredRoot, config.distDirectory ?? 'dist_puml')
const distRelative = path.relative(root, distAbsolute)
if (!distRelative || distRelative === '..' || distRelative.startsWith(`..${path.sep}`) || path.isAbsolute(distRelative)) {
  throw new Error(`distDirectory from ${configPath} must be inside the repository`)
}
const dist = distRelative.split(path.sep).join('/')

const gitPaths = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'buffer' })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)

const staged = new Set(gitPaths('diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR', '--', '*.md', '*.puml'))
const unstaged = new Set(gitPaths('diff', '--name-only', '-z', '--diff-filter=ACMR', '--', '*.md', '*.puml'))
const partial = [...staged].filter((file) => unstaged.has(file))

if (partial.length) {
  console.error('PUML: archivos parcialmente preparados; prepare o descarte primero sus cambios no staged:')
  for (const file of partial) console.error(`- ${file}`)
  process.exit(1)
}

const status = gitPaths('status', '--porcelain=v1', '-z', '--untracked-files=all', '--', dist)
const unstagedDist = []
for (let index = 0; index < status.length; index += 1) {
  const entry = status[index]
  if (entry.startsWith('?? ') || (entry.length >= 2 && entry[1] !== ' ')) unstagedDist.push(entry)
  if ('RC'.includes(entry[0]) || 'RC'.includes(entry[1])) index += 1
}
if (unstagedDist.length) {
  console.error(`PUML: ${dist} ya contiene cambios no preparados; revíselos antes de ejecutar el generador:`)
  for (const entry of unstagedDist) console.error(`- ${entry.slice(3)}`)
  process.exit(1)
}

process.stdout.write(dist)

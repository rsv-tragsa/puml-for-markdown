'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { imagePathForSource, isPathInside } = require('./paths')
const { getFullPumlUrl } = require('./plantuml')

const hasSymlinkComponent = (baseDirectory, candidatePath) => {
  const relative = path.relative(baseDirectory, candidatePath)
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return true
  let current = path.resolve(baseDirectory)
  for (const segment of relative.split(path.sep).slice(0, -1)) {
    current = path.join(current, segment)
    if (!fs.existsSync(current)) break
    if (fs.lstatSync(current).isSymbolicLink()) return true
  }
  return false
}

const assertSafeDistDirectory = ({ rootDirectory, pumlDirectory, distDirectory }) => {
  const root = path.resolve(rootDirectory)
  const puml = path.resolve(pumlDirectory)
  const dist = path.resolve(distDirectory)
  const filesystemRoot = path.parse(dist).root
  if (dist === filesystemRoot || dist === root || dist === puml || !isPathInside(root, dist)) {
    throw new Error(`Unsafe distDirectory: ${distDirectory}`)
  }
  const realRoot = fs.realpathSync(root)
  const realPuml = fs.realpathSync(puml)
  let existing = dist
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing)
    if (parent === existing) break
    existing = parent
  }
  const realExisting = fs.realpathSync(existing)
  const realDist = path.resolve(realExisting, path.relative(existing, dist))
  if (!isPathInside(realRoot, realDist) || realDist === realRoot || realDist === realPuml) {
    throw new Error(`Unsafe distDirectory after resolving symbolic links: ${distDirectory}`)
  }
  if (fs.existsSync(dist) && fs.lstatSync(dist).isSymbolicLink()) {
    throw new Error(`distDirectory must not be a symbolic link: ${distDirectory}`)
  }
  return dist
}

const atomicWrite = async (outputPath, buffer) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const temporary = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  )
  try {
    fs.writeFileSync(temporary, buffer)
    fs.renameSync(temporary, outputPath)
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true })
  }
}

const saveDiagram = async ({
  pumlDirectory,
  distDirectory,
  sourcePath,
  format,
  encodedData,
  pumlServerUrl,
  fetchBuffer,
}) => {
  const outputPath = imagePathForSource({ pumlDirectory, distDirectory, sourcePath, format })
  if (!isPathInside(distDirectory, outputPath)) throw new Error(`Output image escapes distDirectory: ${outputPath}`)
  if (hasSymlinkComponent(distDirectory, outputPath)) {
    throw new Error(`Output image path contains a symbolic-link directory: ${outputPath}`)
  }
  const url = getFullPumlUrl({ imgFormat: format, encodedData, pumlServerUrl })
  const buffer = await fetchBuffer(url)
  await atomicWrite(outputPath, buffer)
  return outputPath
}

const cleanupOrphanImages = ({
  rootDirectory,
  pumlDirectory,
  distDirectory,
  allPumlPaths,
  managedImages = new Set(),
  deletedSources = [],
  imageFormats = ['png', 'svg'],
}) => {
  const safeDist = assertSafeDistDirectory({ rootDirectory, pumlDirectory, distDirectory })
  const pathKey = (value) => process.platform === 'win32' ? value.toLowerCase() : value
  const expectedStems = new Set([...allPumlPaths].map((sourcePath) => {
    const relative = path.relative(pumlDirectory, sourcePath)
    return pathKey(relative.slice(0, -path.extname(relative).length))
  }))
  const removed = []
  const candidates = new Set([...managedImages].map((item) => path.resolve(safeDist, item)))
  for (const sourcePath of deletedSources) {
    for (const format of imageFormats) {
      candidates.add(imagePathForSource({ pumlDirectory, distDirectory: safeDist, sourcePath, format }))
    }
  }
  for (const imagePath of candidates) {
    if (!isPathInside(safeDist, imagePath)) continue
    if (hasSymlinkComponent(safeDist, imagePath)) continue
    if (!fs.existsSync(imagePath) || fs.lstatSync(imagePath).isSymbolicLink()) continue
    if (!['.png', '.svg'].includes(path.extname(imagePath).toLowerCase())) continue
    const relative = path.relative(safeDist, imagePath)
    const stem = pathKey(relative.slice(0, -path.extname(relative).length))
    if (!expectedStems.has(stem)) {
      fs.rmSync(imagePath)
      removed.push(imagePath)
    }
  }
  return removed
}

module.exports = {
  assertSafeDistDirectory,
  atomicWrite,
  cleanupOrphanImages,
  hasSymlinkComponent,
  saveDiagram,
}

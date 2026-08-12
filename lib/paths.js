'use strict'

const path = require('node:path')
const fs = require('node:fs')

const normalizeCase = (value, pathApi) => pathApi === path.win32 ? value.toLowerCase() : value

const isPathInside = (basePath, candidatePath, pathApi = path) => {
  const base = normalizeCase(pathApi.resolve(basePath), pathApi)
  const candidate = normalizeCase(pathApi.resolve(candidatePath), pathApi)
  const relative = pathApi.relative(base, candidate)
  return relative === '' || (!relative.startsWith(`..${pathApi.sep}`) && relative !== '..' && !pathApi.isAbsolute(relative))
}

const resolveWithin = (basePath, value, description, pathApi = path) => {
  const resolved = pathApi.resolve(basePath, value)
  if (!isPathInside(basePath, resolved, pathApi)) {
    throw new Error(`${description} escapes its allowed directory: ${value}`)
  }
  return resolved
}

const resolveConfiguredDirectory = (rootDirectory, value, description) => {
  const resolved = path.resolve(rootDirectory, value)
  if (!isPathInside(rootDirectory, resolved)) {
    throw new Error(`${description} must be inside rootDirectory: ${value}`)
  }
  if (fs.existsSync(rootDirectory) && fs.existsSync(resolved)) {
    const realRoot = fs.realpathSync(rootDirectory)
    const realResolved = fs.realpathSync(resolved)
    if (!isPathInside(realRoot, realResolved)) {
      throw new Error(`${description} resolves outside rootDirectory through a symbolic link: ${value}`)
    }
  }
  return resolved
}

const decodeMarkdownTarget = (target) => {
  let value = target.trim()
  if (value.startsWith('<') && value.endsWith('>')) value = value.slice(1, -1)
  return value.split('/').map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch (error) {
      throw new Error(`Invalid URL encoding in Markdown PUML target "${target}": ${error.message}`)
    }
  }).join(path.sep)
}

const encodeMarkdownPath = (filesystemPath) => filesystemPath
  .split(/[\\/]/)
  .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`))
  .join('/')

const sourceRelativePath = (pumlDirectory, sourcePath) => {
  if (!isPathInside(pumlDirectory, sourcePath)) {
    throw new Error(`PUML file escapes pumlDirectory: ${sourcePath}`)
  }
  return path.relative(pumlDirectory, sourcePath)
}

const imagePathForSource = ({ pumlDirectory, distDirectory, sourcePath, format }) => {
  const relative = sourceRelativePath(pumlDirectory, sourcePath)
  const extension = path.extname(relative)
  if (extension.toLowerCase() !== '.puml') throw new Error(`Not a PUML file: ${sourcePath}`)
  return path.join(distDirectory, relative.slice(0, -extension.length) + `.${format}`)
}

const localImageLink = ({ markdownPath, imagePath }) => {
  const relative = path.relative(path.dirname(markdownPath), imagePath)
  return encodeMarkdownPath(relative || path.basename(imagePath))
}

module.exports = {
  decodeMarkdownTarget,
  encodeMarkdownPath,
  imagePathForSource,
  isPathInside,
  localImageLink,
  resolveConfiguredDirectory,
  resolveWithin,
  sourceRelativePath,
}

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { isPathInside } = require('./paths')

const toPosix = (value) => value.split(path.sep).join('/')

const wildcardToRegExp = (pattern) => {
  let result = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        result += '.*'
        index += 1
      } else {
        result += '[^/]*'
      }
    } else if (char === '?') {
      result += '[^/]'
    } else {
      result += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    }
  }
  return result
}

const createGitignoreMatcher = (gitignorePath, enabled) => {
  if (!enabled || !gitignorePath || !fs.existsSync(gitignorePath)) return () => false
  const rules = fs.readFileSync(gitignorePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const negated = line.startsWith('!')
      let value = negated ? line.slice(1) : line
      const directoryOnly = value.endsWith('/')
      value = value.replace(/^\//, '').replace(/\/$/, '')
      const hasSlash = value.includes('/')
      const body = wildcardToRegExp(value)
      const expression = hasSlash ? `^${body}(?:/.*)?$` : `(?:^|/)${body}(?:/.*)?$`
      return { negated, directoryOnly, regex: new RegExp(expression) }
    })

  return (relativePath, isDirectory = false) => {
    const normalized = toPosix(relativePath)
    let ignored = false
    for (const rule of rules) {
      if ((!rule.directoryOnly || isDirectory) && rule.regex.test(normalized)) ignored = !rule.negated
    }
    return ignored
  }
}

const listFiles = (directory, extension, options = {}) => {
  const results = []
  const rootDirectory = options.rootDirectory || directory
  const isIgnored = options.isIgnored || (() => false)

  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      const relative = path.relative(rootDirectory, absolute)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (!isIgnored(relative, true)) visit(absolute)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension) && !isIgnored(relative, false)) {
        results.push(path.resolve(absolute))
      }
    }
  }

  visit(directory)
  return results.sort()
}

const validateFileSelection = ({ files, rootDirectory, allowedDirectory, extension, label }) => {
  if (files === undefined) return undefined
  const unique = new Set()
  for (const value of files) {
    if (typeof value !== 'string' || !value) throw new Error(`${label} contains an empty path`)
    const absolute = path.resolve(rootDirectory, value)
    if (!isPathInside(allowedDirectory, absolute)) {
      throw new Error(`${label} path escapes its allowed directory: ${value}`)
    }
    if (path.extname(absolute).toLowerCase() !== extension) {
      throw new Error(`${label} path does not end in ${extension}: ${value}`)
    }
    let selectedPath = absolute
    if (fs.existsSync(absolute)) {
      if (fs.lstatSync(absolute).isSymbolicLink()) {
        throw new Error(`${label} path must not be a symbolic link: ${value}`)
      }
      const realAllowed = fs.realpathSync(allowedDirectory)
      const realFile = fs.realpathSync(absolute)
      if (!isPathInside(realAllowed, realFile)) {
        throw new Error(`${label} path resolves outside its allowed directory through a symbolic link: ${value}`)
      }
      selectedPath = realFile
    }
    unique.add(selectedPath)
  }
  return [...unique].sort()
}

const classifyChangedFiles = (buffer) => {
  const pumlFiles = []
  const markdownFiles = []
  for (const item of buffer.toString('utf8').split('\0')) {
    if (!item) continue
    const extension = path.extname(item).toLowerCase()
    if (extension === '.puml') pumlFiles.push(item)
    if (extension === '.md') markdownFiles.push(item)
  }
  return { pumlFiles, markdownFiles }
}

module.exports = {
  classifyChangedFiles,
  createGitignoreMatcher,
  listFiles,
  validateFileSelection,
}

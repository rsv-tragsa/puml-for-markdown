'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { isPathInside } = require('./paths')

const INCLUDE_PATTERN = /^\s*!(include|include_once|include_many)\s+(?:"([^"]+)"|'([^']+)'|([^\s']+))(?:\s+.*)?$/gim
const REMOTE_PATTERN = /^(?:https?:|ftp:|stdlib:|<)/i

const parseLocalIncludes = (sourcePath, data) => {
  const includes = []
  for (const match of data.matchAll(INCLUDE_PATTERN)) {
    const target = match[2] || match[3] || match[4]
    if (!target || REMOTE_PATTERN.test(target) || target.includes('://')) continue
    includes.push({
      kind: match[1].toLowerCase(),
      declaration: match[0],
      target,
      path: path.resolve(path.dirname(sourcePath), target),
    })
  }
  return includes
}

const assertAllowedInclude = (includePath, allowedDirectory) => {
  const absolute = path.resolve(includePath)
  if (!allowedDirectory) return fs.existsSync(absolute) ? fs.realpathSync(absolute) : absolute
  if (!isPathInside(allowedDirectory, includePath)) {
    throw new Error(`Local !include escapes pumlDirectory: ${includePath}`)
  }
  if (fs.existsSync(includePath)) {
    const realInclude = fs.realpathSync(includePath)
    const realAllowed = fs.realpathSync(allowedDirectory)
    if (!isPathInside(realAllowed, realInclude)) {
      throw new Error(`Local !include resolves outside pumlDirectory through a symbolic link: ${includePath}`)
    }
    return realInclude
  }
  return absolute
}

const buildIncludeGraph = (pumlPaths, options = {}) => {
  const nodes = new Map(pumlPaths.map((filePath) => [path.resolve(filePath), new Set()]))
  const reverse = new Map(pumlPaths.map((filePath) => [path.resolve(filePath), new Set()]))

  for (const sourcePath of nodes.keys()) {
    const data = fs.readFileSync(sourcePath, 'utf8')
    for (const include of parseLocalIncludes(sourcePath, data)) {
      const dependencyPath = assertAllowedInclude(include.path, options.pumlDirectory)
      if (!reverse.has(dependencyPath)) reverse.set(dependencyPath, new Set())
      reverse.get(dependencyPath).add(sourcePath)
      if (nodes.has(dependencyPath)) nodes.get(sourcePath).add(dependencyPath)
    }
  }

  const visiting = new Set()
  const visited = new Set()
  const stack = []
  const visit = (sourcePath) => {
    if (visiting.has(sourcePath)) {
      const start = stack.indexOf(sourcePath)
      const cycle = [...stack.slice(start), sourcePath].map((item) => path.basename(item)).join(' -> ')
      throw new Error(`Cyclic !include dependency detected: ${cycle}`)
    }
    if (visited.has(sourcePath)) return
    visiting.add(sourcePath)
    stack.push(sourcePath)
    for (const dependency of nodes.get(sourcePath)) visit(dependency)
    stack.pop()
    visiting.delete(sourcePath)
    visited.add(sourcePath)
  }
  for (const sourcePath of nodes.keys()) visit(sourcePath)

  return { nodes, reverse }
}

const affectedConsumers = (changedPaths, reverseGraph) => {
  const affected = new Set()
  const queue = changedPaths.map((item) => path.resolve(item))
  while (queue.length) {
    const current = queue.shift()
    if (affected.has(current)) continue
    affected.add(current)
    for (const consumer of reverseGraph.get(current) || []) queue.push(consumer)
  }
  return affected
}

const expandIncludes = (sourcePath, options = {}, stack = [], includedOnce = new Set()) => {
  const absolute = path.resolve(sourcePath)
  if (stack.includes(absolute)) {
    const cycle = [...stack.slice(stack.indexOf(absolute)), absolute].map((item) => path.basename(item)).join(' -> ')
    throw new Error(`Cyclic !include dependency detected: ${cycle}`)
  }
  const data = fs.readFileSync(absolute, 'utf8')
  const includes = parseLocalIncludes(absolute, data)
  let expanded = data
  for (const include of includes) {
    const dependencyPath = assertAllowedInclude(include.path, options.pumlDirectory)
    if (!fs.existsSync(dependencyPath) || !fs.statSync(dependencyPath).isFile()) continue
    if (include.kind === 'include_once' && includedOnce.has(dependencyPath)) {
      expanded = expanded.replace(include.declaration, '')
      continue
    }
    if (include.kind === 'include_once') includedOnce.add(dependencyPath)
    const replacement = expandIncludes(dependencyPath, options, [...stack, absolute], includedOnce)
    expanded = expanded.replace(include.declaration, replacement)
  }
  return expanded
}

module.exports = {
  affectedConsumers,
  assertAllowedInclude,
  buildIncludeGraph,
  expandIncludes,
  parseLocalIncludes,
}

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { DEFAULT_MARKER_PATTERN } = require('./defaults')
const { decodeMarkdownTarget, imagePathForSource, isPathInside, localImageLink } = require('./paths')

const createMarkerRegex = (markerPattern = DEFAULT_MARKER_PATTERN, markerFlags = '') => {
  const source = markerPattern instanceof RegExp ? markerPattern.source : markerPattern
  const requestedFlags = markerPattern instanceof RegExp ? markerPattern.flags : markerFlags
  for (const group of ['kind', 'label', 'target']) {
    if (!source.includes(`(?<${group}>`)) {
      throw new Error(`markerPattern must define the named capture group "${group}"`)
    }
  }
  const flags = [...new Set(requestedFlags.replace(/[gy]/g, '').split('').concat('g'))].join('')
  try {
    return new RegExp(source, flags)
  } catch (error) {
    throw new Error(`Invalid markerPattern: ${error.message}`)
  }
}

const codeRanges = (markdown) => {
  const ranges = []
  const fenced = []
  const fencePattern = /^ {0,3}(`{3,}|~{3,})[^\r\n]*(?:\r?\n|$)/gm
  let open
  for (const match of markdown.matchAll(fencePattern)) {
    const token = match[1]
    if (!open) {
      open = { start: match.index, char: token[0], length: token.length }
    } else if (token[0] === open.char && token.length >= open.length) {
      fenced.push([open.start, match.index + match[0].length])
      open = undefined
    }
  }
  if (open) fenced.push([open.start, markdown.length])
  ranges.push(...fenced)

  const insideFence = (index) => fenced.some(([start, end]) => index >= start && index < end)
  for (let index = 0; index < markdown.length;) {
    if (markdown[index] !== '`' || insideFence(index)) {
      index += 1
      continue
    }
    let length = 1
    while (markdown[index + length] === '`') length += 1
    const token = '`'.repeat(length)
    const end = markdown.indexOf(token, index + length)
    if (end === -1) {
      index += length
      continue
    }
    ranges.push([index, end + length])
    index = end + length
  }
  return ranges.sort((a, b) => a[0] - b[0])
}

const isProtected = (start, end, ranges) => ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart)

const managedVisiblePrefix = (value) => {
  const patterns = [
    /\[!\[[^\]\r\n]*\]\([^\r\n)]*\)\]\([^\r\n)]*\)[ \t]*$/,
    /!\[[^\]\r\n]*\]\([^\r\n)]*\)[ \t]*$/,
    /\[[^\]\r\n]*\]\([^\r\n)]*\)[ \t]*$/,
  ]
  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match) return { start: value.length - match[0].length, text: match[0] }
  }
  return { start: value.length, text: '' }
}

const rewritePumlMarkers = async (markdown, {
  markerPattern,
  markerFlags,
  resolveLink,
}) => {
  const regex = createMarkerRegex(markerPattern, markerFlags)
  const ranges = codeRanges(markdown)
  const replacements = []
  let processedLinks = 0

  for (const match of markdown.matchAll(regex)) {
    if (isProtected(match.index, match.index + match[0].length, ranges)) continue
    const { kind, label, target } = match.groups || {}
    if (kind === undefined || label === undefined || target === undefined) {
      throw new Error('markerPattern did not produce the required named groups: kind, label, target')
    }
    const destination = await resolveLink({ kind, label, target, marker: match[0] })
    if (!destination) continue
    const prefix = markdown.slice(0, match.index)
    const prior = managedVisiblePrefix(prefix)
    const visible = kind.includes('!')
      ? destination.wrapImage
        ? `[![${label}](${destination.url})](${destination.url})`
        : `![${label}](${destination.url})`
      : `[${label}](${destination.url})`
    replacements.push({ start: prior.start, end: match.index + match[0].length, value: `${visible}${match[0]}` })
    processedLinks += 1
  }

  let content = markdown
  for (const replacement of replacements.reverse()) {
    content = content.slice(0, replacement.start) + replacement.value + content.slice(replacement.end)
  }
  return { content, processedLinks }
}

const processMarkdownFile = async ({
  markdownPath,
  pumlDirectory,
  distDirectory,
  localImageFormat,
  linkMode,
  markerPattern,
  markerFlags,
  resolveServerLink,
}) => {
  const original = fs.readFileSync(markdownPath, 'utf8')
  const result = await rewritePumlMarkers(original, {
    markerPattern,
    markerFlags,
    resolveLink: async ({ target }) => {
      const decoded = decodeMarkdownTarget(target)
      const sourcePath = path.resolve(path.dirname(markdownPath), decoded)
      if (!isPathInside(pumlDirectory, sourcePath)) {
        throw new Error(`Markdown marker in ${markdownPath} points outside pumlDirectory: ${target}`)
      }
      if (!fs.existsSync(sourcePath)) throw new Error(`Markdown marker references missing PUML file: ${target}`)
      if (fs.lstatSync(sourcePath).isSymbolicLink()) {
        throw new Error(`Markdown marker references a symbolic link instead of a PUML file: ${target}`)
      }
      if (!fs.statSync(sourcePath).isFile()) throw new Error(`Markdown marker does not reference a file: ${target}`)
      if (!isPathInside(fs.realpathSync(pumlDirectory), fs.realpathSync(sourcePath))) {
        throw new Error(`Markdown marker resolves outside pumlDirectory through a symbolic link: ${target}`)
      }
      if (linkMode !== 'local') return { url: await resolveServerLink(sourcePath), wrapImage: true }
      const imagePath = imagePathForSource({ pumlDirectory, distDirectory, sourcePath, format: localImageFormat })
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Local ${localImageFormat.toUpperCase()} image does not exist for ${target}: ${imagePath}`)
      }
      if (fs.lstatSync(imagePath).isSymbolicLink()) {
        throw new Error(`Local image must not be a symbolic link: ${imagePath}`)
      }
      if (!isPathInside(fs.realpathSync(distDirectory), fs.realpathSync(imagePath))) {
        throw new Error(`Local image resolves outside distDirectory through a symbolic link: ${imagePath}`)
      }
      return { url: localImageLink({ markdownPath, imagePath }), wrapImage: false }
    },
  })
  if (result.content !== original) fs.writeFileSync(markdownPath, result.content)
  return { ...result, changed: result.content !== original }
}

module.exports = {
  DEFAULT_MARKER_PATTERN,
  codeRanges,
  createMarkerRegex,
  processMarkdownFile,
  rewritePumlMarkers,
}

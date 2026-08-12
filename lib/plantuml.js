'use strict'

const fs = require('node:fs')
const path = require('node:path')
const plantUmlEncoder = require('plantuml-encoder')
const { expandIncludes } = require('./includes')

const getFullPumlUrl = ({ imgFormat, encodedData, pumlServerUrl }) =>
  `${pumlServerUrl.replace(/\/+$/, '')}/${imgFormat}/${encodedData}`

const encodePuml = (data) => plantUmlEncoder.encode(data)

const defaultFetchBuffer = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    const error = new Error(`PlantUML server returned HTTP ${response.status} for ${url}`)
    error.statusCode = response.status
    throw error
  }
  return Buffer.from(await response.arrayBuffer())
}

const createLinkResolver = ({ pumlServerUrl, linkMode, shortener }) => {
  let lazyShortener = shortener
  return async ({ encodedData, imgFormat = 'svg' }) => {
    const fullUrl = getFullPumlUrl({ imgFormat, encodedData, pumlServerUrl })
    if (linkMode !== 'tinyurl') return fullUrl
    if (!lazyShortener) lazyShortener = require('tinyurl').shorten
    return lazyShortener(fullUrl)
  }
}

const processPumlContent = async ({
  sourcePath,
  pumlDirectory,
  allPumlPaths,
  pumlServerUrl,
  linkMode,
  shortener,
  cache = new Map(),
  stack = [],
}) => {
  const absolute = path.resolve(sourcePath)
  if (cache.has(absolute)) return cache.get(absolute)
  if (stack.includes(absolute)) {
    const cycle = [...stack.slice(stack.indexOf(absolute)), absolute].map((item) => path.basename(item)).join(' -> ')
    throw new Error(`Cyclic diagram link dependency detected: ${cycle}`)
  }
  if (!fs.existsSync(absolute) || !allPumlPaths.has(absolute)) return undefined

  let data = expandIncludes(absolute, { pumlDirectory })
  const linkedPaths = [...data.matchAll(/\$link\s*=\s*["']([^"']+)["']/g)]
  for (const match of linkedPaths) {
    const linkedPath = path.resolve(path.dirname(absolute), match[1])
    const linked = await processPumlContent({
      sourcePath: linkedPath,
      pumlDirectory,
      allPumlPaths,
      pumlServerUrl,
      linkMode,
      shortener,
      cache,
      stack: [...stack, absolute],
    })
    if (!linked) continue
    const resolver = createLinkResolver({ pumlServerUrl, linkMode, shortener })
    if (!linked.url) linked.url = await resolver({ encodedData: linked.encodedData })
    data = data.replaceAll(match[0], `$link="${linked.url}"`)
  }

  const value = { data, encodedData: encodePuml(data) }
  cache.set(absolute, value)
  return value
}

module.exports = {
  createLinkResolver,
  defaultFetchBuffer,
  encodePuml,
  getFullPumlUrl,
  processPumlContent,
}

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { DEFAULT_CONFIG } = require('./defaults')
const { affectedConsumers, buildIncludeGraph } = require('./includes')
const { assertSafeDistDirectory, cleanupOrphanImages, saveDiagram } = require('./images')
const { processMarkdownFile } = require('./markdown')
const { createLinkResolver, defaultFetchBuffer, processPumlContent } = require('./plantuml')
const { isPathInside, resolveConfiguredDirectory } = require('./paths')
const { createGitignoreMatcher, listFiles, validateFileSelection } = require('./selection')

const VALID_FORMATS = new Set(['png', 'svg'])
const VALID_LINK_MODES = new Set(['tinyurl', 'server', 'local'])

const normalizeFormats = (value = DEFAULT_CONFIG.imageFormats) => {
  const formats = Array.isArray(value) ? value : value === 'both' ? ['png', 'svg'] : [value]
  const normalized = [...new Set(formats.map((item) => String(item).toLowerCase()))]
  if (!normalized.length || normalized.some((item) => !VALID_FORMATS.has(item))) {
    throw new Error(`imageFormats must contain png, svg, or both; received: ${value}`)
  }
  return normalized
}

const manifestPath = (distDirectory) => path.join(distDirectory, '.puml-for-markdown.json')

const readManifest = (distDirectory) => {
  const filePath = manifestPath(distDirectory)
  if (!fs.existsSync(filePath)) return { version: 1, images: [] }
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const images = Array.isArray(value.images) ? value.images : []
    for (const image of images) {
      const absolute = typeof image === 'string' ? path.resolve(distDirectory, image) : ''
      if (
        !absolute ||
        !isPathInside(distDirectory, absolute) ||
        !['.png', '.svg'].includes(path.extname(absolute).toLowerCase())
      ) {
        throw new Error(`Managed image manifest contains an unsafe entry: ${JSON.stringify(image)}`)
      }
    }
    return { version: 1, images }
  } catch (error) {
    throw new Error(`Cannot read managed image manifest ${filePath}: ${error.message}`)
  }
}

const writeManifest = (distDirectory, images) => {
  fs.mkdirSync(distDirectory, { recursive: true })
  const filePath = manifestPath(distDirectory)
  const temporary = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify({ version: 1, images: [...images].sort() }, null, 2)}\n`)
  fs.renameSync(temporary, filePath)
}

const run = async (options = {}) => {
  const rootDirectory = path.resolve(options.rootDirectory ?? DEFAULT_CONFIG.rootDirectory)
  const pumlDirectory = resolveConfiguredDirectory(rootDirectory, options.pumlDirectory ?? DEFAULT_CONFIG.pumlDirectory, 'pumlDirectory')
  const markdownDirectory = resolveConfiguredDirectory(rootDirectory, options.markdownDirectory ?? DEFAULT_CONFIG.markdownDirectory, 'markdownDirectory')
  const distDirectory = resolveConfiguredDirectory(rootDirectory, options.distDirectory ?? DEFAULT_CONFIG.distDirectory, 'distDirectory')
  const imageFormats = normalizeFormats(options.imageFormats)
  const linkMode = options.linkMode ?? (options.shouldShortenLinks === false ? 'server' : DEFAULT_CONFIG.linkMode)
  const localImageFormat = String(options.localImageFormat ?? DEFAULT_CONFIG.localImageFormat).toLowerCase()
  const pumlServerUrl = options.pumlServerUrl ?? DEFAULT_CONFIG.pumlServerUrl
  const outputImages = options.outputImages ?? DEFAULT_CONFIG.outputImages
  const regenerateAll = options.regenerateAll ?? DEFAULT_CONFIG.regenerateAll
  const deleteOrphanImages = options.deleteOrphanImages ?? DEFAULT_CONFIG.deleteOrphanImages
  const markerPattern = options.markerPattern ?? DEFAULT_CONFIG.markerPattern
  const markerFlags = options.markerFlags ?? DEFAULT_CONFIG.markerFlags
  if (!VALID_LINK_MODES.has(linkMode)) throw new Error(`Invalid linkMode: ${linkMode}`)
  if (!VALID_FORMATS.has(localImageFormat)) throw new Error(`Invalid localImageFormat: ${localImageFormat}`)
  if (!fs.existsSync(rootDirectory)) throw new Error(`rootDirectory does not exist: ${rootDirectory}`)
  if (!fs.existsSync(pumlDirectory)) throw new Error(`pumlDirectory does not exist: ${pumlDirectory}`)
  if (!fs.existsSync(markdownDirectory)) throw new Error(`markdownDirectory does not exist: ${markdownDirectory}`)
  if (outputImages || deleteOrphanImages || linkMode === 'local') {
    assertSafeDistDirectory({ rootDirectory, pumlDirectory, distDirectory })
  }

  const gitignorePath = path.resolve(rootDirectory, options.gitignorePath ?? DEFAULT_CONFIG.gitignorePath)
  const isIgnored = createGitignoreMatcher(gitignorePath, options.respectGitignore ?? DEFAULT_CONFIG.respectGitignore)
  const allPumlPaths = new Set(listFiles(pumlDirectory, '.puml', { rootDirectory, isIgnored }))
  const graph = buildIncludeGraph([...allPumlPaths], { pumlDirectory })

  const requestedPuml = validateFileSelection({
    files: options.pumlFiles,
    rootDirectory,
    allowedDirectory: pumlDirectory,
    extension: '.puml',
    label: 'pumlFiles',
  })
  let selectedPuml
  if (regenerateAll || requestedPuml === undefined) selectedPuml = new Set(allPumlPaths)
  else selectedPuml = affectedConsumers(requestedPuml, graph.reverse)
  selectedPuml = new Set([...selectedPuml].filter((item) => allPumlPaths.has(item)))

  const requestedMarkdown = validateFileSelection({
    files: options.markdownFiles,
    rootDirectory,
    allowedDirectory: markdownDirectory,
    extension: '.md',
    label: 'markdownFiles',
  })
  const selectedMarkdown = requestedMarkdown === undefined
    ? listFiles(markdownDirectory, '.md', { rootDirectory, isIgnored })
    : requestedMarkdown.filter((item) => fs.existsSync(item) && fs.statSync(item).isFile())

  const contentCache = new Map()
  const contentFor = (sourcePath) => processPumlContent({
    sourcePath,
    pumlDirectory,
    allPumlPaths,
    pumlServerUrl,
    linkMode,
    shortener: options.shortener,
    cache: contentCache,
  })
  const fetchBuffer = options.fetchBuffer || defaultFetchBuffer
  const generatedImages = []
  const skippedAuxiliary = []
  const managesImages = Boolean(outputImages || deleteOrphanImages)
  const oldManifest = managesImages ? readManifest(distDirectory) : { version: 1, images: [] }
  const managed = new Set(oldManifest.images)
  if (outputImages) {
    for (const sourcePath of selectedPuml) {
      const processed = await contentFor(sourcePath)
      for (const format of imageFormats) {
        try {
          const imagePath = await saveDiagram({
            pumlDirectory,
            distDirectory,
            sourcePath,
            format,
            encodedData: processed.encodedData,
            pumlServerUrl,
            fetchBuffer,
          })
          generatedImages.push(imagePath)
          managed.add(path.relative(distDirectory, imagePath).split(path.sep).join('/'))
        } catch (error) {
          const isAuxiliary = (graph.reverse.get(sourcePath) || new Set()).size > 0
          if (error.statusCode === 400 && isAuxiliary) {
            skippedAuxiliary.push(sourcePath)
            break
          }
          if (generatedImages.length) writeManifest(distDirectory, managed)
          throw error
        }
      }
    }
  }

  let removedImages = []
  if (deleteOrphanImages) {
    const deletionCandidates = requestedPuml === undefined ? [] : requestedPuml.filter((item) => !fs.existsSync(item))
    removedImages = cleanupOrphanImages({
      rootDirectory,
      pumlDirectory,
      distDirectory,
      allPumlPaths,
      managedImages: managed,
      deletedSources: deletionCandidates,
      imageFormats,
    })
    for (const imagePath of removedImages) managed.delete(path.relative(distDirectory, imagePath).split(path.sep).join('/'))
  }
  if (outputImages || deleteOrphanImages) writeManifest(distDirectory, managed)

  const serverLink = createLinkResolver({ pumlServerUrl, linkMode, shortener: options.shortener })
  const markdownResults = []
  for (const markdownPath of selectedMarkdown) {
    markdownResults.push(await processMarkdownFile({
      markdownPath,
      pumlDirectory,
      distDirectory,
      localImageFormat,
      linkMode,
      markerPattern,
      markerFlags,
      resolveServerLink: async (sourcePath) => {
        const processed = await contentFor(sourcePath)
        if (!processed) throw new Error(`PUML source is not available: ${sourcePath}`)
        if (!processed.url) processed.url = await serverLink({ encodedData: processed.encodedData, imgFormat: 'svg' })
        return processed.url
      },
    }))
  }

  return {
    rootDirectory,
    pumlDirectory,
    markdownDirectory,
    distDirectory,
    selectedPuml: [...selectedPuml],
    selectedMarkdown,
    generatedImages,
    removedImages,
    skippedAuxiliary,
    markdownResults,
  }
}

module.exports = { normalizeFormats, run }

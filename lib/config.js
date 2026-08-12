'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { CONFIG_KEYS, DEFAULT_CONFIG, DEFAULT_CONFIG_FILENAME } = require('./defaults')

const STRING_KEYS = new Set([
  'rootDirectory',
  'pumlDirectory',
  'markdownDirectory',
  'distDirectory',
  'pumlServerUrl',
  'linkMode',
  'localImageFormat',
  'markerFlags',
  'gitignorePath',
])
const BOOLEAN_KEYS = new Set([
  'outputImages',
  'regenerateAll',
  'deleteOrphanImages',
  'respectGitignore',
  'changedFilesStdin0',
  'hotReload',
])

const validateConfig = (config, configPath) => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Configuration must export an object: ${configPath}`)
  }
  const unknown = Object.keys(config).filter((key) => !CONFIG_KEYS.has(key))
  if (unknown.length) {
    throw new Error(`Unknown configuration option${unknown.length > 1 ? 's' : ''} in ${configPath}: ${unknown.join(', ')}`)
  }
  for (const [key, value] of Object.entries(config)) {
    if (STRING_KEYS.has(key) && typeof value !== 'string') {
      throw new Error(`Configuration option ${key} must be a string in ${configPath}`)
    }
    if (BOOLEAN_KEYS.has(key) && typeof value !== 'boolean') {
      throw new Error(`Configuration option ${key} must be a boolean in ${configPath}`)
    }
  }
  for (const key of ['pumlFiles', 'markdownFiles']) {
    if (hasOwn(config, key) && (!Array.isArray(config[key]) || config[key].some((item) => typeof item !== 'string'))) {
      throw new Error(`Configuration option ${key} must be an array of paths in ${configPath}`)
    }
  }
  if (
    hasOwn(config, 'imageFormats') &&
    typeof config.imageFormats !== 'string' &&
    (!Array.isArray(config.imageFormats) || config.imageFormats.some((item) => typeof item !== 'string'))
  ) {
    throw new Error(`Configuration option imageFormats must be a string or an array in ${configPath}`)
  }
  if (hasOwn(config, 'markerPattern') && typeof config.markerPattern !== 'string' && !(config.markerPattern instanceof RegExp)) {
    throw new Error(`Configuration option markerPattern must be a string or RegExp in ${configPath}`)
  }
  if (
    hasOwn(config, 'intervalSeconds') &&
    (typeof config.intervalSeconds !== 'number' || !Number.isFinite(config.intervalSeconds) || config.intervalSeconds <= 0)
  ) {
    throw new Error(`Configuration option intervalSeconds must be a positive number in ${configPath}`)
  }
  return config
}

const loadConfig = ({ explicitPath, searchDirectory }) => {
  const configPath = explicitPath
    ? path.resolve(process.cwd(), explicitPath)
    : path.join(path.resolve(searchDirectory), DEFAULT_CONFIG_FILENAME)
  if (!fs.existsSync(configPath)) {
    if (explicitPath) throw new Error(`Configuration file does not exist: ${configPath}`)
    return { config: {}, configPath: undefined, configDirectory: path.resolve(searchDirectory) }
  }
  if (!fs.statSync(configPath).isFile()) throw new Error(`Configuration path is not a file: ${configPath}`)
  if (path.extname(configPath).toLowerCase() !== '.cjs') {
    throw new Error(`Configuration file must use the .cjs extension: ${configPath}`)
  }
  const resolvedPath = require.resolve(configPath)
  delete require.cache[resolvedPath]
  const config = validateConfig(require(resolvedPath), configPath)
  return { config, configPath, configDirectory: path.dirname(configPath) }
}

const loadProjectConfig = ({ explicitPath, searchDirectory = process.cwd() } = {}) => {
  const loaded = loadConfig({ explicitPath, searchDirectory })
  return {
    ...DEFAULT_CONFIG,
    ...loaded.config,
    rootDirectory: path.resolve(
      loaded.configDirectory,
      hasOwn(loaded.config, 'rootDirectory') ? loaded.config.rootDirectory : DEFAULT_CONFIG.rootDirectory,
    ),
  }
}

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

module.exports = { loadConfig, loadProjectConfig, validateConfig }

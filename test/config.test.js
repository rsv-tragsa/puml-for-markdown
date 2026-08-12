'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { resolveCliOptions } = require('../bin/index')
const { loadConfig, loadProjectConfig } = require('../lib/config')
const { DEFAULT_CONFIG, DEFAULT_CONFIG_FILENAME, DEFAULT_MARKER_PATTERN } = require('../lib/defaults')
const { createWorkspace, write } = require('./helpers')

test('loads the conventional configuration file and resolves its root relative to that file', () => {
  const workspace = createWorkspace()
  const configPath = write(path.join(workspace.root, DEFAULT_CONFIG_FILENAME), `
    module.exports = {
      rootDirectory: 'project',
      pumlDirectory: 'architecture/puml',
      markdownDirectory: 'documentation',
      distDirectory: 'generated/diagrams',
      outputImages: true,
      imageFormats: ['png', 'svg'],
      linkMode: 'local',
      localImageFormat: 'png',
      markerPattern: /<puml (?<kind>!?):(?<label>[^:]*):(?<target>[^>]+\\.puml)>/gi,
    }
  `)
  const loaded = loadConfig({ searchDirectory: workspace.root })
  assert.equal(loaded.configPath, configPath)
  const effective = resolveCliOptions({ config: configPath })
  assert.equal(effective.rootDirectory, path.join(workspace.root, 'project'))
  assert.equal(effective.pumlDirectory, 'architecture/puml')
  assert.equal(effective.distDirectory, 'generated/diagrams')
  assert.deepEqual(effective.imageFormats, ['png', 'svg'])
  assert.equal(effective.markerPattern instanceof RegExp, true)
})

test('explicit CLI values override the configuration file', () => {
  const workspace = createWorkspace()
  const configPath = write(path.join(workspace.root, 'custom.cjs'), `
    module.exports = {
      rootDirectory: 'configured-root',
      distDirectory: 'configured-dist',
      outputImages: true,
      linkMode: 'local',
      regenerateAll: true
    }
  `)
  const effective = resolveCliOptions({
    config: configPath,
    rootDirectory: workspace.root,
    distDirectory: 'cli-dist',
    outputImages: false,
    linkMode: 'server',
    regenerateAll: false,
  })
  assert.equal(effective.rootDirectory, workspace.root)
  assert.equal(effective.distDirectory, 'cli-dist')
  assert.equal(effective.outputImages, false)
  assert.equal(effective.linkMode, 'server')
  assert.equal(effective.regenerateAll, false)
})

test('falls back to centralized built-in defaults when no project file exists', () => {
  const workspace = createWorkspace()
  const effective = resolveCliOptions({ rootDirectory: workspace.root })
  assert.equal(effective.pumlDirectory, DEFAULT_CONFIG.pumlDirectory)
  assert.equal(effective.distDirectory, DEFAULT_CONFIG.distDirectory)
  assert.equal(effective.linkMode, DEFAULT_CONFIG.linkMode)
  assert.equal(effective.markerPattern, DEFAULT_MARKER_PATTERN)
})

test('loads a directly usable configuration object for the programmatic API', () => {
  const workspace = createWorkspace()
  write(path.join(workspace.root, DEFAULT_CONFIG_FILENAME), `
    module.exports = { rootDirectory: 'project', distDirectory: 'generated', linkMode: 'server' }
  `)
  const config = loadProjectConfig({ searchDirectory: workspace.root })
  assert.equal(config.rootDirectory, path.join(workspace.root, 'project'))
  assert.equal(config.distDirectory, 'generated')
  assert.equal(config.linkMode, 'server')
  assert.deepEqual(config.imageFormats, ['svg'])
})

test('rejects missing explicit files and unknown configuration keys', () => {
  const workspace = createWorkspace()
  assert.throws(
    () => loadConfig({ explicitPath: path.join(workspace.root, 'missing.cjs'), searchDirectory: workspace.root }),
    /does not exist/,
  )
  const configPath = write(path.join(workspace.root, 'invalid.cjs'), 'module.exports = { distDirectry: "typo" }\n')
  assert.throws(
    () => loadConfig({ explicitPath: configPath, searchDirectory: workspace.root }),
    /Unknown configuration option.*distDirectry/,
  )
  const invalidType = write(path.join(workspace.root, 'invalid-type.cjs'), 'module.exports = { pumlFiles: "a.puml" }\n')
  assert.throws(
    () => loadConfig({ explicitPath: invalidType, searchDirectory: workspace.root }),
    /pumlFiles must be an array/,
  )
})

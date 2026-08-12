'use strict'

const DEFAULT_MARKER_PATTERN = String.raw`<!--\s*(?<kind>!?)\[(?<label>[^\]]*)\]\((?<target>[^)\r\n]+\.puml)\)\s*-->`
const DEFAULT_CONFIG_FILENAME = 'puml-for-markdown.config.cjs'

const DEFAULT_CONFIG = Object.freeze({
  rootDirectory: '.',
  pumlDirectory: './docs/puml',
  markdownDirectory: './docs',
  distDirectory: './docs/puml/dist',
  outputImages: false,
  imageFormats: Object.freeze(['svg']),
  pumlServerUrl: 'https://www.plantuml.com/plantuml',
  linkMode: 'local',
  localImageFormat: 'svg',
  regenerateAll: false,
  deleteOrphanImages: false,
  markerPattern: DEFAULT_MARKER_PATTERN,
  markerFlags: '',
  respectGitignore: true,
  gitignorePath: '.gitignore',
  changedFilesStdin0: false,
  hotReload: false,
  intervalSeconds: 2,
})

// pumlFiles and markdownFiles are intentionally optional: omitting them means
// a historical full scan, whereas [] is an explicit empty selection.
const CONFIG_KEYS = Object.freeze(new Set([
  ...Object.keys(DEFAULT_CONFIG),
  'pumlFiles',
  'markdownFiles',
]))

module.exports = {
  CONFIG_KEYS,
  DEFAULT_CONFIG,
  DEFAULT_CONFIG_FILENAME,
  DEFAULT_MARKER_PATTERN,
}

'use strict'

/**
 * Project defaults for puml-for-markdown.
 *
 * Relative directories are resolved from rootDirectory. A relative
 * rootDirectory is resolved from this configuration file's directory.
 * Explicit CLI flags always take precedence over these values.
 */
module.exports = {
  rootDirectory: '.',
  pumlDirectory: './docs/puml',
  markdownDirectory: './docs',
  distDirectory: './docs/puml/dist',

  outputImages: false,
  imageFormats: ['svg'], // ['png'], ['svg'], ['png', 'svg'], or 'both'

  pumlServerUrl: 'https://www.plantuml.com/plantuml',
  linkMode: 'local', // 'tinyurl', 'server', or 'local'
  localImageFormat: 'svg',

  regenerateAll: false,
  deleteOrphanImages: false,

  markerPattern: /<!--\s*(?<kind>!?)\[(?<label>[^\]]*)\]\((?<target>[^)\r\n]+\.puml)\)\s*-->/g,
  markerFlags: '',

  respectGitignore: true,
  gitignorePath: '.gitignore',

  changedFilesStdin0: false,
  hotReload: false,
  intervalSeconds: 2,

  // Selection is optional. Omitted means a full scan; [] means select none.
  // pumlFiles: [],
  // markdownFiles: [],
}

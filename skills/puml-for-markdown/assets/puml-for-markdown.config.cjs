'use strict'

module.exports = {
  rootDirectory: '.',
  pumlDirectory: './docs/puml',
  markdownDirectory: './docs',
  distDirectory: './docs/puml/dist',

  outputImages: true,
  imageFormats: ['svg'],
  pumlServerUrl: 'https://www.plantuml.com/plantuml',
  linkMode: 'local',
  localImageFormat: 'svg',

  regenerateAll: false,
  deleteOrphanImages: true,
  respectGitignore: true,
  gitignorePath: '.gitignore',
}

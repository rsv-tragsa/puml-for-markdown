#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { Command, Option } = require('commander')
const { run } = require('../index')
const { loadConfig } = require('../lib/config')
const { DEFAULT_CONFIG, DEFAULT_CONFIG_FILENAME } = require('../lib/defaults')
const { isPathInside } = require('../lib/paths')
const { classifyChangedFiles } = require('../lib/selection')

const collect = (value, previous = []) => previous.concat(value)
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

const createProgram = () => new Command()
  .name('puml-for-markdown')
  .description('Generate PlantUML images and update managed links in Markdown.')
  .option('-c, --config <path>', `Configuration file (auto-detects ${DEFAULT_CONFIG_FILENAME})`)
  .option('-s, --puml-server-url <url>', 'PlantUML server base URL')
  .addOption(new Option('-x, --root-directory <path>', 'Project root'))
  .option('-r, --hot-reload', 'Rerun using the selected files every interval')
  .option('--no-hot-reload', 'Disable hot reload configured in the file')
  .option('-v, --interval-seconds <number>', 'Hot reload interval in seconds', Number)
  .option('-p, --puml-directory <path>', 'Directory containing PUML sources')
  .option('-m, --markdown-directory <path>', 'Directory containing Markdown files')
  .option('-g, --ignore-gitignore', 'Do not apply patterns from .gitignore')
  .option('--respect-gitignore', 'Apply .gitignore even when disabled in the configuration file')
  .option('-i, --gitignore-path <path>', 'Path to a .gitignore file')
  .option('-d, --output-images', 'Download generated diagram images')
  .option('--no-output-images', 'Disable image output configured in the file')
  .addOption(new Option('-b, --dist-directory <path>', 'Directory for generated images'))
  .addOption(new Option('-f, --image-formats <format>', 'Generated image format').choices(['png', 'svg', 'both']))
  .addOption(new Option('--link-mode <mode>', 'Visible Markdown link mode').choices(['tinyurl', 'server', 'local']))
  .addOption(new Option('--local-image-format <format>', 'Image used by local Markdown links').choices(['png', 'svg']))
  .option('-t, --turn-off-link-shortening', 'Deprecated alias for --link-mode server')
  .option('--puml-file <path>', 'Select one changed PUML file (repeatable)', collect)
  .option('--markdown-file <path>', 'Select one changed Markdown file (repeatable)', collect)
  .option('--changed-files-stdin0', 'Read NUL-separated changed paths and ignore files outside configured directories')
  .option('--regenerate-all', 'Generate every PUML below pumlDirectory')
  .option('--no-regenerate-all', 'Disable full regeneration configured in the file')
  .option('--delete-orphan-images', 'Delete only managed images whose source no longer exists')
  .option('--no-delete-orphan-images', 'Disable orphan cleanup configured in the file')
  .option('--marker-pattern <regex>', 'Full marker regular expression with kind, label, and target named groups')
  .option('--marker-flags <flags>', 'Flags for --marker-pattern (global matching is always enabled)')

const configuredValue = (opts, optionName, config, configName = optionName) => {
  if (opts[optionName] !== undefined) return opts[optionName]
  if (hasOwn(config, configName)) return config[configName]
  return DEFAULT_CONFIG[configName]
}

const resolveCliOptions = (opts) => {
  if (opts.turnOffLinkShortening && opts.linkMode && opts.linkMode !== 'server') {
    throw new Error('--turn-off-link-shortening conflicts with --link-mode; use --link-mode server')
  }
  if (opts.ignoreGitignore && opts.respectGitignore) {
    throw new Error('--ignore-gitignore conflicts with --respect-gitignore')
  }

  const discoveryRoot = path.resolve(opts.rootDirectory || process.cwd())
  const loaded = loadConfig({ explicitPath: opts.config, searchDirectory: discoveryRoot })
  const configuredRoot = path.resolve(
    loaded.configDirectory,
    hasOwn(loaded.config, 'rootDirectory') ? loaded.config.rootDirectory : DEFAULT_CONFIG.rootDirectory,
  )
  const rootDirectory = opts.rootDirectory !== undefined
    ? path.resolve(opts.rootDirectory)
    : configuredRoot

  let respectGitignore = configuredValue(opts, 'respectGitignore', loaded.config)
  if (opts.ignoreGitignore) respectGitignore = false

  return {
    rootDirectory,
    pumlDirectory: configuredValue(opts, 'pumlDirectory', loaded.config),
    markdownDirectory: configuredValue(opts, 'markdownDirectory', loaded.config),
    distDirectory: configuredValue(opts, 'distDirectory', loaded.config),
    pumlServerUrl: configuredValue(opts, 'pumlServerUrl', loaded.config),
    outputImages: configuredValue(opts, 'outputImages', loaded.config),
    imageFormats: configuredValue(opts, 'imageFormats', loaded.config),
    linkMode: opts.turnOffLinkShortening ? 'server' : configuredValue(opts, 'linkMode', loaded.config),
    localImageFormat: configuredValue(opts, 'localImageFormat', loaded.config),
    pumlFiles: opts.pumlFile !== undefined ? opts.pumlFile : loaded.config.pumlFiles,
    markdownFiles: opts.markdownFile !== undefined ? opts.markdownFile : loaded.config.markdownFiles,
    changedFilesStdin0: configuredValue(opts, 'changedFilesStdin0', loaded.config),
    regenerateAll: configuredValue(opts, 'regenerateAll', loaded.config),
    deleteOrphanImages: configuredValue(opts, 'deleteOrphanImages', loaded.config),
    markerPattern: configuredValue(opts, 'markerPattern', loaded.config),
    markerFlags: configuredValue(opts, 'markerFlags', loaded.config),
    respectGitignore,
    gitignorePath: configuredValue(opts, 'gitignorePath', loaded.config),
    hotReload: configuredValue(opts, 'hotReload', loaded.config),
    intervalSeconds: configuredValue(opts, 'intervalSeconds', loaded.config),
    configPath: loaded.configPath,
  }
}

const optionsForRun = (effective, stdinBuffer) => {
  let stdinSelection
  if (effective.changedFilesStdin0) {
    const classified = classifyChangedFiles(stdinBuffer || Buffer.alloc(0))
    const pumlDirectory = path.resolve(effective.rootDirectory, effective.pumlDirectory)
    const markdownDirectory = path.resolve(effective.rootDirectory, effective.markdownDirectory)
    stdinSelection = {
      pumlFiles: classified.pumlFiles.filter((file) =>
        isPathInside(pumlDirectory, path.resolve(effective.rootDirectory, file))),
      markdownFiles: classified.markdownFiles.filter((file) =>
        isPathInside(markdownDirectory, path.resolve(effective.rootDirectory, file))),
    }
  }
  const pumlSelectionProvided = effective.changedFilesStdin0 || effective.pumlFiles !== undefined
  const markdownSelectionProvided = effective.changedFilesStdin0 || effective.markdownFiles !== undefined
  return {
    rootDirectory: effective.rootDirectory,
    pumlDirectory: effective.pumlDirectory,
    markdownDirectory: effective.markdownDirectory,
    distDirectory: effective.distDirectory,
    pumlServerUrl: effective.pumlServerUrl,
    outputImages: effective.outputImages,
    imageFormats: effective.imageFormats,
    linkMode: effective.linkMode,
    localImageFormat: effective.localImageFormat,
    pumlFiles: pumlSelectionProvided
      ? [...(effective.pumlFiles || []), ...(stdinSelection?.pumlFiles || [])]
      : undefined,
    markdownFiles: markdownSelectionProvided
      ? [...(effective.markdownFiles || []), ...(stdinSelection?.markdownFiles || [])]
      : undefined,
    regenerateAll: effective.regenerateAll,
    deleteOrphanImages: effective.deleteOrphanImages,
    markerPattern: effective.markerPattern,
    markerFlags: effective.markerFlags,
    respectGitignore: effective.respectGitignore,
    gitignorePath: effective.gitignorePath,
  }
}

const main = async (argv = process.argv, stdin = process.stdin) => {
  const program = createProgram()
  program.parse(argv)
  const effective = resolveCliOptions(program.opts())
  const stdinBuffer = effective.changedFilesStdin0 ? fs.readFileSync(stdin.fd) : undefined
  const runOptions = optionsForRun(effective, stdinBuffer)
  const execute = async () => {
    const result = await run(runOptions)
    console.info(
      `PUML generated: ${result.generatedImages.length}; Markdown processed: ${result.selectedMarkdown.length}; orphan images deleted: ${result.removedImages.length}`,
    )
    return result
  }
  await execute()
  if (effective.hotReload) {
    const interval = Number(effective.intervalSeconds)
    if (!Number.isFinite(interval) || interval <= 0) throw new Error('--interval-seconds must be a positive number')
    setInterval(() => execute().catch((error) => {
      console.error(error.stack || error.message)
      process.exitCode = 1
    }), interval * 1000)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`puml-for-markdown: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = { createProgram, main, optionsForRun, resolveCliOptions }

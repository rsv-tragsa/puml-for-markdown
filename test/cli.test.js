'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const test = require('node:test')
const { createWorkspace, diagram, write } = require('./helpers')

const cliPath = path.resolve(__dirname, '..', 'bin', 'index.js')

const execute = (args, input = Buffer.alloc(0)) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [cliPath, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
  const stdout = []
  const stderr = []
  child.stdout.on('data', (chunk) => stdout.push(chunk))
  child.stderr.on('data', (chunk) => stderr.push(chunk))
  child.on('error', reject)
  child.on('close', (code) => resolve({ code, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() }))
  child.stdin.end(input)
})

test('real CLI classifies NUL-delimited paths with spaces and Unicode and keeps empty PUML selection', async () => {
  const workspace = createWorkspace()
  const source = write(path.join(workspace.pumlDirectory, 'área ñ', 'diagrama.puml'), diagram())
  write(path.join(workspace.distDirectory, 'área ñ', 'diagrama.svg'), 'svg')
  const markdown = write(
    path.join(workspace.markdownDirectory, 'guía con espacios.md'),
    '<!--![A](puml/%C3%A1rea%20%C3%B1/diagrama.puml)-->\n',
  )
  const relativeMarkdown = path.relative(workspace.root, markdown)
  const result = await execute([
    '--root-directory', workspace.root,
    '--puml-directory', 'docs/puml',
    '--markdown-directory', 'docs',
    '--dist-directory', 'docs/puml/dist',
    '--link-mode', 'local',
    '--local-image-format', 'svg',
    '--changed-files-stdin0',
  ], Buffer.from(`${relativeMarkdown}\0notes.txt\0`))
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /PUML generated: 0; Markdown processed: 1/)
  assert.match(fs.readFileSync(markdown, 'utf8'), /puml\/dist\/%C3%A1rea%20%C3%B1\/diagrama\.svg/)
  assert.equal(fs.existsSync(source), true)
})

test('changed-files stdin ignores Markdown and PUML paths outside configured directories', async () => {
  const workspace = createWorkspace()
  const outsideMarkdown = write(path.join(workspace.root, 'README.md'), '# Outside\n')
  const outsidePuml = write(path.join(workspace.root, 'outside.puml'), diagram())
  const result = await execute([
    '--root-directory', workspace.root,
    '--puml-directory', 'docs/puml',
    '--markdown-directory', 'docs',
    '--dist-directory', 'docs/puml/dist',
    '--link-mode', 'server',
    '--changed-files-stdin0',
  ], Buffer.from(`${path.relative(workspace.root, outsideMarkdown)}\0${path.relative(workspace.root, outsidePuml)}\0`))
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /PUML generated: 0; Markdown processed: 0/)
  assert.equal(fs.readFileSync(outsideMarkdown, 'utf8'), '# Outside\n')
})

test('an explicit Markdown selection outside markdownDirectory remains an error', async () => {
  const workspace = createWorkspace()
  const outsideMarkdown = write(path.join(workspace.root, 'README.md'), '# Outside\n')
  const result = await execute([
    '--root-directory', workspace.root,
    '--puml-directory', 'docs/puml',
    '--markdown-directory', 'docs',
    '--dist-directory', 'docs/puml/dist',
    '--link-mode', 'server',
    '--puml-file', path.join('docs', 'puml', 'missing.puml'),
    '--markdown-file', path.relative(workspace.root, outsideMarkdown),
  ])
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /markdownFiles path escapes its allowed directory/)
})

test('CLI reports contradictory legacy and link-mode options with a non-zero status', async () => {
  const result = await execute(['--turn-off-link-shortening', '--link-mode', 'local'])
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /conflicts with --link-mode/)
})

test('real CLI loads all defaults from an explicit configuration file', async () => {
  const workspace = createWorkspace()
  const configPath = write(path.join(workspace.root, 'project-config.cjs'), `
    module.exports = {
      rootDirectory: '.',
      pumlDirectory: 'docs/puml',
      markdownDirectory: 'docs',
      distDirectory: 'docs/puml/dist',
      outputImages: false,
      imageFormats: ['png', 'svg'],
      linkMode: 'server',
      localImageFormat: 'svg',
      pumlFiles: [],
      markdownFiles: [],
      regenerateAll: false,
      deleteOrphanImages: false,
      markerPattern: /<!--\\s*(?<kind>!?)\\[(?<label>[^\\]]*)\\]\\((?<target>[^)]+\\.puml)\\)\\s*-->/g,
      markerFlags: '',
      respectGitignore: false,
      gitignorePath: '.gitignore',
      changedFilesStdin0: false,
      hotReload: false,
      intervalSeconds: 2
    }
  `)
  const result = await execute(['--config', configPath])
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /PUML generated: 0; Markdown processed: 0/)
})

'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { run } = require('../index')
const { createWorkspace, diagram, fakeFetch, write } = require('./helpers')

const baseOptions = (workspace) => ({
  rootDirectory: workspace.root,
  pumlDirectory: workspace.pumlDirectory,
  markdownDirectory: workspace.markdownDirectory,
  distDirectory: workspace.distDirectory,
  outputImages: true,
  imageFormats: ['svg'],
  linkMode: 'local',
  localImageFormat: 'svg',
  fetchBuffer: fakeFetch,
  respectGitignore: false,
})

test('distinguishes full, incremental, and explicitly empty PUML selections', async () => {
  const workspace = createWorkspace()
  const a = write(path.join(workspace.pumlDirectory, 'a.puml'), diagram('A -> B'))
  const b = write(path.join(workspace.pumlDirectory, 'b.puml'), diagram('B -> C'))
  const full = await run({ ...baseOptions(workspace), markdownFiles: [] })
  assert.deepEqual(new Set(full.selectedPuml), new Set([a, b]))

  fs.rmSync(workspace.distDirectory, { recursive: true })
  const incremental = await run({ ...baseOptions(workspace), pumlFiles: [a], markdownFiles: [] })
  assert.deepEqual(incremental.selectedPuml, [a])
  assert.equal(fs.existsSync(path.join(workspace.distDirectory, 'a.svg')), true)
  assert.equal(fs.existsSync(path.join(workspace.distDirectory, 'b.svg')), false)

  const empty = await run({ ...baseOptions(workspace), pumlFiles: [], markdownFiles: [] })
  assert.deepEqual(empty.selectedPuml, [])
  assert.equal(empty.generatedImages.length, 0)
})

test('canonicalizes paths when the configured root is a symbolic link', async () => {
  const workspace = createWorkspace()
  const source = write(path.join(workspace.pumlDirectory, 'a.puml'), diagram())
  const markdown = write(path.join(workspace.markdownDirectory, 'page.md'), '<!--![A](puml/a.puml)-->\n')
  const aliasParent = fs.mkdtempSync(path.join(path.dirname(workspace.root), 'puml-md-alias-'))
  const aliasRoot = path.join(aliasParent, 'project')
  fs.symlinkSync(workspace.root, aliasRoot, process.platform === 'win32' ? 'junction' : 'dir')
  const aliasWorkspace = {
    root: aliasRoot,
    pumlDirectory: path.join(aliasRoot, 'docs', 'puml'),
    markdownDirectory: path.join(aliasRoot, 'docs'),
    distDirectory: path.join(aliasRoot, 'docs', 'puml', 'dist'),
  }

  const result = await run({
    ...baseOptions(aliasWorkspace),
    pumlFiles: [path.join(aliasWorkspace.pumlDirectory, 'a.puml')],
    markdownFiles: [path.join(aliasWorkspace.markdownDirectory, 'page.md')],
  })

  assert.equal(result.rootDirectory, fs.realpathSync(workspace.root))
  assert.deepEqual(result.selectedPuml, [fs.realpathSync(source)])
  assert.deepEqual(result.selectedMarkdown, [fs.realpathSync(markdown)])
  assert.match(fs.readFileSync(markdown, 'utf8'), /puml\/dist\/a\.svg/)
})

test('regenerateAll overrides an empty PUML selection but not the Markdown selection', async () => {
  const workspace = createWorkspace()
  write(path.join(workspace.pumlDirectory, 'a.puml'), diagram())
  const markdown = write(path.join(workspace.markdownDirectory, 'page.md'), '<!--![A](puml/a.puml)-->\n')
  const result = await run({ ...baseOptions(workspace), pumlFiles: [], markdownFiles: [], regenerateAll: true })
  assert.equal(result.selectedPuml.length, 1)
  assert.deepEqual(result.selectedMarkdown, [])
  assert.equal(fs.readFileSync(markdown, 'utf8'), '<!--![A](puml/a.puml)-->\n')
})

test('preserves images for unselected sources during incremental generation', async () => {
  const workspace = createWorkspace()
  const a = write(path.join(workspace.pumlDirectory, 'a.puml'), diagram())
  write(path.join(workspace.pumlDirectory, 'b.puml'), diagram())
  const bImage = write(path.join(workspace.distDirectory, 'b.svg'), 'old-b')
  await run({ ...baseOptions(workspace), pumlFiles: [a], markdownFiles: [] })
  assert.equal(fs.readFileSync(bImage, 'utf8'), 'old-b')
})

test('deletion cleanup is opt-in and removes only unequivocally managed paths', async () => {
  const workspace = createWorkspace()
  const deleted = path.join(workspace.pumlDirectory, 'old name.puml')
  const oldSvg = write(path.join(workspace.distDirectory, 'old name.svg'), 'old')
  const unrelated = write(path.join(workspace.distDirectory, 'logo.svg'), 'logo')

  await run({ ...baseOptions(workspace), outputImages: false, pumlFiles: [deleted], markdownFiles: [], deleteOrphanImages: false })
  assert.equal(fs.existsSync(oldSvg), true)
  await run({ ...baseOptions(workspace), outputImages: false, pumlFiles: [deleted], markdownFiles: [], deleteOrphanImages: true })
  assert.equal(fs.existsSync(oldSvg), false)
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'logo')
})

test('full regeneration plus cleanup synchronizes registered outputs and preserves unrelated files', async () => {
  const workspace = createWorkspace()
  const source = write(path.join(workspace.pumlDirectory, 'keep.puml'), diagram())
  await run({ ...baseOptions(workspace), pumlFiles: [source], markdownFiles: [] })
  const deletedSource = write(path.join(workspace.pumlDirectory, 'remove.puml'), diagram())
  await run({ ...baseOptions(workspace), pumlFiles: [deletedSource], markdownFiles: [] })
  fs.rmSync(deletedSource)
  const unrelated = write(path.join(workspace.distDirectory, 'logo.svg'), 'logo')
  const result = await run({ ...baseOptions(workspace), regenerateAll: true, markdownFiles: [], deleteOrphanImages: true })
  assert.equal(fs.existsSync(path.join(workspace.distDirectory, 'keep.svg')), true)
  assert.equal(fs.existsSync(path.join(workspace.distDirectory, 'remove.svg')), false)
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'logo')
  assert.equal(result.removedImages.length, 1)
})

test('a rename deletes the old output and generates nested PNG and SVG outputs', async () => {
  const workspace = createWorkspace()
  const oldSource = path.join(workspace.pumlDirectory, 'old.puml')
  write(path.join(workspace.distDirectory, 'old.png'), 'old')
  write(path.join(workspace.distDirectory, 'old.svg'), 'old')
  const renamed = write(path.join(workspace.pumlDirectory, 'sub sistema', 'nuevo ñ.puml'), diagram())
  const result = await run({
    ...baseOptions(workspace),
    imageFormats: ['png', 'svg'],
    pumlFiles: [oldSource, renamed],
    markdownFiles: [],
    deleteOrphanImages: true,
  })
  assert.equal(result.generatedImages.length, 2)
  assert.equal(fs.existsSync(path.join(workspace.distDirectory, 'old.png')), false)
  assert.equal(fs.existsSync(path.join(workspace.distDirectory, 'old.svg')), false)
  assert.equal(fs.existsSync(path.join(workspace.distDirectory, 'sub sistema', 'nuevo ñ.png')), true)
  assert.equal(fs.existsSync(path.join(workspace.distDirectory, 'sub sistema', 'nuevo ñ.svg')), true)
})

test('local links are relative, encoded, idempotent, and require an existing selected format', async () => {
  const workspace = createWorkspace()
  const source = write(path.join(workspace.pumlDirectory, 'sub sistema', 'diagrama ñ.puml'), diagram())
  const markdown = write(
    path.join(workspace.markdownDirectory, 'guías', 'deep', 'page.md'),
    '<!-- ![Arquitectura](../../puml/sub%20sistema/diagrama%20%C3%B1.puml) -->\n',
  )
  await assert.rejects(
    run({ ...baseOptions(workspace), imageFormats: ['png'], localImageFormat: 'svg', pumlFiles: [source], markdownFiles: [markdown] }),
    /Local SVG image does not exist/,
  )
  await run({ ...baseOptions(workspace), pumlFiles: [source], markdownFiles: [markdown] })
  const first = fs.readFileSync(markdown, 'utf8')
  assert.match(first, /^!\[Arquitectura\]\(\.\.\/\.\.\/puml\/dist\/sub%20sistema\/diagrama%20%C3%B1\.svg\)/)
  await run({ ...baseOptions(workspace), pumlFiles: [], markdownFiles: [markdown], outputImages: false })
  assert.equal(fs.readFileSync(markdown, 'utf8'), first)
})

test('server, tinyurl, and local link modes have distinct behavior', async () => {
  for (const mode of ['server', 'tinyurl', 'local']) {
    const workspace = createWorkspace()
    const source = write(path.join(workspace.pumlDirectory, 'a.puml'), diagram())
    const markdown = write(
      path.join(workspace.markdownDirectory, 'page.md'),
      '<!--![A](puml/a.puml)-->\n<!--![A again](puml/a.puml)-->\n',
    )
    let shortenCalls = 0
    await run({
      ...baseOptions(workspace),
      outputImages: mode === 'local',
      pumlFiles: mode === 'local' ? [source] : [],
      markdownFiles: [markdown],
      linkMode: mode,
      shortener: async () => {
        shortenCalls += 1
        return 'https://tiny.test/a'
      },
      pumlServerUrl: 'https://server.test/plantuml',
    })
    const content = fs.readFileSync(markdown, 'utf8')
    if (mode === 'server') assert.match(content, /https:\/\/server\.test\/plantuml\/svg\//)
    if (mode === 'tinyurl') assert.match(content, /https:\/\/tiny\.test\/a/)
    if (mode === 'local') assert.match(content, /puml\/dist\/a\.svg/)
    assert.equal(shortenCalls, mode === 'tinyurl' ? 1 : 0)
  }
})

test('rejects explicitly selected files outside allowed directories', async () => {
  const workspace = createWorkspace()
  const outside = write(path.join(workspace.root, 'outside.puml'), diagram())
  await assert.rejects(run({ ...baseOptions(workspace), pumlFiles: [outside], markdownFiles: [] }), /escapes its allowed directory/)
  const markdownOutside = write(path.join(workspace.root, 'README.md'), '')
  await assert.rejects(run({ ...baseOptions(workspace), pumlFiles: [], markdownFiles: [markdownOutside] }), /escapes its allowed directory/)
})

test('an HTTP failure leaves an existing image intact and a 400 fragment failure is non-fatal', async () => {
  const workspace = createWorkspace()
  const fragment = write(path.join(workspace.pumlDirectory, 'fragment.puml'), 'skinparam shadowing false\n')
  const consumer = write(path.join(workspace.pumlDirectory, 'consumer.puml'), '@startuml\n!include fragment.puml\nA -> B\n@enduml\n')
  const existing = write(path.join(workspace.distDirectory, 'consumer.svg'), 'previous')
  const failure = Object.assign(new Error('boom'), { statusCode: 500 })
  await assert.rejects(
    run({ ...baseOptions(workspace), pumlFiles: [consumer], markdownFiles: [], fetchBuffer: async () => { throw failure } }),
    /boom/,
  )
  assert.equal(fs.readFileSync(existing, 'utf8'), 'previous')

  let calls = 0
  const fragmentResult = await run({
    ...baseOptions(workspace),
    pumlFiles: [fragment],
    markdownFiles: [],
    fetchBuffer: async () => {
      calls += 1
      if (calls === 1) throw Object.assign(new Error('not renderable'), { statusCode: 400 })
      return Buffer.from('image')
    },
  })
  assert.equal(fragmentResult.skippedAuxiliary.includes(fragment), true)
})

test('a later format failure preserves the older image and records an earlier successful output', async () => {
  const workspace = createWorkspace()
  const source = write(path.join(workspace.pumlDirectory, 'a.puml'), diagram())
  const previousSvg = write(path.join(workspace.distDirectory, 'a.svg'), 'previous-svg')
  let calls = 0
  await assert.rejects(run({
    ...baseOptions(workspace),
    imageFormats: ['png', 'svg'],
    pumlFiles: [source],
    markdownFiles: [],
    fetchBuffer: async () => {
      calls += 1
      if (calls === 2) throw Object.assign(new Error('svg failed'), { statusCode: 503 })
      return Buffer.from('new-png')
    },
  }), /svg failed/)
  assert.equal(fs.readFileSync(previousSvg, 'utf8'), 'previous-svg')
  assert.equal(fs.readFileSync(path.join(workspace.distDirectory, 'a.png'), 'utf8'), 'new-png')
  const manifest = JSON.parse(fs.readFileSync(path.join(workspace.distDirectory, '.puml-for-markdown.json'), 'utf8'))
  assert.deepEqual(manifest.images, ['a.png'])
})

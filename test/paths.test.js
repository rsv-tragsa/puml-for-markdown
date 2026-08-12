'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { encodeMarkdownPath, imagePathForSource, isPathInside, localImageLink } = require('../lib/paths')
const { getFullPumlUrl } = require('../lib/plantuml')

test('constructs a PlantUML server URL without the historical trailing brace', () => {
  assert.equal(
    getFullPumlUrl({ imgFormat: 'svg', encodedData: 'encoded', pumlServerUrl: 'https://plantuml.test/base/' }),
    'https://plantuml.test/base/svg/encoded',
  )
})

test('checks containment with POSIX and Windows path semantics', () => {
  assert.equal(isPathInside('/repo/docs', '/repo/docs/a.md', path.posix), true)
  assert.equal(isPathInside('/repo/docs', '/repo/other/a.md', path.posix), false)
  assert.equal(isPathInside('C:\\repo\\docs', 'c:\\repo\\docs\\a.md', path.win32), true)
  assert.equal(isPathInside('C:\\repo\\docs', 'D:\\repo\\docs\\a.md', path.win32), false)
  assert.equal(isPathInside('C:\\repo\\docs', 'C:\\repo\\other\\a.md', path.win32), false)
})

test('maps nested PUML files below dist and creates encoded Markdown paths', () => {
  const image = imagePathForSource({
    pumlDirectory: path.resolve('/repo/docs/puml'),
    distDirectory: path.resolve('/repo/docs/puml/dist'),
    sourcePath: path.resolve('/repo/docs/puml/sub sistema/área ñ/api.puml'),
    format: 'svg',
  })
  assert.equal(image, path.resolve('/repo/docs/puml/dist/sub sistema/área ñ/api.svg'))
  assert.equal(encodeMarkdownPath('../puml/dist/sub sistema/área ñ/api.svg'), '../puml/dist/sub%20sistema/%C3%A1rea%20%C3%B1/api.svg')
  assert.equal(encodeMarkdownPath('../puml/a (draft)!.svg'), '../puml/a%20%28draft%29%21.svg')
  assert.equal(
    localImageLink({ markdownPath: path.resolve('/repo/docs/deep/page.md'), imagePath: image }),
    '../puml/dist/sub%20sistema/%C3%A1rea%20%C3%B1/api.svg',
  )
})

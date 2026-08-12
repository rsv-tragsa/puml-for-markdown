'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { createMarkerRegex, rewritePumlMarkers } = require('../lib/markdown')

const local = async (source, options = {}) => rewritePumlMarkers(source, {
  ...options,
  resolveLink: async () => ({ url: '../puml/dist/test.svg', wrapImage: false }),
})

test('default marker accepts image/link forms with and without spaces', async () => {
  const source = [
    '<!--![One](../puml/test.puml)-->',
    '<!-- ![Two](../puml/test.puml) -->',
    '<!--[Three](../puml/test.puml)-->',
    '<!-- [Four](../puml/test.puml) -->',
  ].join('\n')
  const result = await local(source)
  assert.equal(result.processedLinks, 4)
  assert.match(result.content, /!\[One\]\(\.\.\/puml\/dist\/test\.svg\)<!--!\[One\]/)
  assert.match(result.content, /\[Four\]\(\.\.\/puml\/dist\/test\.svg\)<!-- \[Four\]/)
})

test('custom marker pattern uses named captures and configured flags', async () => {
  const source = '{{diagram:![Custom](../puml/test.puml)}}'
  const result = await local(source, {
    markerPattern: String.raw`\{\{diagram:(?<kind>!?)\[(?<label>[^\]]*)\]\((?<target>[^)]+\.puml)\)\}\}`,
    markerFlags: 'i',
  })
  assert.equal(result.content, '![Custom](../puml/dist/test.svg){{diagram:![Custom](../puml/test.puml)}}')
})

test('rejects missing named capture groups and invalid flags', () => {
  assert.throws(() => createMarkerRegex('(?<kind>!)(?<label>x)'), /target/)
  assert.throws(() => createMarkerRegex('(?<kind>!)(?<label>x)(?<target>y)', 'z'), /Invalid markerPattern/)
})

test('does not rewrite markers in inline or fenced code', async () => {
  const marker = '<!--![Code](../puml/test.puml)-->'
  const source = `before \`${marker}\` after\n\n\`\`\`md\n${marker}\n\`\`\`\n\n${marker}\n`
  const result = await local(source)
  assert.equal(result.processedLinks, 1)
  assert.equal((result.content.match(/!\[Code\]\(\.\.\/puml\/dist\/test\.svg\)/g) || []).length, 1)
})

test('replaces the immediately preceding managed link and is idempotent', async () => {
  const source = '[![Diagram](https://old.test/x)](https://old.test/x)<!--![Diagram](../puml/test.puml)-->'
  const first = await local(source)
  const second = await local(first.content)
  assert.equal(first.content, '![Diagram](../puml/dist/test.svg)<!--![Diagram](../puml/test.puml)-->')
  assert.equal(second.content, first.content)
  assert.equal(second.processedLinks, 1)
})

'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { affectedConsumers, buildIncludeGraph, expandIncludes, parseLocalIncludes } = require('../lib/includes')
const { createWorkspace, diagram, write } = require('./helpers')

test('finds direct and transitive consumers while ignoring remote and retaining missing includes', () => {
  const workspace = createWorkspace()
  const common = write(path.join(workspace.pumlDirectory, 'common.puml'), 'skinparam shadowing false\n')
  const architecture = write(path.join(workspace.pumlDirectory, 'architecture.puml'), '@startuml\n!include common.puml\n@enduml\n')
  const system = write(path.join(workspace.pumlDirectory, 'system.puml'), '@startuml\n!include "architecture.puml"\n!include https://example.test/remote.puml\n!include missing.puml\n@enduml\n')
  const graph = buildIncludeGraph([common, architecture, system])
  assert.deepEqual(new Set(affectedConsumers([common], graph.reverse)), new Set([common, architecture, system]))
  assert.match(expandIncludes(system), /skinparam shadowing false/)
  assert.match(expandIncludes(system), /!include missing\.puml/)
  assert.equal(parseLocalIncludes(system, fs.readFileSync(system, 'utf8')).length, 2)
})

test('reports a readable include cycle', () => {
  const workspace = createWorkspace()
  const a = write(path.join(workspace.pumlDirectory, 'a.puml'), `${diagram()}!include b.puml\n`)
  const b = write(path.join(workspace.pumlDirectory, 'b.puml'), `${diagram()}!include a.puml\n`)
  assert.throws(() => buildIncludeGraph([a, b]), /Cyclic !include dependency detected: a\.puml -> b\.puml -> a\.puml/)
})

test('honors include_once and rejects local includes outside pumlDirectory', () => {
  const workspace = createWorkspace()
  const common = write(path.join(workspace.pumlDirectory, 'common.puml'), 'skinparam dpi 120\n')
  const source = write(
    path.join(workspace.pumlDirectory, 'source.puml'),
    '@startuml\n!include_once common.puml\n!include_once common.puml\n@enduml\n',
  )
  const expanded = expandIncludes(source, { pumlDirectory: workspace.pumlDirectory })
  assert.equal((expanded.match(/skinparam dpi 120/g) || []).length, 1)

  const outside = write(path.join(workspace.root, 'outside.puml'), diagram())
  const unsafe = write(path.join(workspace.pumlDirectory, 'unsafe.puml'), '@startuml\n!include ../../outside.puml\n@enduml\n')
  assert.equal(fs.existsSync(outside), true)
  assert.throws(
    () => buildIncludeGraph([common, unsafe], { pumlDirectory: workspace.pumlDirectory }),
    /escapes pumlDirectory/,
  )
})

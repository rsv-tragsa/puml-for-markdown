'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const createWorkspace = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puml-md-test-'))
  const pumlDirectory = path.join(root, 'docs', 'puml')
  const markdownDirectory = path.join(root, 'docs')
  const distDirectory = path.join(pumlDirectory, 'dist')
  fs.mkdirSync(pumlDirectory, { recursive: true })
  return { root, pumlDirectory, markdownDirectory, distDirectory }
}

const write = (filePath, contents) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents)
  return filePath
}

const diagram = (name = 'Alice -> Bob') => `@startuml\n${name}\n@enduml\n`
const fakeFetch = async (url) => Buffer.from(`image:${url}`)

module.exports = { createWorkspace, diagram, fakeFetch, write }

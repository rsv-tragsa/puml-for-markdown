'use strict'

const { run } = require('./lib/run')

// The default export remains callable for consumers of the original package.
module.exports = run
module.exports.run = run
module.exports.includes = require('./lib/includes')
module.exports.markdown = require('./lib/markdown')
module.exports.paths = require('./lib/paths')
module.exports.plantuml = require('./lib/plantuml')
module.exports.selection = require('./lib/selection')
module.exports.config = require('./lib/config')
module.exports.defaults = require('./lib/defaults')
module.exports.loadProjectConfig = module.exports.config.loadProjectConfig

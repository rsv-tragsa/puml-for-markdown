# CommonJS API

The default export remains callable for compatibility. `run` is the same function:

```js
const pumlForMarkdown = require('@rsv-tragsa/puml-for-markdown')

await pumlForMarkdown(options)
await pumlForMarkdown.run(options)
```

## Load project configuration

`run(options)` does not search for a configuration file. Load it explicitly when CLI-equivalent behavior is wanted:

```js
const {
  loadProjectConfig,
  run,
} = require('@rsv-tragsa/puml-for-markdown')

const options = loadProjectConfig({
  searchDirectory: process.cwd(),
  // explicitPath: './config/puml.cjs',
})

const result = await run(options)
```

## Incremental API call

```js
const result = await run({
  rootDirectory: process.cwd(),
  pumlDirectory: 'docs/puml',
  markdownDirectory: 'docs',
  distDirectory: 'docs/puml/dist',
  pumlFiles: ['docs/puml/architecture.puml'],
  markdownFiles: ['docs/architecture.md'],
  outputImages: true,
  imageFormats: ['svg'],
  linkMode: 'local',
  localImageFormat: 'svg',
  deleteOrphanImages: true,
})
```

Paths in explicit selections resolve from `rootDirectory`, must have the expected extension, and must remain inside the corresponding configured directory.

## Result

`run()` resolves to an object containing absolute configured directories plus:

- `selectedPuml`: selected existing PUML source paths.
- `selectedMarkdown`: selected existing Markdown paths.
- `generatedImages`: successfully generated image paths.
- `removedImages`: deleted orphan image paths.
- `skippedAuxiliary`: included sources skipped after an independent HTTP 400 response.
- `markdownResults`: `{ content, processedLinks, changed }` for each selected Markdown file.

## Offline tests

Inject network operations:

```js
await run({
  ...options,
  fetchBuffer: async (url) => Buffer.from('<svg/>'),
  shortener: async (url) => `https://short.test/${encodeURIComponent(url)}`,
})
```

`fetchBuffer(url)` must return a value accepted as image bytes. `shortener(url)` must return the shortened URL. TinyURL is loaded lazily only when `linkMode` is `tinyurl` and no shortener is injected.

## Public helpers

The package also exposes `includes`, `markdown`, `paths`, `plantuml`, `selection`, `config`, and `defaults`. Prefer `run()` and `loadProjectConfig()` for application integrations; use helpers for specialized tooling and tests.

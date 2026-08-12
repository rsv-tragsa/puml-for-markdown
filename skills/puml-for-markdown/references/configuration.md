# Configuration reference

The CLI searches for `puml-for-markdown.config.cjs` in `rootDirectory`. `--config <path>` selects another trusted CommonJS file. Precedence is CLI options, then the configuration file, then built-in defaults.

Relative `rootDirectory` values resolve from the configuration file directory. Other relative paths resolve from `rootDirectory`.

## Options

| Property | Type | Built-in default | Meaning |
| --- | --- | --- | --- |
| `rootDirectory` | `string` | `.` | Trusted project root. |
| `pumlDirectory` | `string` | `./docs/puml` | Directory containing `.puml` sources. |
| `markdownDirectory` | `string` | `./docs` | Directory containing managed Markdown. |
| `distDirectory` | `string` | `./docs/puml/dist` | Generated image directory. |
| `outputImages` | `boolean` | `false` | Download generated images. |
| `imageFormats` | `"png"`, `"svg"`, `"both"`, or array | `["svg"]` | Image formats to generate. |
| `pumlServerUrl` | `string` | public PlantUML server | Server base URL. |
| `linkMode` | `"local"`, `"server"`, or `"tinyurl"` | `local` | Visible Markdown link destination. |
| `localImageFormat` | `"png"` or `"svg"` | `svg` | Image referenced by local Markdown links. |
| `regenerateAll` | `boolean` | `false` | Select every PUML source. |
| `deleteOrphanImages` | `boolean` | `false` | Delete safe managed orphan outputs. |
| `markerPattern` | `string` or `RegExp` | built-in comment pattern | Full marker expression with named groups. |
| `markerFlags` | `string` | empty | Flags used when the pattern is a string. |
| `respectGitignore` | `boolean` | `true` | Exclude ignored files during scans. |
| `gitignorePath` | `string` | `.gitignore` | Ignore file path. |
| `pumlFiles` | `string[]` or omitted | omitted | Explicit PUML selection. |
| `markdownFiles` | `string[]` or omitted | omitted | Explicit Markdown selection. |
| `changedFilesStdin0` | `boolean` | `false` | CLI reads NUL-delimited paths from stdin. |
| `hotReload` | `boolean` | `false` | CLI repeats the selected operation. |
| `intervalSeconds` | positive `number` | `2` | Hot-reload interval. |

Unknown configuration keys fail fast.

## Recommended local-image configuration

```js
module.exports = {
  rootDirectory: '.',
  pumlDirectory: 'docs/puml',
  markdownDirectory: 'docs',
  distDirectory: 'docs/puml/dist',
  outputImages: true,
  imageFormats: ['svg'],
  linkMode: 'local',
  localImageFormat: 'svg',
  deleteOrphanImages: true,
}
```

## Custom marker requirements

The expression must match the complete marker and define named groups `kind`, `label`, and `target`. Global matching is always enabled and sticky matching is disabled.

## File selection

Never conflate omission with an empty array:

| Value | Effect |
| --- | --- |
| Omitted | Scan every applicable file. |
| `[]` | Select none. |
| Paths | Select only those allowed paths. |

`regenerateAll` overrides PUML selection but does not override an explicit Markdown selection.

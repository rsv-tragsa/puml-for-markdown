---
name: puml-for-markdown
description: Configure and use @rsv-tragsa/puml-for-markdown to render PlantUML PNG or SVG files and maintain managed links in Markdown. Use when a project contains .puml files, puml-for-markdown.config.cjs, hidden Markdown markers that reference .puml sources, or requests for full, incremental, local, server, or TinyURL diagram generation.
---

# Use PUML for Markdown

Use the project-local `puml-for-markdown` binary or its CommonJS API. Require Node.js 22 or later and prefer the package manager declared by the consumer project.

## Inspect the project

1. Locate the project root and its package manager.
2. Look for `puml-for-markdown.config.cjs`.
3. Infer `pumlDirectory`, `markdownDirectory`, and `distDirectory` from existing files when safe.
4. Copy `assets/puml-for-markdown.config.cjs` when configuration is missing, then adapt only the directory and output choices.
5. Read [configuration.md](references/configuration.md) before changing advanced options or file selection.

Do not install or modify dependencies when the requested operation can use an existing project-local installation.

## Choose an output mode

- Choose `local` to generate repository-hosted PNG or SVG files. Enable `outputImages` and ensure `localImageFormat` is included in `imageFormats`, unless that image already exists.
- Choose `server` to write direct PlantUML server links without storing images.
- Choose `tinyurl` only when short remote links are explicitly wanted. It adds a TinyURL network dependency.

Prefer `local` for durable documentation unless the project already establishes another mode.

## Add a managed marker

Keep the hidden marker as the source of truth:

```markdown
<!--![Architecture](../puml/architecture.puml)-->
```

Omit `!` for a text link:

```markdown
<!--[Open architecture](../puml/architecture.puml)-->
```

Do not manually create or edit the visible link immediately before a marker. The tool replaces that managed link and preserves the marker. It ignores markers inside inline code and fenced code blocks.

## Run the CLI

Use the consumer's package manager. With pnpm:

```bash
pnpm exec puml-for-markdown
```

Run a complete regeneration only when requested or when no safe incremental selection exists:

```bash
pnpm exec puml-for-markdown --regenerate-all
```

For known changed files, pass explicit selections:

```bash
pnpm exec puml-for-markdown \
  --puml-file docs/puml/architecture.puml \
  --markdown-file docs/architecture.md
```

Read [cli.md](references/cli.md) for repeated selections, NUL-delimited changed files, includes, renames, and orphan cleanup.

## Use the API

Load project configuration explicitly; `run()` does not discover configuration by itself:

```js
const { loadProjectConfig, run } = require('@rsv-tragsa/puml-for-markdown')

const config = loadProjectConfig({ searchDirectory: process.cwd() })
const result = await run(config)
```

Read [api.md](references/api.md) before generating programmatic integrations or offline tests.

## Preserve selection semantics

Treat these values as distinct:

- Omitted `pumlFiles` or `markdownFiles`: scan all matching files.
- Empty array `[]`: select no files.
- Non-empty array: select only those files; changed PUML files also select their transitive local `!include` consumers.

Do not replace an intentional empty array with `undefined` or omit it during refactoring.

When consuming a repository-wide changed-file stream, use `--changed-files-stdin0`. It ignores `.md` and `.puml` paths outside their configured directories. Keep direct CLI and API selections strict; an explicitly selected out-of-scope path is an error.

## Apply safety rules

- Keep all configured directories inside `rootDirectory`.
- Never make `distDirectory` the project root or `pumlDirectory`.
- Do not delete `distDirectory` manually to clean stale outputs.
- Use `--delete-orphan-images`; it removes only managed or unambiguous orphan outputs and preserves unrelated files.
- Preserve the hidden Markdown marker.
- Expect `outputImages` to require access to the PlantUML server and `tinyurl` to require access to a shortener. Constructing `server` links does not itself make a network request.
- Report generated images, changed Markdown files, skipped auxiliary PUML fragments, and any failures.

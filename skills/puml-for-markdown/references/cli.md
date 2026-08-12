# CLI workflows

Run the installed project binary through the consumer's package manager. Substitute `npm exec`, `yarn exec`, or the project's equivalent when pnpm is not in use.

## Complete local generation

```bash
pnpm exec puml-for-markdown \
  --root-directory . \
  --puml-directory docs/puml \
  --markdown-directory docs \
  --dist-directory docs/puml/dist \
  --output-images \
  --image-formats both \
  --link-mode local \
  --local-image-format svg \
  --regenerate-all \
  --delete-orphan-images
```

## Incremental generation

Repeat `--puml-file` and `--markdown-file` for every known changed path:

```bash
pnpm exec puml-for-markdown \
  --puml-file docs/puml/shared.puml \
  --puml-file docs/puml/system.puml \
  --markdown-file docs/system.md \
  --delete-orphan-images
```

A selected PUML source also selects existing transitive consumers of local `!include`, `!include_once`, and `!include_many` declarations. Markdown selection remains exact.

## Changed paths from Git or another producer

`--changed-files-stdin0` reads raw NUL-delimited paths, classifies `.puml` and `.md`, preserves deleted paths for cleanup, and creates explicit selections for both types. It ignores `.puml` paths outside `pumlDirectory` and `.md` paths outside `markdownDirectory`, so a hook can pass the repository's complete changed-file list:

```bash
git diff --cached --name-only -z --diff-filter=ACMRD | \
  pnpm exec puml-for-markdown --changed-files-stdin0 --delete-orphan-images
```

Do not replace NUL delimiters with newline parsing; paths may contain spaces or newlines. The tool reads working-tree contents, not Git index blobs.

Paths supplied directly through `--puml-file`, `--markdown-file`, or the programmatic API remain strict and fail when they escape their configured directory.

## Renames and deletions

Pass both the old deleted path and new path. Enable `--delete-orphan-images` to remove the old managed PNG/SVG and generate the new output. Do not delete the entire output directory.

## Local includes

Local includes must remain inside `pumlDirectory`. Remote HTTP(S), FTP, `stdlib:`, and `<...>` includes remain remote. Cycles are rejected. A missing local include remains in the expanded PlantUML so the server can report it.

## Output interpretation

The CLI prints counts for generated PUML images, processed Markdown files, and deleted orphan images. A non-zero exit status indicates invalid configuration, unsafe paths, missing sources or local images, dependency cycles, or a remote-service failure.

Image writes are atomic. A failed download leaves the previous image intact. An included auxiliary source that independently returns HTTP 400 is skipped; other HTTP failures are fatal.

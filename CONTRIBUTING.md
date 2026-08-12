# Contributing

Use Node.js 22 and pnpm 11:

```bash
pnpm install --frozen-lockfile
pnpm test
npm pack --dry-run
```

Keep filesystem paths separate from Markdown/URL paths, add regression coverage for Windows and POSIX semantics, and avoid network access in unit tests by injecting `fetchBuffer` or `shortener`.

Do not publish packages from a development branch. Publishing is reserved for the controlled GitHub release workflow.

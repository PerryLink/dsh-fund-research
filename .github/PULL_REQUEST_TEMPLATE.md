## Checklist

- [ ] The full gate is green: `pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && node scripts/check-readme-sync.mjs && pnpm pack`
- [ ] Tests added or updated for the change (vitest, real `Context`/`Session`/`ToolRuntime`)
- [ ] `CHANGELOG.md` updated under `[Unreleased]` (Keep a Changelog format)
- [ ] Multi-language docs synced when user-facing docs change (README.md + README.zh/es/pt/hi.md)
- [ ] Linked issue: fixes #
- [ ] No secrets in this PR: no tokens, API keys, credentials, or Authorization headers (use placeholders in examples)
- [ ] Conventional commits only (`feat:`/`fix:`/`docs:`/`test:`/`chore:`/`ci:`), each commit individually revertible

# AGENTS.md

Standalone DeepSeek Harness plugin repository (`dsh-fund-research`). Development follows the dsh-plugin-guide skill and the official plugin contract; this file records repo-local decisions.

## Layout

- `src/index.ts` — function-plugin contract (`name`/`inject`/`Config`/`apply`; NO default export). Hard-injects `tools` and `storageDomain` (the bundle patch composes the storage stack); `jobs`/`skills`/`systemPrompt`/`dataQuality` are optional `ctx.get` lookups so leaner compositions still activate. Async `apply`: resolves config, opens the `dsh_fund_research` domain, builds the shared polite fetcher, registers the two tools as effects, then the prompt section and the bundled skill provider when those services are present.
- `src/config.ts` — Schemastery schema + explicit `resolveConfig` (no hidden `?? default` in run paths). Bounds fail loud at mount.
- `src/model.ts` — the owned JSON model: `FundSnapshot` (raw + computed + provenance), `ReportManifest`, `TraceRow`. Exactly what gets sealed to disk and validated by the domain zod schema.
- `src/sources/eastmoney.ts` — polite collection (`PoliteFetcher`: shared pacing clock, timeout, exponential-backoff retries) and strict parsers (`pingzhongdata` JS block, F10 `jjcc` holdings, F10 `jjjl` manager page, push2 quotes with the configurable `push2delay` fallback host). Remote code is never evaluated; structural drift throws `SourceParseError` naming the source and field.
- `src/sources/snapshot.ts` — acquisition policy: offline reads (domain first, then newest on-disk version snapshot), TTL reuse, compute-on-collect, domain persistence.
- `src/metrics/*.ts` — the deterministic pure functions (performance decomposition, holdings penetration, style attribution, manager profile). No model arithmetic anywhere.
- `src/report.ts` — section assembly (gap-aware), the traceability appendix, and the versioned seal (`snapshot.json` before verification, then `report.md` + `manifest.json`).
- `src/verify-bridge.ts` — the frozen `dsh-data-quality` contract consumed via `ctx.get('dataQuality')` (local structural interface, never imported, never injected) plus the isomorphic `builtin-fallback` checker.
- `src/tools/*.ts` — `fund_snapshot`, `fund_research` (+ the `fund-report` background-job producer), and the shared pipeline (`shared.ts`).
- `skills/fund-research/SKILL.md` — the methodology skill (口径定义、缺口处理、合规话术); computation stays in code.
- `scripts/` — `prepare.mjs` (build), `fix-dts.mjs`, `verify-self-contained.mjs`, `verify-artifacts.mjs`, `check-readme-sync.mjs` (five-language gate), `release.mjs` (bump + stamp + gate + commit + tag, never pushes), `changelog-section.mjs`.
- `test/` — vitest; REAL `Context`/`SessionStore`/`Session`/`ToolRuntime`/`LocalJobRegistry` and the REAL storage seam over an in-memory backend from the 0.1.2-rc.1 peers. The network is replaced only at the fetch boundary by saved real-response fixtures (`fixtures/`). `test/e2e.live.spec.ts` is an opt-in REAL-network E2E (`LIVE_E2E=1 pnpm run test:e2e`) that seals a report for 161725 and spot-checks five numbers against the snapshot and a second independent fetch.
- `fixtures/` — real collected payloads for fund 161725 (pingzhongdata block, F10 holdings/manager pages, per-stock quotes). `.tmp/` collector scripts refresh them.

## Hard rules applied here

- **Every report number traces to the sealed snapshot.** The appendix table maps report value ↔ snapshot JSON path ↔ verification verdict (`dsh-data-quality` when present, else `builtin-fallback`). Computed values live under `computed.*` in the sealed snapshot so the check is exact; anyone can recompute them from `raw.*` with the documented口径.
- **Gaps are declared, never filled.** A failed/degradable source adds a gap label; the section renders an explicit 数据缺口 declaration. No invented numbers.
- **Research only.** Every tool description and report carries 仅供研究、不构成投资建议; no trading, no predictions, no target prices.
- **No tunables hardcoded.** Base URLs, pacing, timeout, retries, TTL, risk-free rate, offline, report root are all validated `Config` fields (cordis.patch.yml comments + the five-language README table).
- **Session events are log-only audit.** `fund-research/snapshot` / `fund-research/report` ride the adaptive gate in `src/events.ts`: hosts that know the vocabulary append plainly, hosts with the `ignorable` envelope append with the marker, and envelope-less hosts (`0.1.0-rc.6`–`0.1.0-rc.8`, `0.1.1-rc.2`, and `0.1.2-rc.1`, which fails closed on unknown types at read) get no append — the tool results and sealed artifacts remain the reconstructable audit trail. A failed append never changes a tool outcome.
- **This plugin registers no waterfall listeners.** If one is ever added, allow/passthrough MUST call `next()`.
- **Cordis identity.** `@deepseek-ai/cordis` stays a peerDependency (+dev); scoped/unscoped mixing splits the identity.

## Checks

`pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && node scripts/check-readme-sync.mjs && pnpm pack`

- `typecheck` resolves `@deepseek-ai/*` through the installed 0.1.2-rc.1 peers; `typecheck:ci` clears `skipLibCheck` and enables `verbatimModuleSyntax` against the published types. Both must stay green.
- oxlint discovers files only after `git init` (the parent checkout's `.oxlintrc.json` otherwise matches nothing here).

## Release

`node scripts/release.mjs <x.y.z>` bumps package.json + `src/version.ts`, stamps the CHANGELOG `[Unreleased]` section, re-runs the full gate, and commits + tags (never pushes). `git push origin main --follow-tags` triggers `.github/workflows/release.yml`, which re-runs the gate, publishes to npm with provenance, and creates the GitHub Release from the stamped CHANGELOG section.

## Docs

- Five-language READMEs (`README.md`, `README.zh.md`, `README.es.md`, `README.pt.md`, `README.hi.md`) — keep all five in sync; the English file is the source of truth. `scripts/check-readme-sync.mjs` (CI) enforces section structure and configuration-table keys.
- GitHub topics `dsh`, `dsh-plugin`, `deepseek-harness`, `cordis`, `fund-research`, `mutual-fund`, `investment-research`, `finance`, `research-report` (mirror `package.json` keywords).
- License is Apache-2.0 (`LICENSE` + the package.json `license` field). `THIRD_PARTY_NOTICES.md` documents the build-time dependencies.

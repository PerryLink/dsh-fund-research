# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-08-23

### Added

- Real Loader composition suite (C3): `test/composition.spec.ts` + `scripts/loader-runner.mjs` mount the plugin through the real `@deepseek-ai/cordis-plugin-loader` Loader over a cordis.yml (real harness services + the real storage seam + the built `lib/index.js` entry), assert both tools through the authoritative registry, and prove an out-of-bounds `requestIntervalMs` fails loud at load.
- Tool-contract assertions (U2): compiled JSON-schema projection, canonical value, and rendered content blocks asserted together for both `fund_snapshot` and `fund_research`.
- Adversarial HTTP fixtures (U5/U6): `PoliteFetcher` fail-closed coverage for 401/404/429 statuses and a timeout-signal hang, plus `collectFund` loud aborts for a malformed 200 core body and a 404 core response.
- Config negatives (U4): out-of-bounds and non-integer `requestIntervalMs`/`timeoutMs`/`retries` values fail loud.
- Endpoint liveness (M3): `scripts/check-endpoints.mjs` probes the four public Tiantian Fund / Eastmoney endpoints (401/403/405/5xx = alive; 404/410/DNS/TLS/timeout = fail) and `.github/workflows/check-endpoints.yml` runs it monthly and on demand.

## [0.1.3] - 2026-08-22

### Changed

- Upgrade the `@deepseek-ai/dsh-*` peer family from `0.1.0-rc.8` to `0.1.1-rc.2`: devDependencies pin `0.1.1-rc.2`, `dshWorkshop.compatibility.dshVersions` advertises `0.1.1-rc.2`, and the compat workflow, five-language READMEs, AGENTS.md, and THIRD_PARTY_NOTICES reference the rc.2 peers. All gates (typecheck, typecheck:ci, test, coverage, lint, build, verify:self-contained, verify:artifacts, readme-sync, pack) stay green against the published rc.2 peers, and the plugin mounts and answers a headless task in a scratch profile over rc.2 (`dsh-base` + `dsh-headless` + this plugin).

## [0.1.2] - 2026-08-21

### Changed

- Upgrade the `@deepseek-ai/dsh-*` peer family from `0.1.0-rc.6` to `0.1.0-rc.8`: devDependencies pin `0.1.0-rc.8`, peerDependencies widen to `>=0.1.0-rc.8 <0.2.0` (storage stack, session, tools, skill, agent, jobs, llm, system-prompt). All gates (typecheck, typecheck:ci, test, coverage, lint, build, verify:self-contained, verify:artifacts, readme-sync, pack) stay green against the published rc.8 peers, and the plugin mounts and answers a headless task in a scratch profile over rc.8 (`dsh-base` + `dsh-headless` + this plugin).

## [0.1.1] - 2026-08-19

### Added

- Quote resilience: per-stock valuation fetches fall back to Eastmoney's own delayed-quote host (`quoteFallbackBaseUrl`, default `push2delay.eastmoney.com`) when the primary push2 host fails; per-stock gaps stay loud and declared.
- Opt-in live end-to-end suite (`pnpm run test:e2e`, gated by `LIVE_E2E=1`): seals a real network report for 161725 and spot-checks five key numbers against the sealed snapshot and a second independent fetch of the same endpoints.
- Community engineering: issue forms (`bug_report.yml`, `feature_request.yml`), a PR checklist template, and npm/CI badges across the five-language READMEs.

## [0.1.0] - 2026-08-19

### Added

- First release: deterministic research reports for Chinese public mutual funds. Public data collection from Tiantian Fund / Eastmoney endpoints (pingzhongdata JS block, F10 holdings and manager pages, per-stock valuation quotes) with polite pacing, per-source SHA-256 provenance, and loud failure on structural drift.
- `fund_snapshot` tool: a light snapshot card (latest NAV, published stage returns, scale, manager, top-3 holdings) sealed with its source snapshot into the fund's day directory.
- `fund_research` tool: the full pipeline (acquire → compute → assemble → verify → seal) producing a versioned Markdown report (`fund-reports/{code}/{YYYYMMDD-HHmmss}/report.md` + `manifest.json` + `snapshot.json`) whose appendix maps every key number to a snapshot JSON path and a verification verdict. `background: true` runs the pipeline as a `fund-report` background job over `ctx.jobs`.
- Deterministic metrics as pure functions: performance decomposition (period/annualized return, volatility, max drawdown, Sharpe), holdings penetration (top-N concentration, HHI, industry distribution, quarter-over-quarter comparison), simplified size-value style attribution, and manager profile.
- Citation verification against the sealed snapshot through the optional `dsh-data-quality` service (`ctx.get('dataQuality')`, never injected) with an isomorphic built-in fallback (`builtin-fallback`).
- Offline mode (`offline: true` or the `offline` tool argument): the snapshot layer is read from the storage domain or the newest on-disk version snapshot; zero outbound requests.
- `fund-research/snapshot` and `fund-research/report` session audit events; a short compliance prompt section; and the bundled `fund-research` methodology skill (registered when the skills service is present).
- Fail-loud Schemastery config, five-language READMEs, and real `Context`/`Session`/`ToolRuntime`/`JobRegistry` vitest coverage against the 0.1.0-rc.6 peers.

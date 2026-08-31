# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Align devDeps pins to the published dsh 0.1.2-alpha.2 line (0.1.1-rc.2 -> 0.1.2-alpha.2); no behavior change to envelope/gating semantics.

## [0.4.0] - 2026-08-30

### Changed

- The `fund-research/snapshot` / `fund-research/report` audit appends now ride an adaptive gate: hosts that know the vocabulary append plainly, hosts with the `ignorable` envelope append with the marker, and envelope-less hosts (`0.1.0-rc.6`鈥揱0.1.0-rc.8`, `0.1.1-rc.2`, and `0.1.2-alpha.1`, which removed the envelope and fails closed on unknown types at read) get no append 鈥?their tool results and sealed artifacts remain the reconstructable audit trail. This prevents polluting session logs with unknown event types on 0.1.2-alpha.1 and later.

### Fixed

- Tests no longer import the `CallId` brand from `@deepseek-ai/dsh-llm` (renamed to `ToolCallId` on host master): the call-id brand is now derived from the `dsh-tools` execution contract, staying green on both the published rc line and the 0.1.2-alpha.1 checkout.

## [0.3.0] - 2026-08-26

### Added

- Benchmark and peer-rank comparison section: the research report benchmarks the fund and ranks it against peer funds.

### Fixed

- Retry teardown `rm` to close the async review-job append race (ENOTEMPTY on Linux).

## [0.2.0] - 2026-08-23

### Added

- asOf-date cutoff: `fund_research` and `fund_snapshot` accept an optional `asOfDate` (ISO `YYYY-MM-DD`); data strictly after the cutoff is excluded (the NAV series is truncated before computation), the snapshot and report carry the asOf semantics, invalid or future dates fail loudly, and cached-snapshot TTL reuse stays consistent with the cutoff.
- Checkpoint resume: the `fund-report` pipeline records stage progress (snapshot/report, timestamps, input fingerprint) in `<reportRoot>/.run-state.json`; `resume: true` continues from the first incomplete stage, reusing the sealed artifacts of completed stages, and rejects a fingerprint mismatch loudly.
- Data-source discovery record: every acquisition seals a code-generated `sources-discovery.json` (endpoint roster, primary/fallback resolution, per-source coverage and gaps, degradation reasons) and folds it into the report appendix as the 鏁版嵁婧愪笌缂哄彛澹版槑 section.
- Multi-fund fan-out: `fund_research` accepts a `codes` array (single `code` stays compatible); each fund runs the pipeline independently with per-fund failure isolation and a summary card (code/asOf/seal hash/verdicts/failure reason), sharing one polite fetcher and the storage-domain cache per call.
- Long-term tracking ledger: every successful seal appends a deterministic line to `<reportRoot>/.tracking.jsonl` (code/asOf/snapshot+quotes+report hashes/record time + comparison facts); `includeComparison: true` renders a deterministic 涓庝笂娆″姣?section (NAV range/scale/top holdings) with a gap declaration when no prior record exists.
- Read-only review stage: after sealing, the pipeline schedules a `fund-review` job (via `ctx.jobs`) that reviews the sealed artifacts (gap-declaration completeness, traceability-table consistency, disclaimer) and writes `review-note.md`; with no jobs service it skips gracefully and records `review: skipped(jobs unavailable)` in run-state.
- Methodology-skill trigger expansion: the `fund-research` skill description/whenToUse and a new capability section cover asOf/resume/multi-fund/tracking-comparison/review.
- Per-source metadata quality signals: `SourcesDiscovery` now carries deterministic per-source quality (`requested`/`succeeded`/`fieldsPresent`/`parseWarnings`/`degraded`) derived from collection facts (quote coverage, parse soft-degradation), rendered in the 鏁版嵁婧愪笌缂哄彛澹版槑 appendix and surfaced in both tool values so downstream can downweight (never hard-filter) low-quality sources.
- Minimal walk-forward stability summary: `fund_research` gains `includeWalkForward` (default false) 鈥?a deterministic rolling-window summary (window count, return/Sharpe sign persistence, mean/std) over the NAV series, rendered as 鏍锋湰澶栫ǔ瀹氭€ф憳瑕?with an explicit statistical-description-only disclaimer; an insufficient series is declared a gap.

### Deviations

Documented items intentionally not implemented across these batches:

- (a) **Local SQLite accumulation cache** 鈥?the existing storage-domain TTL cache plus the on-disk snapshot fallback already cover reuse without a new dependency.
- (b) **AKShare second data source** 鈥?requires a Python sidecar / external process, which breaks this repository's zero-dependency plugin contract.
- (c) **Bull/bear debate multi-agent review** 鈥?model orchestration contradicts this repository's "computation stays in code" principle; the deterministic `review-note.md` stage is the substitute.
- (d) **Desktop notifications** 鈥?DeepSeek Harness exposes no cross-platform notification seam to depend on directly.

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
- `fund_research` tool: the full pipeline (acquire 鈫?compute 鈫?assemble 鈫?verify 鈫?seal) producing a versioned Markdown report (`fund-reports/{code}/{YYYYMMDD-HHmmss}/report.md` + `manifest.json` + `snapshot.json`) whose appendix maps every key number to a snapshot JSON path and a verification verdict. `background: true` runs the pipeline as a `fund-report` background job over `ctx.jobs`.
- Deterministic metrics as pure functions: performance decomposition (period/annualized return, volatility, max drawdown, Sharpe), holdings penetration (top-N concentration, HHI, industry distribution, quarter-over-quarter comparison), simplified size-value style attribution, and manager profile.
- Citation verification against the sealed snapshot through the optional `dsh-data-quality` service (`ctx.get('dataQuality')`, never injected) with an isomorphic built-in fallback (`builtin-fallback`).
- Offline mode (`offline: true` or the `offline` tool argument): the snapshot layer is read from the storage domain or the newest on-disk version snapshot; zero outbound requests.
- `fund-research/snapshot` and `fund-research/report` session audit events; a short compliance prompt section; and the bundled `fund-research` methodology skill (registered when the skills service is present).
- Fail-loud Schemastery config, five-language READMEs, and real `Context`/`Session`/`ToolRuntime`/`JobRegistry` vitest coverage against the 0.1.0-rc.6 peers.

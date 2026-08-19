# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Quote resilience: per-stock valuation fetches fall back to Eastmoney's own delayed-quote host (`quoteFallbackBaseUrl`, default `push2delay.eastmoney.com`) when the primary push2 host fails; per-stock gaps stay loud and declared.
- Opt-in live end-to-end suite (`pnpm run test:e2e`, gated by `LIVE_E2E=1`): seals a real network report for 161725 and spot-checks five key numbers against the sealed snapshot and a second independent fetch of the same endpoints.

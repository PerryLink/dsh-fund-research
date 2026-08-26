<div align="center">

# 📊 dsh-fund-research
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-fund-research)

**Deterministic research reports for Chinese public mutual funds, on DeepSeek Harness.**

*Every key number in every report traces back to a hashed source snapshot — gaps declared, never invented. Research only; not investment advice.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-🧩-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-fund-research/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-fund-research/actions)
[![npm version](https://img.shields.io/npm/v/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)
[![npm downloads](https://img.shields.io/npm/dm/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## Compatibility

| Component | Version |
|---|---|
| DeepSeek Harness | `0.1.1-rc.2` (peer dependencies pinned) |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| Package manager | `pnpm@11.7.0` |
| Platform | Windows / macOS / Linux (host-only plugin) |
| Data sources | Tiantian Fund / Eastmoney public endpoints (no key, no login) |

## What you get

- **`fund_research` tool** — one fund code in, a versioned Markdown research report out: overview, performance decomposition, holdings penetration, simplified style attribution, manager profile, risk & gap declarations, disclaimer, and a **number-traceability appendix** mapping every key figure to its snapshot JSON path and verification verdict. Sealed to `fund-reports/{code}/{YYYYMMDD-HHmmss}/` as `report.md` + `manifest.json` + `snapshot.json`. `background: true` runs it as a `fund-report` background job.
- **`fund_snapshot` tool** — a light snapshot card (latest NAV, published stage returns, scale, manager, top-3 holdings) sealed into the fund's day directory.
- **Deterministic metrics, zero model arithmetic** — period/annualized return, volatility, max drawdown, Sharpe; top-N concentration, HHI, industry distribution, quarter-over-quarter holdings comparison; size-value style bands; manager tenure and peer comparison. All pure functions over the sealed snapshot.
- **Traceability as a first-class feature** — before sealing, every key number is checked against the sealed `snapshot.json` through the optional [`dsh-data-quality`](https://github.com/topics/dsh-plugin) service when it is installed, or through the built-in isomorphic fallback checker (`builtin-fallback`) otherwise. The appendix table records value ↔ path ↔ verdict.
- **Honest gaps** — a failed or degraded data source produces an explicit 数据缺口 (data gap) declaration in the affected section. The plugin never fills a gap with an invented number.
- **Offline mode** — `offline: true` (config or tool argument) serves everything from the storage-domain snapshot layer or the newest on-disk version snapshot, with zero outbound requests. Ideal for tests and reproduction.
- **asOf cutoff** — `asOfDate` (ISO `YYYY-MM-DD`) truncates the NAV series to data on or before that date and stamps the snapshot + report with the cutoff; invalid or future dates fail loudly.
- **Checkpoint resume** — `<reportRoot>/.run-state.json` records each pipeline stage (snapshot/report) with timestamps and an input fingerprint; `resume: true` continues from the first incomplete stage, reusing sealed artifacts, and rejects a fingerprint mismatch.
- **Source discovery record** — every acquisition seals a code-generated `sources-discovery.json` (endpoint roster, primary/fallback resolution, per-source coverage and gaps, degradation reasons) and folds it into the report appendix as 数据源与缺口声明.
- **Multi-fund fan-out** — `codes` accepts an array of fund codes; each fund runs the pipeline independently with per-fund failure isolation (failures become summary gaps), and the result is a summary card (code / asOf / seal hash / verdicts / failure reason).
- **Tracking ledger** — every successful seal appends a deterministic line to `<reportRoot>/.tracking.jsonl`; `includeComparison: true` renders a deterministic 与上次对比 section (NAV range / scale / top holdings) with a gap declaration when no prior record exists.
- **Read-only review** — after sealing, a `fund-review` job reviews the sealed artifacts (gap-declaration completeness, traceability-table consistency, disclaimer) and writes `review-note.md`; it skips gracefully (recorded in run-state) when no jobs service is present.
- **Per-source quality signals** — every source carries deterministic quality metadata (`requested`/`succeeded`/`fieldsPresent`/`parseWarnings`/`degraded`), rendered in the appendix and surfaced in tool values so downstream can downweight (never hard-filter) a low-quality source.
- **Walk-forward stability summary** — `includeWalkForward: true` adds a 样本外稳定性摘要 section: deterministic rolling-window return/Sharpe sign persistence and mean/std, explicitly labelled as statistical description only, not a prediction.
- **Session audit events** — `fund-research/snapshot` and `fund-research/report` log-only events carry the code, version directory, manifest hash, and gap list (model-visible ⟺ logged).
- **Methodology skill** — a bundled `fund-research` skill teaches the model the metric口径 (definitions), gap handling, and compliance wording. Computation stays in code.

## Quick start

```text
> 用 fund_research 出一份 161725 的研究报告
```

The agent calls `fund_research({ code: "161725" })`; a minute later the workspace holds:

```text
fund-reports/161725/20260819-153012/
├── snapshot.json            # raw extracted data + computed metrics + per-source sha256
├── sources-discovery.json   # code-generated endpoint roster + coverage + gaps
├── report.md                # the research report with the traceability appendix
└── manifest.json            # snapshot/report hashes, parameters, verify engine, gaps
```

`.run-state.json` sits at the report root and records the pipeline stages for `resume: true`. Every number in `report.md`'s appendix carries a `verified` / `mismatch` / `not-found` / `unverifiable` verdict against `snapshot.json` — recompute any of them from `raw.*` with the documented口径 to audit the plugin itself.

## Install & uninstall

```sh
dsh plugin --profile web add dsh-fund-research     # install (npm or tarball)
dsh plugin --profile web remove dsh-fund-research  # uninstall
```

Restart the profile after installing (bundle activation is restart-based). The bundle patch composes the storage stack (`dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`) the snapshot layer needs.

## Configuration

All keys are optional (defaults shown); invalid values fail loudly at load.

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Master switch; `false` mounts nothing at all. |
| `eastmoneyBaseUrl` | `https://fund.eastmoney.com` | Tiantian Fund pingzhongdata host. |
| `f10BaseUrl` | `https://fundf10.eastmoney.com` | Tiantian Fund F10 host (holdings + manager pages). |
| `quoteBaseUrl` | `https://push2.eastmoney.com` | Eastmoney quote host for per-stock valuation snapshots. |
| `quoteFallbackBaseUrl` | `https://push2delay.eastmoney.com` | Fallback quote host tried per stock when the primary fails (Eastmoney's own delayed-quote host); `''` disables it. |
| `requestIntervalMs` | `1000` | Minimum gap between outbound requests (polite collection). |
| `timeoutMs` | `15000` | Per-request timeout. |
| `retries` | `2` | Retries per request with exponential backoff. |
| `cacheTtlHours` | `12` | Storage-domain snapshot reuse window. |
| `riskFreeRate` | `0.02` | Annual risk-free rate for the Sharpe ratio. |
| `offline` | `false` | Never send requests; read the snapshot layer only. |
| `reportRoot` | `fund-reports` | Workspace-relative (or absolute) report tree root. |
| `styleQuotes` | `true` | Fetch per-stock valuation quotes for style attribution. |

## Tools & surfaces

### `fund_research`

| Argument | Type | Description |
|---|---|---|
| `code` | string | Six-digit fund code, e.g. `"161725"` (single fund). Mutually exclusive with `codes`. |
| `codes` | string[] | Multiple six-digit fund codes: a fan-out with per-fund failure isolation (returns a summary). Mutually exclusive with `code`. |
| `sections` | string[] | Section ids to render (`overview`/`performance`/`holdings`/`style`/`manager`/`benchmark`/`risk`/`disclaimer`). Default: all. |
| `offline` | boolean | Read the snapshot layer only (no network). Default: plugin config. |
| `asOfDate` | string | ISO 8601 date (`YYYY-MM-DD`) cutoff: only data on or before it is used (NAV series truncated). Empty = no cutoff; future dates fail loudly. |
| `resume` | boolean | Resume the recorded `.run-state.json` run from the first incomplete stage (reuses sealed artifacts); rejects a fingerprint mismatch. Default: `false`. |
| `includeComparison` | boolean | Render a deterministic 与上次对比 section against the previous `.tracking.jsonl` record; missing evidence is declared as a gap. Default: `false`. |
| `includeWalkForward` | boolean | Render a deterministic 样本外稳定性摘要 (walk-forward) section: rolling-window return/Sharpe sign persistence and mean/std. Statistical description only, not a prediction. Default: `false`. |
| `background` | boolean | Run as a `fund-report` background job; returns `{ kind: "background", jobId }`. Default: `false`. |

### `fund_snapshot`

| Argument | Type | Description |
|---|---|---|
| `code` (required) | string | Six-digit fund code. |
| `offline` | boolean | Read the snapshot layer only. Default: plugin config. |
| `asOfDate` | string | ISO 8601 date (`YYYY-MM-DD`) cutoff: only data on or before it is used. Empty = no cutoff; future dates fail loudly. |

### Report sections

概览 overview · 业绩拆解 performance decomposition · 持仓穿透 holdings penetration · 风格归因 style attribution (simplified) · 经理画像 manager profile · 同类/指数基准对比 benchmark & peer comparison · 风险与缺口声明 risk & gaps · 免责声明 disclaimer · 附录：数字回溯表 traceability appendix.

## Permissions & data

- **Reads** the public Tiantian Fund / Eastmoney endpoints (`fund.eastmoney.com/pingzhongdata/*.js`, `fundf10.eastmoney.com` F10 pages, `push2.eastmoney.com` quotes) with a browser User-Agent and configurable polite pacing. No key, no login, no paid API, no anti-crawler circumvention.
- **Writes** only under the configured report root inside the session workspace, plus the `dsh_fund_research` storage domain (latest snapshot per fund).
- **Never** evaluates remote JavaScript (the pingzhongdata block is scanned, never executed), never stores credentials, never trades.
- Session events are log-only audit records; the pinned 0.1.1-rc.2 peers offer no `ignorable` envelope, so a session restored by a build *without* this plugin refuses those log lines — the same accepted trade-off as other research plugins of this family.

## Security boundaries

- Fund codes are validated as exactly six digits before touching a path or a URL; the report root resolves inside the session workspace.
- Source payloads are hashed (SHA-256) at acquisition; the sealed manifest lets you detect silent upstream edits between runs.
- Verification never blocks a seal: a broken optional `dsh-data-quality` service degrades to the built-in checker, and the engine used is recorded in the manifest and the appendix.
- See [SECURITY.md](SECURITY.md) for the reporting policy.

## Known limitations

- **Upstream structure drift.** The parsers are strict by design: if Tiantian Fund changes a `var Data_*` shape or an F10 table layout, the affected source throws a `SourceParseError` naming the field, and the section degrades to a declared gap (the core pingzhongdata block failing aborts the run loudly). This is deliberate — a silent misparse is worse than a declared gap.
- **Style attribution is估算口径.** Fixed size bands (≥1000亿 / 300–1000亿 / <300亿) and PE bands, plus within-holdings quintiles — no full-market distribution is consulted. The report labels this.
- **Holdings are quarterly disclosure data** (披露滞后); the F10 page carries the latest two quarters.
- **One fund per call; no portfolio analysis, no PDF annual reports, no real-time quotes** (the `fundgz.1234567.com.cn` realtime endpoint is dead and deliberately unused).
- The Web UI "deliverables" turn row keys off mutation-tool call cards; this plugin's produced files surface through the tool call card's follow-along location (the fund's report directory), not per-file rows.

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci   # types, incl. CI-strict
pnpm test                                     # 124 tests over real harness seams
pnpm run test:e2e                              # opt-in LIVE-network E2E (LIVE_E2E=1)
pnpm run build && pnpm run verify:artifacts   # tsdown + tsc declarations
pnpm run verify:self-contained                # no out-of-repo dependency specs
node scripts/check-readme-sync.mjs            # five-language README gate
node scripts/check-endpoints.mjs              # M3 endpoint-liveness probe (4 eastmoney hosts)
pnpm pack                                     # tarball
```

Tests run the REAL `Context`/`SessionStore`/`ToolRuntime`/`LocalJobRegistry`/storage seam from the 0.1.1-rc.2 peers; the network is replaced only at the fetch boundary by saved real-response fixtures (`fixtures/`, fund 161725). Refresh fixtures with the collector scripts in `.tmp/`.

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `fund-research` · `mutual-fund` · `investment-research` · `finance` · `research-report`

## Contributors

- **PerryLink** — maintainer: the collector/metrics/report-seal pipeline, the endpoint-liveness probe, CI and releases, and the five-language docs.
- **dsh-fund-research contributors** — collective author of the foundational build (plugin contract, config schema, tools, tests, packaging).

No external contributors yet — 0 community PRs/issues merged. Open an issue via the forms in `.github/ISSUE_TEMPLATE/` or a pull request against `main` to be listed here.

## PerryLink DSH Plugin Family

Part of a family of standalone DeepSeek Harness plugins sharing one engineering baseline: pinned 0.1.1-rc.2 peers, fail-loud Schemastery config, five-language READMEs, and real-seam vitest coverage.

## License

[Apache-2.0](LICENSE). Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

**Disclaimer: this plugin produces research artifacts only. Nothing it outputs constitutes investment advice.**

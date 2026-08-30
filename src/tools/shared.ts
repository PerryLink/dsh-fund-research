/**
 * Shared tool pipeline for `dsh-fund-research`: workspace/report-root
 * resolution, the snapshot acquisition + seal, and the full research pipeline
 * (acquire → compute → body → verify → appendix → seal → audit events) shared
 * by the foreground tool and the background-job producer.
 * @module dsh-fund-research/tools/shared
 */

import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JobHooks, JobOutcome } from '@deepseek-ai/dsh-jobs'
import type { Logger } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from '../config.ts'
import type { FundSnapshot, ReportManifest } from '../model.ts'
import { acquireSnapshot, parseAsOfDate, type SnapshotStore } from '../sources/snapshot.ts'
import { buildBody, assembleAppendix, sealReport, sealSnapshot, versionStamp, type SectionId, type SealResult } from '../report.ts'
import { builtinVerifyCitations, verifyCitations, type VerifyOutcome } from '../verify-bridge.ts'
import { appendAuditEvent, REPORT_EVENT, SNAPSHOT_EVENT } from '../events.ts'
import { buildSourcesDiscovery, type SourcesDiscovery } from '../discovery.ts'
import { renderWalkForwardSection, walkForwardSummary } from '../walkforward.ts'
import { fundSnapshotSchema } from '../store.ts'
import { sha256Of } from '../sources/eastmoney.ts'
import { markStageDone, newRunState, readRunStateMap, ResumeFingerprintMismatchError, runFingerprint, type RunState } from '../run-state.ts'
import { appendTrackingRecord, buildTrackingRecord, comparisonFactsOf, readTracking, renderComparisonSection } from '../tracking.ts'
import { FUND_REVIEW_JOB_KIND, reviewSealedReport } from '../review.ts'

/** Everything the tools need; assembled by `src/index.ts`. */
export interface ToolDeps {
  readonly ctx: Context
  readonly config: ResolvedConfig
  readonly store: SnapshotStore
  readonly logger: Logger
  /** Plugin version string for manifests. */
  readonly generator: string
}

/** Validate a six-digit fund code, failing loud on anything else. */
export function assertFundCode(code: string): void {
  if (!/^\d{6}$/u.test(code)) {
    throw new Error(`fund code must be exactly six digits, got ${JSON.stringify(code)}`)
  }
}

/** Resolve the workspace root for one execution (session cwd, else process cwd). */
export function workspaceOf(agent: Agent | undefined): string {
  const session = agent?.session as Session | undefined
  const cwd = session?.header.cwd
  return typeof cwd === 'string' && cwd !== '' ? cwd : process.cwd()
}

/** Resolve the absolute report root for one execution. */
export function reportRootOf(config: ResolvedConfig, workspace: string): string {
  return path.isAbsolute(config.reportRoot) ? path.resolve(config.reportRoot) : path.resolve(workspace, config.reportRoot)
}

/** Append one audit event through the adaptive gate; a failed append never changes the tool outcome. */
export function audit(agent: Agent | undefined, type: typeof REPORT_EVENT | typeof SNAPSHOT_EVENT, event: Record<string, unknown>): void {
  const session = agent?.session as Session | undefined
  if (session === undefined) return
  try {
    appendAuditEvent(session, type, event as never)
  } catch {
    // The tool result still logs the model-visible content.
  }
}

/** Source-hash map for the snapshot audit event. */
function sourceHashes(snapshot: FundSnapshot): Record<string, string> {
  return {
    pingzhongdata: snapshot.sources.pingzhongdata.sha256,
    holdings: snapshot.sources.holdings.sha256,
    managerHistory: snapshot.sources.managerHistory.sha256,
    quotes: snapshot.sources.quotes.sha256,
  }
}

/** Options for one research run. */
export interface ResearchOptions {
  sections?: readonly SectionId[]
  offline?: boolean
  signal?: AbortSignal
  /** asOf cutoff date (ISO YYYY-MM-DD); data strictly after it is excluded. */
  asOfDate?: string
  /** Resume from `.run-state.json` when its fingerprint matches; mismatch fails loud. */
  resume?: boolean
  /** Render a 与上次对比 section against the previous `.tracking.jsonl` record. */
  includeComparison?: boolean
  /** Render a 样本外稳定性摘要 (walk-forward) section over the NAV series. */
  includeWalkForward?: boolean
}

/** Read one text file, returning `null` when it is missing (never throws). */
async function readTextIfExists(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8')
  } catch {
    return null
  }
}

/** Seal the deterministic discovery record beside the snapshot in the version directory. */
async function sealDiscovery(discovery: SourcesDiscovery, versionDir: string): Promise<void> {
  await writeFile(path.join(versionDir, 'sources-discovery.json'), JSON.stringify(discovery, null, 2), 'utf8')
}

/** The complete research-run result (canonical tool value / job outcome facts). */
export interface ResearchRun {
  snapshot: FundSnapshot
  seal: SealResult
  outcome: VerifyOutcome
  live: boolean
  /** Section ids actually rendered. */
  sections: SectionId[]
  /** Verdict tallies across the traceability table. */
  verdicts: { verified: number, mismatch: number, notFound: number, unverifiable: number }
  /** The data-source discovery record (per-source quality signals included). */
  discovery: SourcesDiscovery
}

/**
 * Run the full research pipeline for one fund, checkpointed to
 * `<reportRoot>/.run-state.json`. The snapshot is sealed into the version
 * directory before citation verification reads it back, then the report and
 * manifest are sealed and both audit events are appended. `resume: true`
 * continues a recorded run from the first incomplete stage, reusing the sealed
 * artifacts of completed stages; a fingerprint mismatch fails loud.
 * @param deps - tool dependencies.
 * @param code - six-digit fund code.
 * @param agent - the owning agent (workspace + session for audit events).
 * @param options - section selection, offline override, cancellation, asOf cutoff, resume.
 * @returns the run facts.
 */
export async function runResearch(
  deps: ToolDeps,
  code: string,
  agent: Agent | undefined,
  options: ResearchOptions = {},
): Promise<ResearchRun> {
  assertFundCode(code)
  const workspace = workspaceOf(agent)
  const reportRootAbs = reportRootOf(deps.config, workspace)
  const asOfDate = parseAsOfDate(options.asOfDate)
  const resume = options.resume ?? false
  const offline = options.offline ?? deps.config.offline
  const includeComparison = options.includeComparison ?? false
  const includeWalkForward = options.includeWalkForward ?? false
  const fingerprint = runFingerprint({
    code,
    sections: options.sections,
    asOfDate: asOfDate ?? null,
    offline,
    riskFreeRate: deps.config.riskFreeRate,
    styleQuotes: deps.config.styleQuotes,
    includeComparison,
    includeWalkForward,
  })

  // Load any recorded run; resume rejects a changed input loudly.
  let recorded: RunState | undefined
  if (resume) {
    const map = await readRunStateMap(reportRootAbs)
    const candidate = map[code]
    if (candidate !== undefined) {
      if (candidate.fingerprint !== fingerprint) throw new ResumeFingerprintMismatchError(code)
      recorded = candidate
    }
  }

  const now = Date.now()
  const version = recorded?.version ?? versionStamp(now)
  const versionDir = path.join(reportRootAbs, code, version)
  const state: RunState = recorded ?? newRunState(code, fingerprint, version, now)
  // Resuming reuses the recorded version directory: seal with the original
  // clock so `sealReport` reproduces the same version stamp.
  const sealNow = recorded === undefined ? now : recorded.startedAt
  const rel = (absolute: string): string => path.relative(workspace, absolute).split(path.sep).join('/')
  const snapshotPath = path.join(versionDir, 'snapshot.json')
  const discoveryPath = path.join(versionDir, 'sources-discovery.json')
  const reportPath = path.join(versionDir, 'report.md')
  const manifestPath = path.join(versionDir, 'manifest.json')

  // ---- snapshot stage ----
  let snapshot: FundSnapshot
  let live: boolean
  let discovery: SourcesDiscovery
  let sealedSnapshot: { path: string, sha256: string }

  const snapshotText = state.stages.snapshot.status === 'done' ? await readTextIfExists(snapshotPath) : null
  if (snapshotText !== null) {
    // Reuse the sealed snapshot — no re-collection.
    snapshot = fundSnapshotSchema.parse(JSON.parse(snapshotText)) as FundSnapshot
    sealedSnapshot = { path: snapshotPath, sha256: sha256Of(snapshotText) }
    live = false
    discovery = JSON.parse((await readTextIfExists(discoveryPath)) ?? 'null') as SourcesDiscovery
    if (discovery === null || typeof discovery !== 'object') {
      discovery = buildSourcesDiscovery(snapshot, {
        primaryUrl: deps.config.quoteBaseUrl,
        fallbackUrl: deps.config.quoteFallbackBaseUrl === '' ? null : deps.config.quoteFallbackBaseUrl,
        fallbackUsed: false,
        requested: snapshot.raw.holdings?.rows.length ?? 0,
        succeeded: Object.keys(snapshot.raw.quotes?.rows ?? {}).length,
      }, now, false)
    }
  } else {
    const acquired = await acquireSnapshot(deps.store, code, {
      ...(options.offline === undefined ? {} : { offline: options.offline }),
      reportRootAbs,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.asOfDate === undefined ? {} : { asOfDate: options.asOfDate }),
    })
    snapshot = acquired.snapshot
    live = acquired.live
    discovery = acquired.discovery
    sealedSnapshot = await sealSnapshot(snapshot, versionDir)
    await sealDiscovery(discovery, versionDir)
    audit(agent, SNAPSHOT_EVENT, {
      code: snapshot.code,
      name: snapshot.name,
      fetchedAt: snapshot.fetchedAt,
      live,
      sourceHashes: sourceHashes(snapshot),
      gaps: snapshot.gaps,
    })
    await markStageDone(reportRootAbs, state, 'snapshot', now)
  }

  const body = buildBody(snapshot, options.sections)
  const citations = body.citations.map(citation => ({
    id: citation.id,
    path: citation.path,
    value: citation.value,
    tolerance: citation.tolerance,
  }))

  // ---- report stage ----
  let outcome: VerifyOutcome
  let seal: SealResult
  let verdicts: ResearchRun['verdicts']

  const manifestText = state.stages.report.status === 'done' ? await readTextIfExists(manifestPath) : null
  const reportText = state.stages.report.status === 'done' ? await readTextIfExists(reportPath) : null
  if (state.stages.report.status === 'done' && state.report !== undefined && manifestText !== null && reportText !== null) {
    // Idempotent resume: reuse the sealed report and manifest, no re-verification.
    const manifest = JSON.parse(manifestText) as ReportManifest
    verdicts = { ...state.report.verdicts }
    outcome = {
      engine: manifest.verifyEngine === 'dsh-data-quality' ? 'dsh-data-quality' : 'builtin-fallback',
      result: await builtinVerifyCitations({
        dataset: rel(snapshotPath),
        citations,
      }, () => snapshotPath),
    }
    seal = {
      version,
      versionDir,
      reportPathRel: rel(reportPath),
      manifestPathRel: rel(manifestPath),
      snapshotPathRel: rel(snapshotPath),
      reportPathAbs: reportPath,
      manifestPathAbs: manifestPath,
      manifestSha256: sha256Of(manifestText),
      manifest,
      markdown: reportText,
    }
  } else {
    // Deterministic comparison against the previous tracking record.
    const comparisonMarkdown = includeComparison
      ? renderComparisonSection(
          (await readTracking(reportRootAbs)).filter(record => record.code === code).at(-1)?.comparison ?? null,
          comparisonFactsOf(snapshot),
          code,
        )
      : ''
    // Minimal walk-forward stability summary over the NAV series.
    const walkForwardMarkdown = includeWalkForward
      ? renderWalkForwardSection(walkForwardSummary(snapshot.raw.navTrend, deps.config.riskFreeRate))
      : ''

    outcome = await verifyCitations(deps.ctx, {
      dataset: rel(sealedSnapshot.path),
      citations,
    }, { resolveDataset: () => sealedSnapshot.path })

    const appendix = assembleAppendix(body.citations, outcome, snapshot, discovery)
    const extras = [comparisonMarkdown, walkForwardMarkdown].filter(section => section !== '').join('\n\n')
    const markdown = `${body.markdown}${extras === '' ? '' : `\n\n${extras}`}\n\n${appendix}\n`

    seal = await sealReport(snapshot, markdown, {
      reportRootAbs,
      workspaceRoot: workspace,
      outcome,
      snapshotSha256: sealedSnapshot.sha256,
      now: sealNow,
      generator: deps.generator,
    })

    verdicts = { verified: 0, mismatch: 0, notFound: 0, unverifiable: 0 }
    for (const result of outcome.result.results) {
      if (result.status === 'verified') verdicts.verified++
      else if (result.status === 'mismatch') verdicts.mismatch++
      else if (result.status === 'not-found') verdicts.notFound++
      else verdicts.unverifiable++
    }
    await appendTrackingRecord(reportRootAbs, buildTrackingRecord(snapshot, seal, Date.now()))
    await scheduleReview(deps, agent, versionDir, state)
    await markStageDone(reportRootAbs, state, 'report', now, {
      engine: outcome.engine,
      verdicts,
      reportSha256: seal.manifest.reportSha256,
      manifestSha256: seal.manifestSha256,
      snapshotSha256: sealedSnapshot.sha256,
    })
  }

  audit(agent, REPORT_EVENT, {
    code: snapshot.code,
    name: snapshot.name,
    version: seal.version,
    reportPath: seal.reportPathRel,
    manifestSha256: seal.manifestSha256,
    reportSha256: seal.manifest.reportSha256,
    verifyEngine: outcome.engine,
    gaps: snapshot.gaps,
  })

  return { snapshot, seal, outcome, live, sections: body.renderedSections, verdicts, discovery }
}

/** The structural surface of the optional `ctx.jobs` service the review stage uses. */
interface ReviewJobsLike {
  start(spec: { kind: 'fund-review', label: string, owner: Agent, run: () => JobHooks }): string
}

/**
 * Schedule the read-only review stage after sealing. With no `ctx.jobs` (or no
 * agent owner) it records a graceful skip; otherwise it spawns a `fund-review`
 * job whose run writes `review-note.md` back into the version directory.
 * @param deps - tool dependencies.
 * @param agent - the owning agent.
 * @param versionDir - absolute version directory of the sealed report.
 * @param state - the run state (its `review` field is set here).
 */
async function scheduleReview(deps: ToolDeps, agent: Agent | undefined, versionDir: string, state: RunState): Promise<void> {
  const jobs = deps.ctx.get('jobs') as unknown as ReviewJobsLike | undefined
  if (jobs === undefined) {
    state.review = 'skipped(jobs unavailable)'
    return
  }
  if (agent === undefined) {
    state.review = 'skipped(no agent owner)'
    return
  }
  const jobId = jobs.start({
    kind: FUND_REVIEW_JOB_KIND,
    label: `fund review ${state.code}`,
    owner: agent,
    run: (): JobHooks => {
      const progress: string[] = []
      const done = (async (): Promise<JobOutcome> => {
        try {
          const { markdown } = await reviewSealedReport(versionDir)
          progress.push(markdown)
          return { status: 'completed', detail: 'review-note.md written', output: markdown }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          progress.push(`failed: ${message}`)
          return { status: 'failed', detail: message }
        }
      })()
      return {
        cancel: () => {},
        done,
        readOutput: () => progress.splice(0).join('\n'),
      }
    },
  })
  state.review = `queued(${String(jobId)})`
}

/** One fund's outcome inside a multi-fund fan-out summary. */
export interface FundRunSummaryEntry {
  code: string
  name: string | null
  version: string | null
  asOfDate: string | null
  snapshotSha256: string | null
  reportSha256: string | null
  verdicts: ResearchRun['verdicts'] | null
  reportPath: string | null
  error: string | null
}

/**
 * Run the pipeline for many funds, isolating per-fund failure: a failing fund
 * becomes an error entry in the summary and never aborts the others. All runs
 * share one polite fetcher and the same storage-domain cache through `deps`.
 * @param deps - tool dependencies.
 * @param codes - validated six-digit fund codes (deduplicated, order preserved).
 * @param agent - the owning agent.
 * @param options - the per-run options (reused by every fund).
 * @returns one summary entry per fund, in input order.
 */
export async function runResearchFanOut(
  deps: ToolDeps,
  codes: readonly string[],
  agent: Agent | undefined,
  options: ResearchOptions = {},
): Promise<FundRunSummaryEntry[]> {
  const entries: FundRunSummaryEntry[] = []
  for (const code of codes) {
    try {
      const run = await runResearch(deps, code, agent, options)
      entries.push({
        code,
        name: run.snapshot.name,
        version: run.seal.version,
        asOfDate: run.snapshot.asOf ?? null,
        snapshotSha256: run.seal.manifest.snapshotSha256,
        reportSha256: run.seal.manifest.reportSha256,
        verdicts: run.verdicts,
        reportPath: run.seal.reportPathRel,
        error: null,
      })
    } catch (error) {
      entries.push({
        code,
        name: null,
        version: null,
        asOfDate: null,
        snapshotSha256: null,
        reportSha256: null,
        verdicts: null,
        reportPath: null,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return entries
}

/** The snapshot-card run result (canonical value of `fund_snapshot`). */
export interface SnapshotCardRun {
  snapshot: FundSnapshot
  live: boolean
  /** Version directory name (`YYYYMMDD-snapshot`). */
  version: string
  /** Workspace-relative card path. */
  cardPathRel: string
  /** Workspace-relative snapshot path. */
  snapshotPathRel: string
  /** Workspace-relative sources-discovery path. */
  discoveryPathRel: string
  /** The data-source discovery record (per-source quality signals included). */
  discovery: SourcesDiscovery
  /** Absolute card path. */
  cardPathAbs: string
}

/** Build the light snapshot-card markdown. */
export function renderSnapshotCard(snapshot: FundSnapshot): string {
  const { raw, computed } = snapshot
  const lines = [
    `# ${snapshot.name}（${snapshot.code}）快照卡`,
    '',
    `- 最新单位净值：**${computed.performance.latestNav}**（${computed.performance.latestDate}）`,
    `- 近1年收益率（数据源发布口径）：**${raw.returns.year1}%**；近6月 ${raw.returns.month6}%；近3月 ${raw.returns.month3}%；近1月 ${raw.returns.month1}%`,
  ]
  const lastScale = raw.scaleHistory.values[raw.scaleHistory.values.length - 1]
  if (lastScale !== undefined) {
    lines.push(`- 最新规模：**${lastScale} 亿元**（${raw.scaleHistory.dates[raw.scaleHistory.dates.length - 1] ?? '?'}）`)
  }
  lines.push(`- 基金经理：**${raw.manager.name}**（从业 ${raw.manager.workTime}）`)
  if (raw.holdings !== null && raw.holdings.rows.length >= 3) {
    lines.push(`- 前三大重仓：${raw.holdings.rows.slice(0, 3).map(row => `${row.name} ${row.navPct}%`).join('、')}（${raw.holdings.asOf}）`)
  }
  if (snapshot.gaps.length > 0) lines.push(`- 数据缺口：${snapshot.gaps.join('、')}`)
  lines.push('', DISCLAIMER_NOTE)
  return lines.join('\n')
}

/** The short disclaimer note for the snapshot card. */
const DISCLAIMER_NOTE = '> 仅供研究参考，不构成投资建议。'

/**
 * Run the snapshot-card pipeline: acquire (or read offline) and seal the card
 * plus the snapshot into the fund's day directory (`{code}/{YYYYMMDD}-snapshot/`,
 * reused by every same-day call).
 * @param deps - tool dependencies.
 * @param code - six-digit fund code.
 * @param agent - the owning agent.
 * @param options - offline override, cancellation, asOf cutoff.
 * @returns the card run facts.
 */
export async function runSnapshotCard(
  deps: ToolDeps,
  code: string,
  agent: Agent | undefined,
  options: { offline?: boolean, signal?: AbortSignal, asOfDate?: string } = {},
): Promise<SnapshotCardRun> {
  assertFundCode(code)
  const workspace = workspaceOf(agent)
  const reportRootAbs = reportRootOf(deps.config, workspace)
  const { snapshot, live, discovery } = await acquireSnapshot(deps.store, code, {
    ...(options.offline === undefined ? {} : { offline: options.offline }),
    reportRootAbs,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.asOfDate === undefined ? {} : { asOfDate: options.asOfDate }),
  })

  const day = versionStamp(Date.now()).slice(0, 8)
  const version = `${day}-snapshot`
  const versionDir = path.join(reportRootAbs, snapshot.code, version)
  await mkdir(versionDir, { recursive: true })
  const snapshotJson = JSON.stringify(snapshot, null, 2)
  const snapshotAbs = path.join(versionDir, 'snapshot.json')
  await writeFile(snapshotAbs, snapshotJson, 'utf8')
  const discoveryAbs = path.join(versionDir, 'sources-discovery.json')
  await writeFile(discoveryAbs, JSON.stringify(discovery, null, 2), 'utf8')
  const cardAbs = path.join(versionDir, 'snapshot-card.md')
  await writeFile(cardAbs, `${renderSnapshotCard(snapshot)}\n`, 'utf8')

  audit(agent, SNAPSHOT_EVENT, {
    code: snapshot.code,
    name: snapshot.name,
    fetchedAt: snapshot.fetchedAt,
    live,
    sourceHashes: sourceHashes(snapshot),
    gaps: snapshot.gaps,
  })

  const rel = (absolute: string): string => path.relative(workspace, absolute).split(path.sep).join('/')
  return { snapshot, live, version, cardPathRel: rel(cardAbs), snapshotPathRel: rel(snapshotAbs), discoveryPathRel: rel(discoveryAbs), discovery, cardPathAbs: cardAbs }
}

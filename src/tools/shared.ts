/**
 * Shared tool pipeline for `dsh-fund-research`: workspace/report-root
 * resolution, the snapshot acquisition + seal, and the full research pipeline
 * (acquire → compute → body → verify → appendix → seal → audit events) shared
 * by the foreground tool and the background-job producer.
 * @module dsh-fund-research/tools/shared
 */

import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Logger } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from '../config.ts'
import type { FundSnapshot } from '../model.ts'
import { acquireSnapshot, type SnapshotStore } from '../sources/snapshot.ts'
import { buildBody, assembleAppendix, sealReport, sealSnapshot, versionStamp, type SectionId, type SealResult } from '../report.ts'
import { verifyCitations, type VerifyOutcome } from '../verify-bridge.ts'
import { REPORT_EVENT, SNAPSHOT_EVENT } from '../events.ts'

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

/** Append one audit event; a failed append never changes the tool outcome. */
export function audit(agent: Agent | undefined, type: typeof REPORT_EVENT | typeof SNAPSHOT_EVENT, event: Record<string, unknown>): void {
  const session = agent?.session as Session | undefined
  if (session === undefined) return
  try {
    session.append(type, event as never)
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
}

/**
 * Run the full research pipeline for one fund. The snapshot is sealed into the
 * version directory before citation verification reads it back, then the
 * report and manifest are sealed and both audit events are appended.
 * @param deps - tool dependencies.
 * @param code - six-digit fund code.
 * @param agent - the owning agent (workspace + session for audit events).
 * @param options - section selection, offline override, cancellation.
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

  const { snapshot, live } = await acquireSnapshot(deps.store, code, {
    ...(options.offline === undefined ? {} : { offline: options.offline }),
    reportRootAbs,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  })
  audit(agent, SNAPSHOT_EVENT, {
    code: snapshot.code,
    name: snapshot.name,
    fetchedAt: snapshot.fetchedAt,
    live,
    sourceHashes: sourceHashes(snapshot),
    gaps: snapshot.gaps,
  })

  const body = buildBody(snapshot, options.sections)

  // Seal the snapshot first: the citation checker reads it back from disk.
  const now = Date.now()
  const version = versionStamp(now)
  const versionDir = path.join(reportRootAbs, snapshot.code, version)
  const sealedSnapshot = await sealSnapshot(snapshot, versionDir)

  const outcome = await verifyCitations(deps.ctx, {
    dataset: path.relative(workspace, sealedSnapshot.path).split(path.sep).join('/'),
    citations: body.citations.map(citation => ({
      id: citation.id,
      path: citation.path,
      value: citation.value,
      tolerance: citation.tolerance,
    })),
  }, { resolveDataset: () => sealedSnapshot.path })

  const appendix = assembleAppendix(body.citations, outcome, snapshot)
  const markdown = `${body.markdown}\n\n${appendix}\n`

  const seal = await sealReport(snapshot, markdown, {
    reportRootAbs,
    workspaceRoot: workspace,
    outcome,
    snapshotSha256: sealedSnapshot.sha256,
    now,
    generator: deps.generator,
  })

  const verdicts = { verified: 0, mismatch: 0, notFound: 0, unverifiable: 0 }
  for (const result of outcome.result.results) {
    if (result.status === 'verified') verdicts.verified++
    else if (result.status === 'mismatch') verdicts.mismatch++
    else if (result.status === 'not-found') verdicts.notFound++
    else verdicts.unverifiable++
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

  return { snapshot, seal, outcome, live, sections: body.renderedSections, verdicts }
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
 * @param options - offline override + cancellation.
 * @returns the card run facts.
 */
export async function runSnapshotCard(
  deps: ToolDeps,
  code: string,
  agent: Agent | undefined,
  options: { offline?: boolean, signal?: AbortSignal } = {},
): Promise<SnapshotCardRun> {
  assertFundCode(code)
  const workspace = workspaceOf(agent)
  const reportRootAbs = reportRootOf(deps.config, workspace)
  const { snapshot, live } = await acquireSnapshot(deps.store, code, {
    ...(options.offline === undefined ? {} : { offline: options.offline }),
    reportRootAbs,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  })

  const day = versionStamp(Date.now()).slice(0, 8)
  const version = `${day}-snapshot`
  const versionDir = path.join(reportRootAbs, snapshot.code, version)
  await mkdir(versionDir, { recursive: true })
  const snapshotJson = JSON.stringify(snapshot, null, 2)
  const snapshotAbs = path.join(versionDir, 'snapshot.json')
  await writeFile(snapshotAbs, snapshotJson, 'utf8')
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
  return { snapshot, live, version, cardPathRel: rel(cardAbs), snapshotPathRel: rel(snapshotAbs), cardPathAbs: cardAbs }
}

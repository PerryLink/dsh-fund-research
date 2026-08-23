/**
 * The `fund_research` tool: the full deterministic research pipeline for one
 * Chinese public mutual fund — acquire (or read the snapshot layer offline),
 * compute, assemble, verify citations, seal the versioned report, and append
 * the audit events. Long runs can be delegated to a `fund-report` background
 * job over `ctx.jobs`. Research only — not investment advice.
 * @module dsh-fund-research/tools/research
 */

import path from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JobHooks, JobOutcome } from '@deepseek-ai/dsh-jobs'
import type { SectionId } from '../report.ts'
import { sourceQualityOf, type SourceQualityEntry } from '../discovery.ts'
import { runResearch, runResearchFanOut, type FundRunSummaryEntry, type ResearchRun, type ToolDeps } from './shared.ts'

/** The background-job kind this producer registers (declaration-merged into JobKindMap). */
export const FUND_REPORT_JOB_KIND = 'fund-report' as const

declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap {
    'fund-report': typeof FUND_REPORT_JOB_KIND
  }
}

/** The foreground canonical value of one `fund_research` call. */
export interface ResearchValue {
  kind: 'sealed'
  code: string
  name: string
  version: string
  reportPath: string
  manifestPath: string
  snapshotPath: string
  reportSha256: string
  manifestSha256: string
  snapshotSha256: string
  verifyEngine: string
  verdicts: { verified: number, mismatch: number, notFound: number, unverifiable: number }
  gaps: string[]
  sections: string[]
  live: boolean
  offline: boolean
  /** asOf cutoff applied (`null` = none). */
  asOfDate: string | null
  /** Per-source quality signals (requested/succeeded/fieldsPresent/warnings/degraded). */
  sourceQuality: SourceQualityEntry[]
}

/** The background-branch canonical value: a typed handle, never prose to parse. */
export interface BackgroundValue {
  kind: 'background'
  jobId: string
}

/** The multi-fund fan-out canonical value. */
export interface SummaryValue {
  kind: 'summary'
  funds: FundRunSummaryEntry[]
  /** Fund codes whose run failed (the summary's declared gaps). */
  gaps: string[]
}

/** All canonical value shapes of one `fund_research` call. */
export type ResearchToolValue = ResearchValue | BackgroundValue | SummaryValue

/** Project the fan-out entries into the summary value. */
function summaryValueOf(entries: FundRunSummaryEntry[]): SummaryValue {
  return {
    kind: 'summary',
    funds: entries,
    gaps: entries.filter(entry => entry.error !== null).map(entry => entry.code),
  }
}

/** Resolve the requested fund codes from `code` and/or `codes` (validated later, per run). */
function resolveCodes(args: { code?: string, codes?: string[] }): string[] {
  const raw = args.codes ?? (args.code === undefined ? [] : [args.code])
  if (raw.length === 0) {
    throw new Error('fund_research requires `code` or a non-empty `codes` array')
  }
  const seen = new Set<string>()
  const codes: string[] = []
  for (const entry of raw) {
    if (!seen.has(entry)) {
      seen.add(entry)
      codes.push(entry)
    }
  }
  return codes
}

/** Render the multi-fund summary card. */
function renderSummary(value: SummaryValue): string {
  const lines = [`fund_research 多基金汇总 — 仅供研究参考，不构成投资建议`]
  for (const fund of value.funds) {
    if (fund.error !== null) {
      lines.push(`- ${fund.code}：失败（${fund.error}）`)
    } else {
      const v = fund.verdicts
      lines.push(`- ${fund.code} ${fund.name ?? ''}：版本 ${fund.version ?? ''}，asOf ${fund.asOfDate ?? '—'}，报告 ${fund.reportPath ?? ''}（verified ${v?.verified ?? 0} / mismatch ${v?.mismatch ?? 0} / not-found ${v?.notFound ?? 0}）`)
    }
  }
  if (value.gaps.length > 0) lines.push(`失败项（已隔离，不影响其余）：${value.gaps.join('、')}`)
  return lines.join('\n')
}

/** Render the model-facing summary of one sealed report. */
function renderResearch(value: ResearchToolValue): string {
  if (value.kind === 'background') {
    return `fund_research 后台任务已启动：${value.jobId}（用 job_read 查看进度与结果）`
  }
  if (value.kind === 'summary') return renderSummary(value)
  const v = value.verdicts
  const lines = [
    `${value.name}（${value.code}）研究报告已封存 — 仅供研究参考，不构成投资建议`,
    `版本目录 ${value.version}；报告 ${value.reportPath}`,
    `manifest ${value.manifestPath}（报告 sha256 ${value.reportSha256.slice(0, 12)}…）`,
    `数字回溯表核查（${value.verifyEngine}）：verified ${v.verified} / mismatch ${v.mismatch} / not-found ${v.notFound} / unverifiable ${v.unverifiable}`,
  ]
  if (value.gaps.length > 0) lines.push(`数据缺口（报告对应章节已声明）：${value.gaps.join('、')}`)
  if (value.asOfDate !== null) lines.push(`asOf 截点：${value.asOfDate}（仅采用不晚于该日期的数据）`)
  lines.push(`采集方式：${value.live ? '实时采集' : '快照复用'}${value.offline ? '（offline）' : ''}；章节：${value.sections.join('、')}`)
  return lines.join('\n')
}

/** Project one run into the canonical value. */
function researchValueOf(run: ResearchRun, offline: boolean): ResearchValue {
  return {
    kind: 'sealed',
    code: run.snapshot.code,
    name: run.snapshot.name,
    version: run.seal.version,
    reportPath: run.seal.reportPathRel,
    manifestPath: run.seal.manifestPathRel,
    snapshotPath: run.seal.snapshotPathRel,
    reportSha256: run.seal.manifest.reportSha256,
    manifestSha256: run.seal.manifestSha256,
    snapshotSha256: run.seal.manifest.snapshotSha256,
    verifyEngine: run.outcome.engine,
    verdicts: run.verdicts,
    gaps: run.snapshot.gaps,
    sections: run.sections,
    live: run.live,
    offline,
    asOfDate: run.snapshot.asOf ?? null,
    sourceQuality: sourceQualityOf(run.discovery),
  }
}

/** Validate the section selection against the known section ids. */
function parseSections(input: string[] | undefined): SectionId[] | undefined {
  if (input === undefined) return undefined
  const known = new Set<string>(['overview', 'performance', 'holdings', 'style', 'manager', 'risk', 'disclaimer', 'appendix'])
  for (const section of input) {
    if (!known.has(section)) {
      throw new Error(`unknown section ${JSON.stringify(section)}; known: ${[...known].join(', ')}`)
    }
  }
  return input as SectionId[]
}

/** The structural surface of the optional `ctx.jobs` service this tool uses. */
interface JobsLike {
  start(spec: {
    kind: 'fund-report'
    label: string
    owner: Agent
    run: () => JobHooks
  }): string
}

/**
 * Build the `fund_research` tool definition.
 * @param deps - shared tool dependencies.
 * @returns the registry-ready tool definition.
 */
export function buildResearchTool(deps: ToolDeps) {
  return defineTool({
    name: 'fund_research',
    description: 'Run a full deterministic research pipeline for one or more Chinese public mutual funds: collect public data (Tiantian Fund/Eastmoney), compute performance decomposition, holdings penetration, simplified style attribution and manager profile, verify every key number against the sealed source snapshot, and seal a versioned Markdown report + manifest per fund under the report root. Pass `codes` for a multi-fund fan-out (per-fund failure isolation, summary card). Set background: true to run as a background job; set includeComparison: true to render a deterministic 与上次对比 section against the tracking ledger. Public data only; research use only — not investment advice.',
    parameters: {
      code: { type: 'string', description: 'Six-digit fund code, e.g. "161725" (single fund). Mutually exclusive with `codes`.' },
      codes: { type: 'array', items: { type: 'string' }, description: 'Multiple six-digit fund codes (fan-out with per-fund failure isolation; returns a summary). Mutually exclusive with `code`.' },
      sections: { type: 'array', items: { type: 'string' }, description: 'Section ids to render (overview/performance/holdings/style/manager/risk/disclaimer). Defaults to all.' },
      offline: { type: 'boolean', description: 'Read the stored snapshot layer only (no network). Defaults to the plugin config.' },
      asOfDate: { type: 'string', description: 'ISO 8601 date (YYYY-MM-DD) cutoff: only data on or before this date is used (NAV series truncated). Empty = no cutoff. Future dates fail loudly.' },
      resume: { type: 'boolean', description: 'Resume the recorded run-state (reuses the sealed artifacts of completed stages). Rejects a fingerprint mismatch. Default false.' },
      includeComparison: { type: 'boolean', description: 'Render a deterministic 与上次对比 section against the previous .tracking.jsonl record for the same fund; missing evidence is declared as a gap. Default false.' },
      includeWalkForward: { type: 'boolean', description: 'Render a deterministic 样本外稳定性摘要 (walk-forward) section with rolling-window return/Sharpe sign persistence and mean/std. Statistical description only, not a prediction. Default false.' },
      background: { type: 'boolean', description: 'Run as a background job (returns a job id handle). Default false.' },
    },
    output: {
      schema: {
        oneOf: [
          {
            type: 'object',
            properties: {
              kind: { type: 'string', const: 'sealed', required: true },
              code: { type: 'string', required: true },
              name: { type: 'string', required: true },
              version: { type: 'string', required: true },
              reportPath: { type: 'string', required: true },
              manifestPath: { type: 'string', required: true },
              snapshotPath: { type: 'string', required: true },
              reportSha256: { type: 'string', required: true },
              manifestSha256: { type: 'string', required: true },
              snapshotSha256: { type: 'string', required: true },
              verifyEngine: { type: 'string', required: true },
              verdicts: {
                type: 'object',
                properties: {
                  verified: { type: 'integer', required: true },
                  mismatch: { type: 'integer', required: true },
                  notFound: { type: 'integer', required: true },
                  unverifiable: { type: 'integer', required: true },
                },
                additionalProperties: false,
                required: true,
              },
              gaps: { type: 'array', items: { type: 'string' }, required: true },
              sections: { type: 'array', items: { type: 'string' }, required: true },
              live: { type: 'boolean', required: true },
              offline: { type: 'boolean', required: true },
              asOfDate: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
              sourceQuality: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source: { type: 'string', required: true },
                    requested: { type: 'integer', required: true },
                    succeeded: { type: 'integer', required: true },
                    fieldsPresent: { type: 'integer', required: true },
                    parseWarnings: { type: 'array', items: { type: 'string' }, required: true },
                    degraded: { type: 'boolean', required: true },
                  },
                  additionalProperties: false,
                },
                required: true,
              },
            },
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              kind: { type: 'string', const: 'background', required: true },
              jobId: { type: 'string', required: true },
            },
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              kind: { type: 'string', const: 'summary', required: true },
              funds: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', required: true },
                    name: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
                    version: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
                    asOfDate: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
                    snapshotSha256: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
                    reportSha256: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
                    verdicts: {
                      oneOf: [
                        {
                          type: 'object',
                          properties: {
                            verified: { type: 'integer', required: true },
                            mismatch: { type: 'integer', required: true },
                            notFound: { type: 'integer', required: true },
                            unverifiable: { type: 'integer', required: true },
                          },
                          additionalProperties: false,
                        },
                        { type: 'null' },
                      ],
                      required: true,
                    },
                    reportPath: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
                    error: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
                  },
                  additionalProperties: false,
                },
                required: true,
              },
              gaps: { type: 'array', items: { type: 'string' }, required: true },
            },
            additionalProperties: false,
          },
        ],
      },
      render: (_args, value) => [{ type: 'text', text: renderResearch(value as ResearchToolValue) }],
      presentationMeta: (_args, value) => {
        const current = value as ResearchToolValue
        if (current.kind === 'background') return { kind: 'background', jobId: current.jobId }
        if (current.kind === 'summary') return { kind: 'summary', count: current.funds.length }
        return {
          kind: 'sealed',
          reportPath: current.reportPath,
          manifestPath: current.manifestPath,
          snapshotPath: current.snapshotPath,
          reportSha256: current.reportSha256,
        }
      },
    },
    presentCall: (args) => {
      const root = deps.config.reportRoot
      const codes = args.codes ?? (args.code === undefined ? [] : [args.code])
      const locations = codes.map(code => ({
        path: path.isAbsolute(root) ? path.join(root, code) : `${root}/${code}/`,
      }))
      return { card: 'generic' as const, title: `fund_research ${codes.join(',')}`, kind: 'edit' as const, locations }
    },
    presentResult: (_args, result) => {
      const meta = result.meta as { kind?: string, reportPath?: string, count?: number } | undefined
      if (meta?.kind === 'sealed' && typeof meta.reportPath === 'string') {
        return {
          card: 'generic' as const,
          title: `fund_research → ${meta.reportPath}`,
        }
      }
      if (meta?.kind === 'summary') {
        return { card: 'generic' as const, title: `fund_research → ${meta.count ?? 0} funds` }
      }
      return undefined
    },
    async execute(args, exec) {
      const sections = parseSections(args.sections)
      const offline = args.offline ?? deps.config.offline
      const codes = resolveCodes(args)
      const multi = Array.isArray(args.codes)
      const runOptions = {
        ...(sections === undefined ? {} : { sections }),
        ...(args.offline === undefined ? {} : { offline: args.offline }),
        ...(args.asOfDate === undefined ? {} : { asOfDate: args.asOfDate }),
        ...(args.resume === undefined ? {} : { resume: args.resume }),
        ...(args.includeComparison === undefined ? {} : { includeComparison: args.includeComparison }),
        ...(args.includeWalkForward === undefined ? {} : { includeWalkForward: args.includeWalkForward }),
      }

      /** One pipeline execution: a single sealed report, or a fan-out summary. */
      const pipeline = async (agent: Agent | undefined, signal: AbortSignal): Promise<ResearchToolValue> => {
        if (multi || codes.length > 1) {
          const entries = await runResearchFanOut(deps, codes, agent, { ...runOptions, signal })
          return summaryValueOf(entries)
        }
        const run = await runResearch(deps, codes[0]!, agent, { ...runOptions, signal })
        return researchValueOf(run, offline)
      }

      if (args.background === true) {
        const jobs = deps.ctx.get('jobs') as unknown as JobsLike | undefined
        if (jobs === undefined) {
          throw new Error('background mode requires the ctx.jobs service (shipped in dsh-base); rerun without background: true')
        }
        if (exec.agent === undefined) {
          throw new Error('background mode requires an agent-owned execution; rerun without background: true')
        }
        const owner = exec.agent
        const jobId = jobs.start({
          kind: FUND_REPORT_JOB_KIND,
          label: `fund_research ${codes.join(',')}`,
          owner,
          run: (): JobHooks => {
            const abort = new AbortController()
            const progress: string[] = [`fund_research ${codes.join(',')}: started`]
            const done = (async (): Promise<JobOutcome> => {
              try {
                const value = await pipeline(owner, abort.signal)
                progress.push(renderResearch(value))
                const detail = value.kind === 'sealed' ? `sealed ${value.version}` : value.kind === 'summary' ? `summary ${value.funds.length} funds` : 'background'
                return { status: 'completed', detail, output: renderResearch(value) }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                progress.push(`failed: ${message}`)
                return { status: abort.signal.aborted ? 'killed' : 'failed', detail: message }
              }
            })()
            return {
              cancel: () => { abort.abort() },
              done,
              readOutput: () => progress.splice(0).join('\n'),
            }
          },
        })
        return { kind: 'background', jobId: String(jobId) } satisfies BackgroundValue
      }
      return await pipeline(exec.agent, exec.signal)
    },
  })
}

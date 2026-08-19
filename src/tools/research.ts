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
import { runResearch, type ResearchRun, type ToolDeps } from './shared.ts'

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
}

/** The background-branch canonical value: a typed handle, never prose to parse. */
export interface BackgroundValue {
  kind: 'background'
  jobId: string
}

/** Render the model-facing summary of one sealed report. */
function renderResearch(value: ResearchValue | BackgroundValue): string {
  if (value.kind === 'background') {
    return `fund_research 后台任务已启动：${value.jobId}（用 job_read 查看进度与结果）`
  }
  const v = value.verdicts
  const lines = [
    `${value.name}（${value.code}）研究报告已封存 — 仅供研究参考，不构成投资建议`,
    `版本目录 ${value.version}；报告 ${value.reportPath}`,
    `manifest ${value.manifestPath}（报告 sha256 ${value.reportSha256.slice(0, 12)}…）`,
    `数字回溯表核查（${value.verifyEngine}）：verified ${v.verified} / mismatch ${v.mismatch} / not-found ${v.notFound} / unverifiable ${v.unverifiable}`,
  ]
  if (value.gaps.length > 0) lines.push(`数据缺口（报告对应章节已声明）：${value.gaps.join('、')}`)
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
    description: 'Run a full deterministic research pipeline for one Chinese public mutual fund: collect public data (Tiantian Fund/Eastmoney), compute performance decomposition, holdings penetration, simplified style attribution and manager profile, verify every key number against the sealed source snapshot, and seal a versioned Markdown report + manifest under the report root. Set background: true to run as a background job. Public data only; research use only — not investment advice.',
    parameters: {
      code: { type: 'string', required: true, description: 'Six-digit fund code, e.g. "161725"' },
      sections: { type: 'array', items: { type: 'string' }, description: 'Section ids to render (overview/performance/holdings/style/manager/risk/disclaimer). Defaults to all.' },
      offline: { type: 'boolean', description: 'Read the stored snapshot layer only (no network). Defaults to the plugin config.' },
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
        ],
      },
      render: (_args, value) => [{ type: 'text', text: renderResearch(value as ResearchValue | BackgroundValue) }],
      presentationMeta: (_args, value) => {
        const sealed = value as ResearchValue | BackgroundValue
        if (sealed.kind !== 'sealed') return { kind: 'background', jobId: sealed.jobId }
        return {
          kind: 'sealed',
          reportPath: sealed.reportPath,
          manifestPath: sealed.manifestPath,
          snapshotPath: sealed.snapshotPath,
          reportSha256: sealed.reportSha256,
        }
      },
    },
    presentCall: (args) => {
      const root = deps.config.reportRoot
      const location = path.isAbsolute(root) ? path.join(root, args.code) : `${root}/${args.code}/`
      return { card: 'generic' as const, title: `fund_research ${args.code}`, kind: 'edit' as const, locations: [{ path: location }] }
    },
    presentResult: (_args, result) => {
      const meta = result.meta as { kind?: string, reportPath?: string, manifestPath?: string } | undefined
      if (meta?.kind === 'sealed' && typeof meta.reportPath === 'string') {
        return {
          card: 'generic' as const,
          title: `fund_research → ${meta.reportPath}`,
        }
      }
      return undefined
    },
    async execute(args, exec) {
      const sections = parseSections(args.sections)
      const offline = args.offline ?? deps.config.offline
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
          label: `fund_research ${args.code}`,
          owner,
          run: (): JobHooks => {
            const abort = new AbortController()
            const progress: string[] = [`fund_research ${args.code}: started`]
            const done = (async (): Promise<JobOutcome> => {
              try {
                const run = await runResearch(deps, args.code, owner, {
                  ...(sections === undefined ? {} : { sections }),
                  ...(args.offline === undefined ? {} : { offline: args.offline }),
                  signal: abort.signal,
                })
                const value = researchValueOf(run, offline)
                progress.push(renderResearch(value))
                return { status: 'completed', detail: `sealed ${value.version}`, output: renderResearch(value) }
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
      const run = await runResearch(deps, args.code, exec.agent, {
        ...(sections === undefined ? {} : { sections }),
        ...(args.offline === undefined ? {} : { offline: args.offline }),
        signal: exec.signal,
      })
      return researchValueOf(run, offline)
    },
  })
}

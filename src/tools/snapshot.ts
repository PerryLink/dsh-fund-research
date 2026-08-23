/**
 * The `fund_snapshot` tool: a light snapshot card for one fund (latest NAV,
 * published stage returns, scale, manager, top-3 holdings), sealed with its
 * snapshot into the fund's day directory. Research only — not investment
 * advice.
 * @module dsh-fund-research/tools/snapshot
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { FundSnapshot } from '../model.ts'
import { sourceQualityOf, type SourceQualityEntry, type SourcesDiscovery } from '../discovery.ts'
import { runSnapshotCard, type ToolDeps } from './shared.ts'

/** The canonical value of one `fund_snapshot` call. */
export interface SnapshotCardValue {
  code: string
  name: string
  /** Latest NAV date (YYYY-MM-DD). */
  asOf: string
  latestNav: number
  /** Published stage returns (percent strings). */
  returns: { month1: string, month3: string, month6: string, year1: string }
  /** Latest scale in 亿元; `null` when the source published none. */
  latestScaleYi: number | null
  manager: string
  top3: { code: string, name: string, navPct: number }[]
  gaps: string[]
  /** Whether the snapshot came from live fetches. */
  live: boolean
  /** Whether the offline read path served this call. */
  offline: boolean
  /** asOf cutoff applied (`null` = none). */
  asOfDate: string | null
  /** Per-source quality signals (requested/succeeded/fieldsPresent/warnings/degraded). */
  sourceQuality: SourceQualityEntry[]
  /** Day-directory version stamp (`YYYYMMDD-snapshot`). */
  version: string
  cardPath: string
  snapshotPath: string
}

/** Render the model-facing snapshot card text. */
function renderCard(value: SnapshotCardValue): string {
  const lines = [
    `${value.name}（${value.code}）快照 — 仅供研究参考，不构成投资建议`,
    `最新单位净值 ${value.latestNav}（${value.asOf}）；近1年 ${value.returns.year1}%、近6月 ${value.returns.month6}%、近3月 ${value.returns.month3}%、近1月 ${value.returns.month1}%`,
  ]
  if (value.asOfDate !== null) {
    lines.push(`asOf 截点：${value.asOfDate}（仅采用不晚于该日期的数据）`)
  }
  if (value.latestScaleYi !== null) lines.push(`最新规模 ${value.latestScaleYi} 亿元`)
  lines.push(`基金经理 ${value.manager}`)
  if (value.top3.length > 0) lines.push(`前三大重仓：${value.top3.map(row => `${row.name} ${row.navPct}%`).join('、')}`)
  if (value.gaps.length > 0) lines.push(`数据缺口：${value.gaps.join('、')}`)
  lines.push(`已封存：${value.cardPath}（快照 ${value.snapshotPath}，${value.live ? '实时采集' : '快照复用'}${value.offline ? '，offline' : ''}）`)
  return lines.join('\n')
}

/** Project the canonical value into the card model. */
function cardValueOf(snapshot: FundSnapshot, run: { version: string, cardPathRel: string, snapshotPathRel: string, live: boolean, discovery: SourcesDiscovery }, offline: boolean): SnapshotCardValue {
  const lastScale = snapshot.raw.scaleHistory.values[snapshot.raw.scaleHistory.values.length - 1]
  return {
    code: snapshot.code,
    name: snapshot.name,
    asOf: snapshot.computed.performance.latestDate,
    latestNav: snapshot.computed.performance.latestNav,
    returns: { ...snapshot.raw.returns },
    latestScaleYi: lastScale ?? null,
    manager: snapshot.raw.manager.name,
    top3: (snapshot.raw.holdings?.rows ?? []).slice(0, 3).map(row => ({ code: row.code, name: row.name, navPct: row.navPct })),
    gaps: snapshot.gaps,
    live: run.live,
    offline,
    asOfDate: snapshot.asOf ?? null,
    sourceQuality: sourceQualityOf(run.discovery),
    version: run.version,
    cardPath: run.cardPathRel,
    snapshotPath: run.snapshotPathRel,
  }
}

/**
 * Build the `fund_snapshot` tool definition.
 * @param deps - shared tool dependencies.
 * @returns the registry-ready tool definition.
 */
export function buildSnapshotTool(deps: ToolDeps) {
  return defineTool({
    name: 'fund_snapshot',
    description: 'Fetch a light research snapshot card for one Chinese public mutual fund (latest NAV, published stage returns, scale, manager, top-3 holdings), sealed with its source snapshot under the report root. Public data sources only; research use only — not investment advice.',
    parameters: {
      code: { type: 'string', required: true, description: 'Six-digit fund code, e.g. "161725"' },
      offline: { type: 'boolean', description: 'Read the stored snapshot layer only (no network). Defaults to the plugin config.' },
      asOfDate: { type: 'string', description: 'ISO 8601 date (YYYY-MM-DD) cutoff: only data on or before this date is used. Empty = no cutoff. Future dates fail loudly.' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          code: { type: 'string', required: true },
          name: { type: 'string', required: true },
          asOf: { type: 'string', required: true },
          latestNav: { type: 'number', required: true },
          returns: {
            type: 'object',
            properties: {
              month1: { type: 'string', required: true },
              month3: { type: 'string', required: true },
              month6: { type: 'string', required: true },
              year1: { type: 'string', required: true },
            },
            additionalProperties: false,
            required: true,
          },
          latestScaleYi: { oneOf: [{ type: 'number' }, { type: 'null' }], required: true },
          manager: { type: 'string', required: true },
          top3: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string', required: true },
                name: { type: 'string', required: true },
                navPct: { type: 'number', required: true },
              },
              additionalProperties: false,
            },
            required: true,
          },
          gaps: { type: 'array', items: { type: 'string' }, required: true },
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
          version: { type: 'string', required: true },
          cardPath: { type: 'string', required: true },
          snapshotPath: { type: 'string', required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: renderCard(value) }],
    },
    presentCall: args => ({ card: 'generic', title: `fund_snapshot ${args.code}`, kind: 'fetch' }),
    async execute(args, exec) {
      const offline = args.offline ?? deps.config.offline
      const run = await runSnapshotCard(deps, args.code, exec.agent, {
        ...(args.offline === undefined ? {} : { offline: args.offline }),
        ...(args.asOfDate === undefined ? {} : { asOfDate: args.asOfDate }),
        signal: exec.signal,
      })
      return cardValueOf(run.snapshot, run, offline)
    },
  })
}

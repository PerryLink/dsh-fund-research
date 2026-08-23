/**
 * Long-term tracking ledger: a deterministic JSONL append (`<reportRoot>/.tracking.jsonl`)
 * recording one line per successful seal (code / asOf / snapshot+quotes+report
 * hashes / version / record time) plus a compact comparison-facts block for the
 * deterministic 与上次对比 section. Comparison is pure over two facts blocks;
 * missing evidence renders a gap declaration, never an invented diff.
 * @module dsh-fund-research/tracking
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { FundSnapshot } from './model.ts'
import type { SealResult } from './report.ts'
import { dateOf, round4 } from './metrics/performance.ts'

/** The frozen tracking-line schema marker. */
export const TRACKING_LINE_SCHEMA = 'dsh-fund-research/tracking@v1' as const

/** Compact, deterministic comparison facts derived from one snapshot. */
export interface TrackingComparisonFacts {
  /** asOf cutoff applied (`null` = none). */
  asOf: string | null
  latestNav: number
  latestNavDate: string
  navFirstDate: string
  navLastDate: string
  navPoints: number
  latestScaleYi: number | null
  latestScaleDate: string | null
  topHoldings: Array<{ code: string, name: string, navPct: number }>
  topHoldingAsOf: string | null
}

/** One appended tracking line. */
export interface TrackingRecord {
  schema: typeof TRACKING_LINE_SCHEMA
  code: string
  snapshotSha256: string
  quotesSha256: string
  reportSha256: string
  version: string
  sealedAt: number
  recordedAt: number
  comparison: TrackingComparisonFacts
}

/** Derive the comparison facts for one snapshot (pure). */
export function comparisonFactsOf(snapshot: FundSnapshot): TrackingComparisonFacts {
  const scaleValues = snapshot.raw.scaleHistory.values
  const scaleDates = snapshot.raw.scaleHistory.dates
  const latestScaleYi = scaleValues[scaleValues.length - 1] ?? null
  const latestScaleDate = latestScaleYi === null ? null : scaleDates[scaleDates.length - 1] ?? null
  const first = snapshot.raw.navTrend[0]
  const last = snapshot.raw.navTrend[snapshot.raw.navTrend.length - 1]
  return {
    asOf: snapshot.asOf ?? null,
    latestNav: snapshot.computed.performance.latestNav,
    latestNavDate: snapshot.computed.performance.latestDate,
    navFirstDate: first === undefined ? '' : dateOf(first.t),
    navLastDate: last === undefined ? '' : dateOf(last.t),
    navPoints: snapshot.raw.navTrend.length,
    latestScaleYi,
    latestScaleDate,
    topHoldings: (snapshot.raw.holdings?.rows ?? []).slice(0, 5).map(row => ({ code: row.code, name: row.name, navPct: row.navPct })),
    topHoldingAsOf: snapshot.raw.holdings?.asOf ?? null,
  }
}

/** Build the tracking line for one sealed report. */
export function buildTrackingRecord(snapshot: FundSnapshot, seal: SealResult, recordedAt: number): TrackingRecord {
  return {
    schema: TRACKING_LINE_SCHEMA,
    code: snapshot.code,
    snapshotSha256: seal.manifest.snapshotSha256,
    quotesSha256: snapshot.sources.quotes.sha256,
    reportSha256: seal.manifest.reportSha256,
    version: seal.version,
    sealedAt: seal.manifest.sealedAt,
    recordedAt,
    comparison: comparisonFactsOf(snapshot),
  }
}

/** The tracking ledger path under the report root. */
export function trackingPath(reportRootAbs: string): string {
  return path.join(reportRootAbs, '.tracking.jsonl')
}

/** Append one tracking line (deterministic field order; best-effort). */
export async function appendTrackingRecord(reportRootAbs: string, record: TrackingRecord): Promise<void> {
  try {
    await mkdir(reportRootAbs, { recursive: true })
    await appendFile(trackingPath(reportRootAbs), `${JSON.stringify(record)}\n`, 'utf8')
  } catch {
    // A failed tracking append never changes the report outcome.
  }
}

/** Read every valid tracking line in append order; corrupt lines are skipped. */
export async function readTracking(reportRootAbs: string): Promise<TrackingRecord[]> {
  try {
    const text = await readFile(trackingPath(reportRootAbs), 'utf8')
    const records: TrackingRecord[] = []
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      try {
        const parsed: unknown = JSON.parse(trimmed)
        if (parsed !== null && typeof parsed === 'object' && typeof (parsed as TrackingRecord).code === 'string') {
          records.push(parsed as TrackingRecord)
        }
      } catch {
        // A corrupt line is skipped; comparison then reports a gap, never a bad diff.
      }
    }
    return records
  } catch {
    return []
  }
}

/**
 * Render the deterministic 与上次对比 section. A missing previous record is a
 * declared gap, never an invented comparison.
 * @param previous - the previous run's comparison facts, or `null` (no record).
 * @param current - the current run's comparison facts.
 * @param code - fund code (for the gap label).
 * @returns the section markdown.
 */
export function renderComparisonSection(previous: TrackingComparisonFacts | null, current: TrackingComparisonFacts, code: string): string {
  const lines = ['## 与上次对比', '']
  if (previous === null) {
    lines.push(`**数据缺口**：\`<reportRoot>/.tracking.jsonl\` 中无 ${code} 的上一期记录，本版不产出与上次对比，不编造。`)
    return lines.join('\n')
  }
  lines.push('上一期数据取自 `<reportRoot>/.tracking.jsonl` 记录；本期数据取自本次封存快照。', '')

  const navChange = previous.latestNav > 0 ? round4((current.latestNav / previous.latestNav - 1) * 100) : null
  lines.push(`- 净值：上期 ${previous.latestNav}（${previous.latestNavDate}）→ 本期 ${current.latestNav}（${current.latestNavDate}），变动 ${navChange === null ? '不可比' : `${navChange}%`}`)
  lines.push(`- 净值区间：上期 ${previous.navFirstDate} ~ ${previous.navLastDate}（${previous.navPoints} 点）→ 本期 ${current.navFirstDate} ~ ${current.navLastDate}（${current.navPoints} 点）`)

  if (previous.latestScaleYi === null || current.latestScaleYi === null) {
    lines.push('- 规模：上期或本期无规模数据，不做对比（缺口）。')
  } else {
    lines.push(`- 规模：上期 ${previous.latestScaleYi} 亿元（${previous.latestScaleDate ?? '?'}）→ 本期 ${current.latestScaleYi} 亿元（${current.latestScaleDate ?? '?'}）`)
  }

  const prevCodes = new Set(previous.topHoldings.map(holding => holding.code))
  const currCodes = new Set(current.topHoldings.map(holding => holding.code))
  const kept = [...currCodes].filter(holding => prevCodes.has(holding)).sort()
  const added = [...currCodes].filter(holding => !prevCodes.has(holding)).sort()
  const removed = [...prevCodes].filter(holding => !currCodes.has(holding)).sort()
  const n = Math.max(previous.topHoldings.length, current.topHoldings.length)
  lines.push(`- 前 ${n} 大重仓：留存 ${kept.length === 0 ? '无' : kept.join('、')}；新晋 ${added.length === 0 ? '无' : added.join('、')}；剔除 ${removed.length === 0 ? '无' : removed.join('、')}`)
  lines.push('', '> 仅供研究参考，不构成投资建议。')
  return lines.join('\n')
}
